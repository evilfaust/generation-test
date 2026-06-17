import { useEffect, useMemo, useState } from 'react';
import { Button, Empty, Spin, Tag } from 'antd';
import { CalendarOutlined, FileTextOutlined, LinkOutlined, PlayCircleOutlined, StarOutlined } from '@ant-design/icons';
import { api } from '../../shared/services/pocketbase';
import { summerWeeks } from '../../shared/utils/summerWeeks';

const BLOCK_LABEL = { algebra: 'Алгебра', geometry: 'Геометрия', custom: 'Работа', oral: 'Устный счёт', extra: 'Тригонометрия' };

// «Моя летняя программа» в кабинете ученика: блоки по неделям + «каждую неделю».
// Чтение своей программы открыто правилами (миграция 1779000021).
export default function StudentSummerProgram({ student }) {
  const [items, setItems] = useState([]);
  const [program, setProgram] = useState(null);
  const [loading, setLoading] = useState(true);
  const year = new Date().getFullYear();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const prog = await api.getStudyProgramForStudent(student.id, { season: 'summer', year });
        if (cancelled) return;
        setProgram(prog);
        if (prog) setItems(await api.getProgramItems(prog.id));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [student.id, year]);

  // Календарные недели + распределение. Счётные навыки (week==null) показываем
  // в КАЖДОЙ неделе (делать дозированно, каждую неделю).
  const { calWeeks, byWeek, weekly } = useMemo(() => {
    const cal = summerWeeks(program?.config?.startDate, program?.config?.endDate);
    const map = new Map();
    const every = [];
    for (const it of items) {
      const w = it.params?.week;
      if (w == null) { every.push(it); continue; }
      if (!map.has(w)) map.set(w, []);
      map.get(w).push(it);
    }
    // Если дат нет — соберём недели из самих элементов.
    const weeksList = cal.length
      ? cal
      : [...map.keys()].sort((a, b) => a - b).map((w) => ({ week: w, label: null }));
    return { calWeeks: weeksList, byWeek: map, weekly: every };
  }, [items, program]);

  const weekFiles = program?.config?.weekFiles || {};
  const extra = program?.config?.extra || null;
  const hasExtra = extra && (extra.text?.trim() || (extra.files || []).length || (extra.links || []).length);

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>;
  if (!program || (!items.length && !hasExtra)) {
    return (
      <div style={{ padding: 24 }}>
        <Empty description="Каникулярного задания пока нет. Загляни позже — учитель его соберёт." />
      </div>
    );
  }

  return (
    <div className="student-summer">
      <h2 className="student-summer-title"><CalendarOutlined /> Каникулярное задание</h2>
      <p className="student-summer-hint">
        Здесь весь план на каникулы. Выполняй по неделям — не сразу всё, а порцию каждую неделю.
      </p>

      {calWeeks.map((w) => {
        const examItems = byWeek.get(w.week) || [];
        const files = weekFiles[w.week] || [];
        return (
          <div key={w.week} className="student-summer-group">
            <div className="student-summer-group-head">
              Неделя {w.week}{w.label ? <span className="student-summer-week-dates"> · {w.label}</span> : ''}
            </div>
            {examItems.map((it) => <ProgramItem key={it.id} item={it} />)}
            {weekly.map((it) => <ProgramItem key={`${w.week}-${it.id}`} item={it} weekly />)}
            {files.map((f) => <FileItem key={f.id} file={f} />)}
            {!examItems.length && !weekly.length && !files.length && (
              <div className="student-summer-item"><span style={{ color: '#999' }}>На эту неделю заданий нет</span></div>
            )}
          </div>
        );
      })}

      {hasExtra && (
        <div className="student-summer-group student-summer-group--extra">
          <div className="student-summer-group-head"><StarOutlined /> Дополнительное задание</div>
          {extra.text?.trim() && (
            <div className="student-summer-item student-summer-extra-text">{extra.text}</div>
          )}
          {(extra.files || []).map((f) => <FileItem key={f.id} file={f} />)}
          {(extra.links || []).map((l, i) => (
            <div key={i} className="student-summer-item">
              <div className="student-summer-item-main">
                <span className="student-summer-item-title">{l.label || l.url}</span>
              </div>
              <div className="student-summer-item-actions">
                <Button icon={<LinkOutlined />} href={l.url} target="_blank">Открыть</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Прикреплённый файл (к неделе или доп. заданию) с опциональным пояснением.
function FileItem({ file }) {
  return (
    <div className="student-summer-item">
      <div className="student-summer-item-main">
        <Tag color="blue"><FileTextOutlined /> файл</Tag>
        <span className="student-summer-item-title">
          {file.title || 'файл'}
          {file.note && <span className="student-summer-file-note"> — {file.note}</span>}
        </span>
      </div>
      <div className="student-summer-item-actions">
        <Button icon={<FileTextOutlined />} href={file.url} target="_blank">Открыть</Button>
      </div>
    </div>
  );
}

function ProgramItem({ item, weekly }) {
  const atts = item.params?.attachments || [];
  return (
    <div className="student-summer-item">
      <div className="student-summer-item-main">
        <Tag color={weekly ? 'purple' : undefined}>{BLOCK_LABEL[item.block_type] || item.block_type}</Tag>
        <span className="student-summer-item-title">{item.title}</span>
        {weekly && <Tag color="purple" style={{ marginLeft: 4 }}>каждую неделю</Tag>}
      </div>
      <div className="student-summer-item-actions">
        {item.session && (
          <Button type="primary" icon={<PlayCircleOutlined />}
            href={`/student/${item.session}`}>
            Решать
          </Button>
        )}
        {atts.map((a) => (
          <Button key={a.id} icon={<FileTextOutlined />} href={a.url} target="_blank">
            {a.title || 'файл'}
          </Button>
        ))}
      </div>
    </div>
  );
}
