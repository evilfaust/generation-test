import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { App, Button, Checkbox, Collapse, Input, Spin, Tooltip } from 'antd';
import {
  ArrowLeftOutlined, SaveOutlined, PlusOutlined, FontSizeOutlined,
  ArrowUpOutlined, ArrowDownOutlined, DeleteOutlined, EyeOutlined,
} from '@ant-design/icons';
import MathRenderer from '../MathRenderer';
import TaskSelectModal from '../TaskSelectModal';
import { api } from '../../shared/services/pocketbase';
import { R } from '../../App';
import './listki.css';

function numFromCode(code) { const m = /(\d+\.\d+)$/.exec(code || ''); return m ? m[1] : ''; }

export default function ListokEditor() {
  const { sheetId } = useParams();
  const navigate = useNavigate();
  const { modal, message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [title, setTitle] = useState('');
  const [intro, setIntro] = useState('');
  const [items, setItems] = useState([]);
  const [pickOpen, setPickOpen] = useState(false);

  const reload = async () => {
    const its = await api.getListokItems(sheetId);
    setItems(its);
  };
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [s, its] = await Promise.all([api.getListokSheet(sheetId), api.getListokItems(sheetId)]);
        if (!alive) return;
        if (s.kind !== 'teacher') { message.warning('Официальные листки нельзя редактировать — склонируйте в свои'); navigate(R.LISTOK_VIEW.replace(':sheetId', sheetId)); return; }
        setSheet(s); setTitle(s.title || ''); setIntro(s.intro_md || ''); setItems(its);
      } catch (e) { console.error(e); message.error('Листок не найден'); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [sheetId]);

  const saveMeta = async () => {
    setSaving(true);
    try { await api.updateListok(sheetId, { title: title.trim() || 'Листок', intro_md: intro }); message.success('Сохранено'); }
    catch (e) { console.error(e); message.error('Ошибка сохранения'); }
    finally { setSaving(false); }
  };

  const nextOrder = () => (items.length ? Math.max(...items.map((i) => i.order || 0)) + 1 : 0);

  const addTask = async (task) => {
    try {
      await api.addListokItem({ sheet: sheetId, type: 'task', task: task.id, order: nextOrder(), section: 'main' });
      await reload(); message.success(`Задача ${task.code || ''} добавлена`);
    } catch (e) { console.error(e); message.error('Не удалось добавить задачу'); }
  };

  const addHeading = async () => {
    let text = 'Дополнительные задачи';
    modal.confirm({
      title: 'Заголовок-раздел',
      content: <Input defaultValue={text} onChange={(e) => { text = e.target.value; }} />,
      okText: 'Добавить', cancelText: 'Отмена',
      onOk: async () => {
        try { await api.addListokItem({ sheet: sheetId, type: 'heading', heading_text: text, order: nextOrder() }); await reload(); }
        catch (e) { console.error(e); message.error('Ошибка'); }
      },
    });
  };

  const move = async (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const a = items[idx], b = items[j];
    const next = [...items];
    next[idx] = b; next[j] = a;
    setItems(next); // оптимистично
    try { await api.reorderListokItems([{ id: a.id, order: b.order }, { id: b.id, order: a.order }]); }
    catch (e) { console.error(e); message.error('Ошибка порядка'); reload(); }
  };

  const remove = async (it) => {
    setItems((arr) => arr.filter((x) => x.id !== it.id)); // оптимистично
    try { await api.removeListokItem(it.id); } catch (e) { console.error(e); message.error('Ошибка удаления'); reload(); }
  };

  if (loading) return <div style={{ padding: 48, textAlign: 'center' }}><Spin size="large" /></div>;
  if (!sheet) return null;

  const excludeIds = items.filter((i) => i.type === 'task' && i.task).map((i) => i.task);

  return (
    <div className="listok-view">
      <div className="listok-toolbar">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(R.LISTOK_VIEW.replace(':sheetId', sheetId))}>К просмотру</Button>
        <div style={{ flex: 1 }} />
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={saveMeta}>Сохранить</Button>
      </div>

      <Input size="large" value={title} onChange={(e) => setTitle(e.target.value)}
        placeholder="Название листка" style={{ marginBottom: 12, fontWeight: 600 }} />

      <Collapse
        className="listok-theory"
        items={[{
          key: 'intro',
          label: <span>Вводный текст / теория (Markdown + LaTeX)</span>,
          children: (
            <div>
              <Input.TextArea value={intro} onChange={(e) => setIntro(e.target.value)}
                autoSize={{ minRows: 3, maxRows: 14 }} placeholder="Определения, теоремы, формулировки… Поддерживается $LaTeX$." />
              {intro.trim() && (
                <Collapse ghost items={[{ key: 'p', label: <span><EyeOutlined /> Предпросмотр</span>,
                  children: <div className="listok-md"><MathRenderer content={intro} /></div> }]} />
              )}
            </div>
          ),
        }]}
      />

      <div className="listok-edit-actions">
        <Button icon={<PlusOutlined />} onClick={() => setPickOpen(true)}>Добавить задачу из банка</Button>
        <Button icon={<FontSizeOutlined />} onClick={addHeading}>Добавить заголовок</Button>
        <span className="listok-count">{excludeIds.length} задач</span>
      </div>

      {items.length === 0 ? (
        <div className="listok-empty">Лист пуст — добавьте задачи из банка или склонируйте лист Гордина.</div>
      ) : (
        <ol className="listok-problems listok-problems--edit">
          {items.map((it, idx) => (
            <li key={it.id} className={it.type === 'heading' ? 'listok-heading-row' : 'listok-problem'}>
              {it.type === 'heading' ? (
                <h3 style={{ flex: 1 }}>{it.heading_text}</h3>
              ) : (
                <>
                  <div className="listok-pnum">{numFromCode(it.expand?.task?.code) || '•'}</div>
                  <div className="listok-md listok-pbody"><MathRenderer content={it.expand?.task?.statement_md || ''} /></div>
                </>
              )}
              <div className="listok-row-actions">
                <Tooltip title="Выше"><Button size="small" type="text" icon={<ArrowUpOutlined />} disabled={idx === 0} onClick={() => move(idx, -1)} /></Tooltip>
                <Tooltip title="Ниже"><Button size="small" type="text" icon={<ArrowDownOutlined />} disabled={idx === items.length - 1} onClick={() => move(idx, 1)} /></Tooltip>
                <Tooltip title="Убрать"><Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => remove(it)} /></Tooltip>
              </div>
            </li>
          ))}
        </ol>
      )}

      <TaskSelectModal
        visible={pickOpen}
        excludeIds={excludeIds}
        onCancel={() => setPickOpen(false)}
        onSelect={(task) => { addTask(task); }}
      />
    </div>
  );
}
