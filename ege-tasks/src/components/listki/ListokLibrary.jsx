import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button, Input, Segmented, Spin, Tooltip } from 'antd';
import {
  ReadOutlined, PlusOutlined, PushpinFilled, EditOutlined, DeleteOutlined,
} from '@ant-design/icons';
import { WorkspacePageHeader, EmptyState, SectionCard, Chip } from '../workspace/ui';
import { api } from '../../shared/services/pocketbase';
import { useAuth } from '../../contexts/AuthContext';
import { R } from '../../App';

const COURSE_LABEL = { planimetry: 'Планиметрия', stereometry: 'Стереометрия' };
const COURSE_TONE = { planimetry: 'teal', stereometry: 'violet' };

export default function ListokLibrary() {
  const navigate = useNavigate();
  const { modal, message } = App.useApp();
  const { canEdit, canDelete } = useAuth();
  const [loading, setLoading] = useState(true);
  const [official, setOfficial] = useState([]);
  const [mine, setMine] = useState([]);
  const [course, setCourse] = useState('all');
  const [q, setQ] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [off, ts] = await Promise.all([api.getOfficialSheets(), api.getTeacherSheets()]);
      setOfficial(off);
      setMine(ts);
    } catch (e) {
      console.error(e);
      message.error('Не удалось загрузить листки');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const filteredOfficial = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return official.filter((s) =>
      (course === 'all' || s.course === course)
      && (!needle || (s.title || '').toLowerCase().includes(needle)));
  }, [official, course, q]);

  const byCourse = useMemo(() => {
    const map = {};
    for (const s of filteredOfficial) (map[s.course] ||= []).push(s);
    return map;
  }, [filteredOfficial]);

  const createListok = async () => {
    try {
      const sheet = await api.createListok({ title: 'Новый листок', intro_md: '' });
      navigate(R.LISTOK_EDIT.replace(':sheetId', sheet.id));
    } catch (e) { console.error(e); message.error('Не удалось создать листок'); }
  };

  const removeMine = (sheet) => {
    modal.confirm({
      title: 'Удалить листок?',
      content: `«${sheet.title}» — задачи в банке останутся, удалится только сам листок.`,
      okText: 'Удалить', okButtonProps: { danger: true }, cancelText: 'Отмена',
      onOk: async () => {
        try { await api.deleteListok(sheet.id); setMine((m) => m.filter((x) => x.id !== sheet.id)); }
        catch (e) { console.error(e); message.error('Ошибка удаления'); }
      },
    });
  };

  if (loading) return <div style={{ padding: 48, textAlign: 'center' }}><Spin size="large" /></div>;

  return (
    <div>
      <WorkspacePageHeader
        accent="teal"
        icon={<ReadOutlined />}
        title="Листки"
        subtitle="Листки Р. К. Гордина (57 школа) и ваши собственные подборки"
        extra={canEdit ? <Button type="primary" icon={<PlusOutlined />} onClick={createListok}>Создать листок</Button> : null}
      />

      {/* Мои листки */}
      <SectionCard icon={<EditOutlined />} title="Мои листки" meta={mine.length ? `${mine.length} шт.` : null}>
        {mine.length === 0 ? (
          <EmptyState
            title="Пока нет своих листков"
            description="Соберите свой листок из задач банка или склонируйте лист Гордина и отредактируйте под класс."
            cta={canEdit ? 'Создать листок' : null}
            ctaIcon={<PlusOutlined />}
            onCta={canEdit ? createListok : null}
          />
        ) : (
          <div className="ws-grid">
            {mine.map((s) => (
              <div key={s.id} className="ws-tile" onClick={() => navigate(R.LISTOK_VIEW.replace(':sheetId', s.id))}>
                <div className="ws-tile-title">
                  {s.is_pinned && <PushpinFilled style={{ color: '#faad14', marginRight: 6 }} />}
                  {s.title}
                </div>
                <div className="ws-tile-meta">
                  {s.course && <Chip tone={COURSE_TONE[s.course]}>{COURSE_LABEL[s.course]}</Chip>}
                  {s.cloned_from && <Chip tone="neutral">копия</Chip>}
                </div>
                <div className="ws-tile-actions" onClick={(e) => e.stopPropagation()}>
                  {canEdit && (
                    <Tooltip title="Редактировать">
                      <Button size="small" type="text" icon={<EditOutlined />}
                        onClick={() => navigate(R.LISTOK_EDIT.replace(':sheetId', s.id))} />
                    </Tooltip>
                  )}
                  {canDelete && (
                    <Tooltip title="Удалить">
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => removeMine(s)} />
                    </Tooltip>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Библиотека Гордина */}
      <SectionCard
        icon={<ReadOutlined />}
        title="Библиотека Гордина"
        meta={`${official.length} листов`}
        extra={(
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Input.Search allowClear placeholder="Поиск по частям" value={q}
              onChange={(e) => setQ(e.target.value)} style={{ width: 220 }} />
            <Segmented
              value={course}
              onChange={setCourse}
              options={[
                { label: 'Все', value: 'all' },
                { label: 'Планиметрия', value: 'planimetry' },
                { label: 'Стереометрия', value: 'stereometry' },
              ]}
            />
          </div>
        )}
      >
        {filteredOfficial.length === 0 ? (
          <EmptyState title="Ничего не найдено" description="Измените запрос или курс." />
        ) : (
          ['planimetry', 'stereometry'].filter((c) => byCourse[c]?.length).map((c) => (
            <div key={c} style={{ marginBottom: 18 }}>
              <div style={{ fontWeight: 600, margin: '6px 0 10px', color: 'var(--ws-muted, #555)' }}>
                {COURSE_LABEL[c]} · {byCourse[c].length} частей
              </div>
              <div className="ws-grid">
                {byCourse[c].map((s) => (
                  <div key={s.id} className="ws-tile" onClick={() => navigate(R.LISTOK_VIEW.replace(':sheetId', s.id))}>
                    <div className="ws-tile-title">{s.title}</div>
                    <div className="ws-tile-meta">
                      <Chip tone={COURSE_TONE[c]} dot={false}>часть {s.part_order}</Chip>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </SectionCard>
    </div>
  );
}
