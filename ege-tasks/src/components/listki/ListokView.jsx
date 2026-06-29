import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { App, Button, Collapse, Spin, Tooltip } from 'antd';
import {
  ArrowLeftOutlined, PrinterOutlined, EditOutlined, CopyOutlined,
  SendOutlined, ReadOutlined,
} from '@ant-design/icons';
import MathRenderer from '../MathRenderer';
import { api } from '../../shared/services/pocketbase';
import { useAuth } from '../../contexts/AuthContext';
import { R, route } from '../../App';
import ListokPrint from './ListokPrint';
import './listki.css';

const COURSE_LABEL = { planimetry: 'Планиметрия', stereometry: 'Стереометрия', algebra: 'Алгебра' };

// Номер задачи из code: gordin-plan-1.1 → 1.1 (иначе пусто)
function numFromCode(code) {
  const m = /(\d+\.\d+)$/.exec(code || '');
  return m ? m[1] : '';
}

export default function ListokView() {
  const { sheetId } = useParams();
  const navigate = useNavigate();
  const { modal, message } = App.useApp();
  const { canEdit } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState(null);
  const [items, setItems] = useState([]);
  const [printMode, setPrintMode] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [s, its] = await Promise.all([api.getListokSheet(sheetId), api.getListokItems(sheetId)]);
        if (!alive) return;
        setSheet(s);
        setItems(its);
      } catch (e) {
        console.error(e); message.error('Листок не найден');
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [sheetId]);

  const problems = useMemo(
    () => items.map((it) => ({
      ...it,
      num: it.type === 'task' ? numFromCode(it.expand?.task?.code) : '',
      statement: it.expand?.task?.statement_md || '',
    })),
    [items],
  );

  const assign = async () => {
    setBusy(true);
    try {
      const work = await api.createWorkFromListok(sheet, items);
      message.success('Создана работа из листка — настройте выдачу');
      navigate(route(R.WORK_EDITOR, { workId: work.id }));
    } catch (e) { console.error(e); message.error('Не удалось создать работу'); }
    finally { setBusy(false); }
  };

  const clone = async () => {
    setBusy(true);
    try {
      const copy = await api.cloneListok(sheet.id);
      message.success('Лист скопирован в «Мои листки»');
      navigate(R.LISTOK_EDIT.replace(':sheetId', copy.id));
    } catch (e) { console.error(e); message.error('Не удалось склонировать'); }
    finally { setBusy(false); }
  };

  if (loading) return <div style={{ padding: 48, textAlign: 'center' }}><Spin size="large" /></div>;
  if (!sheet) return null;

  if (printMode) return <ListokPrint sheet={sheet} problems={problems} onBack={() => setPrintMode(false)} />;

  const isOfficial = sheet.kind === 'official';

  return (
    <div className="listok-view">
      <div className="listok-toolbar">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(R.LISTKI)}>К листкам</Button>
        <div style={{ flex: 1 }} />
        <Button icon={<PrinterOutlined />} onClick={() => setPrintMode(true)}>Печать / PDF</Button>
        <Tooltip title="Создать работу из задач листка и выдать ученикам">
          <Button icon={<SendOutlined />} loading={busy} onClick={assign}>Выдать ученику</Button>
        </Tooltip>
        {isOfficial && canEdit && (
          <Tooltip title="Скопировать в «Мои листки» для редактирования">
            <Button icon={<CopyOutlined />} loading={busy} onClick={clone}>В свои листки</Button>
          </Tooltip>
        )}
        {!isOfficial && canEdit && (
          <Button type="primary" icon={<EditOutlined />}
            onClick={() => navigate(R.LISTOK_EDIT.replace(':sheetId', sheet.id))}>Редактировать</Button>
        )}
      </div>

      <h1 className="listok-title">{sheet.title}</h1>
      <div className="listok-sub">
        {sheet.course && <span className="listok-badge">{COURSE_LABEL[sheet.course]}</span>}
        {isOfficial && <span className="listok-badge listok-badge--muted">Р. К. Гордин · 57 школа</span>}
        {sheet.source_url && <a href={sheet.source_url} target="_blank" rel="noreferrer">↗ источник</a>}
        {sheet.pdf_url && <a href={sheet.pdf_url} target="_blank" rel="noreferrer">↗ PDF части</a>}
      </div>

      {sheet.intro_md?.trim() && (
        <Collapse
          defaultActiveKey={isOfficial ? ['theory'] : []}
          className="listok-theory"
          items={[{
            key: 'theory',
            label: <span><ReadOutlined /> Теория и определения</span>,
            children: <div className="listok-md"><MathRenderer content={sheet.intro_md} /></div>,
          }]}
        />
      )}

      <ol className="listok-problems">
        {problems.map((p) => p.type === 'heading' ? (
          <li key={p.id} className="listok-heading-row"><h3>{p.heading_text}</h3></li>
        ) : (
          <li key={p.id} className="listok-problem">
            <div className="listok-pnum">
              {p.num || '•'}
              {p.flag === 'basic' && <span className="listok-flag listok-flag--basic" title="базовая / устная">°</span>}
              {p.flag === 'hard' && <span className="listok-flag listok-flag--hard" title="повышенной трудности">∗</span>}
            </div>
            <div className="listok-md listok-pbody"><MathRenderer content={p.statement} /></div>
          </li>
        ))}
      </ol>
    </div>
  );
}
