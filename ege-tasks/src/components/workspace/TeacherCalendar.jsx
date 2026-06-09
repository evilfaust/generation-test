import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, dayjsLocalizer, Views } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import {
  App, Button, DatePicker, Form, Input, Modal, Popconfirm, Segmented, Select, Space, Switch, Typography,
} from 'antd';
import { CalendarOutlined, FileTextOutlined, LinkOutlined, PlusOutlined, PaperClipOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import MaterialPickerModal from './MaterialPickerModal';
import { WorkspacePageHeader, Chip, groupHex } from './ui';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import localeData from 'dayjs/plugin/localeData';
import weekday from 'dayjs/plugin/weekday';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import { api } from '../../shared/services/pocketbase';
import { useAuth } from '../../contexts/AuthContext';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import './TeacherCalendar.css';

dayjs.extend(localeData);
dayjs.extend(weekday);
dayjs.extend(localizedFormat);
dayjs.locale('ru');

const { Text } = Typography;
const localizer = dayjsLocalizer(dayjs);
const DnDCalendar = withDragAndDrop(Calendar);

const RU_MESSAGES = {
  date: 'Дата', time: 'Время', event: 'Событие',
  allDay: 'Весь день', week: 'Неделя', work_week: 'Раб. неделя',
  day: 'День', month: 'Месяц', previous: 'Назад', next: 'Вперёд',
  yesterday: 'Вчера', tomorrow: 'Завтра', today: 'Сегодня', agenda: 'Список',
  noEventsInRange: 'Нет событий в этом периоде',
  showMore: (n) => `+ ещё ${n}`,
};

const STATUS_LABEL = { planned: 'запланирован', done: 'проведён', cancelled: 'отменён' };

// Расписание пар школы. full = [старт, конец] целой пары; halves = [[1-я пол.], [2-я пол.]].
// Нулевая пара — единый блок без полупар.
const PAIRS = [
  { key: '0', label: 'Нулевая', full: ['09:00', '10:00'], halves: null },
  { key: '1', label: '1-я пара', full: ['10:15', '11:45'], halves: [['10:15', '11:00'], ['11:05', '11:45']] },
  { key: '2', label: '2-я пара', full: ['12:00', '13:45'], halves: [['12:00', '12:45'], ['12:50', '13:45']] },
  { key: '3', label: '3-я пара', full: ['14:05', '15:40'], halves: [['14:05', '14:50'], ['14:55', '15:40']] },
  { key: '4', label: '4-я пара', full: ['16:00', '17:35'], halves: [['16:00', '16:45'], ['16:50', '17:35']] },
  { key: '5', label: '5-я пара', full: ['17:45', '19:20'], halves: [['17:45', '18:30'], ['18:35', '19:20']] },
];

const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// Карта старт→конец для длительности на календаре. На пересечении старта целой и
// 1-й полупары приоритет у ЦЕЛОЙ (частый случай); 2-я полупара различима по старту.
const START_TO_END = (() => {
  const m = {};
  for (const p of PAIRS) {
    m[p.full[0]] = p.full[1];
    if (p.halves) m[p.halves[1][0]] = p.halves[1][1];
  }
  return m;
})();

// Конец события: по таблице расписания, иначе дефолт 45 мин.
function endForStart(start) {
  const endStr = START_TO_END[hhmm(start)];
  if (!endStr) return new Date(start.getTime() + 45 * 60 * 1000);
  const [h, m] = endStr.split(':').map(Number);
  const end = new Date(start);
  end.setHours(h, m, 0, 0);
  return end;
}

// Угадать пару/часть по времени старта (для инициализации селектора). Для старта,
// совпадающего с целой/1-й полупарой, по умолчанию 'full'.
function guessSlot(start) {
  const t = hhmm(start);
  for (const p of PAIRS) {
    if (p.full[0] === t) return { pair: p.key, part: 'full' };
    if (p.halves && p.halves[1][0] === t) return { pair: p.key, part: '2' };
  }
  return { pair: null, part: 'full' };
}

// Диапазон [старт,конец] по коду time_slot: "0"|"N"|"Na"/"Nb"|"N-M" (интенсив).
function slotRangeFromCode(code) {
  if (!code) return null;
  const inten = /^(\d)-(\d)$/.exec(code);
  if (inten) {
    const a = PAIRS.find((p) => p.key === inten[1]);
    const b = PAIRS.find((p) => p.key === inten[2]);
    return a && b ? [a.full[0], b.full[1]] : null;
  }
  const half = /^(\d)([ab])$/.exec(code);
  if (half) {
    const p = PAIRS.find((x) => x.key === half[1]);
    return p && p.halves ? (half[2] === 'a' ? p.halves[0] : p.halves[1]) : null;
  }
  const p = PAIRS.find((x) => x.key === code);
  return p ? p.full : null;
}

// Конец события: приоритет у сохранённого time_slot (интенсивы/полупары), иначе по
// времени старта (обратная совместимость со старыми уроками), иначе 45 мин.
function endForLesson(l, start) {
  const r = slotRangeFromCode(l.time_slot);
  if (r) {
    const [h, m] = r[1].split(':').map(Number);
    const end = new Date(start);
    end.setHours(h, m, 0, 0);
    return end;
  }
  return endForStart(start);
}

function LessonModal({ open, initial, groups, works, onSave, onDelete, onCancel, onOpenNote, onOpenMaterial, saving, canEdit }) {
  const [form] = Form.useForm();
  const materialIds = Form.useWatch('materials', form) || [];
  const worksMap = useMemo(() => new Map((works || []).map((w) => [w.id, w.title])), [works]);
  // Файлы из Библиотеки (type:'material') живут отдельно от работ (type:'work').
  const [fileMaterials, setFileMaterials] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Пресет «пара/часть/интенсив» — выставляет время старта по расписанию школы.
  const [mode, setMode] = useState('single');   // 'single' | 'intensive'
  const [pair, setPair] = useState(null);        // '0'..'5' | null (своё время / старт интенсива)
  const [part, setPart] = useState('full');      // 'full' | '1' | '2'
  const [endPair, setEndPair] = useState(null);  // конечная пара интенсива

  useEffect(() => {
    if (open) {
      const all = Array.isArray(initial?.materials) ? initial.materials : [];
      const startDate = initial?.date_plan ? dayjs(initial.date_plan)
        : (initial?.slotDate ? dayjs(initial.slotDate) : dayjs());
      form.setFieldsValue({
        title: initial?.title || '',
        group: initial?.group || undefined,
        date_plan: startDate,
        status: initial?.status || 'planned',
        materials: all.filter((m) => m.type !== 'material').map((m) => m.id),
      });
      setFileMaterials(all.filter((m) => m.type === 'material'));
      // Инициализация слота: приоритет time_slot, иначе угадываем по времени старта.
      const ts = initial?.time_slot || '';
      const inten = /^(\d)-(\d)$/.exec(ts);
      const half = /^(\d)([ab])$/.exec(ts);
      if (inten) { setMode('intensive'); setPair(inten[1]); setEndPair(inten[2]); setPart('full'); }
      else if (half) { setMode('single'); setPair(half[1]); setPart(half[2] === 'a' ? '1' : '2'); setEndPair(null); }
      else if (ts && PAIRS.some((p) => p.key === ts)) { setMode('single'); setPair(ts); setPart('full'); setEndPair(null); }
      else { const g = guessSlot(startDate.toDate()); setMode('single'); setPair(g.pair); setPart(g.part); setEndPair(null); }
    }
  }, [open, initial, form]);

  const setStartTime = (str) => {
    const [h, m] = str.split(':').map(Number);
    const cur = form.getFieldValue('date_plan') || dayjs();
    form.setFieldsValue({ date_plan: dayjs(cur).hour(h).minute(m).second(0).millisecond(0) });
  };

  // Одиночная пара/полупара → старт по расписанию.
  const applySlot = (p, prt) => {
    setPair(p);
    setPart(prt);
    if (!p) return;
    const def = PAIRS.find((x) => x.key === p);
    if (def) setStartTime((p === '0' || prt === 'full') ? def.full[0] : (prt === '1' ? def.halves[0][0] : def.halves[1][0]));
  };

  // Интенсив → старт = начало первой пары.
  const applyIntensive = (s, e) => {
    setPair(s);
    setEndPair(e);
    if (!s) return;
    const def = PAIRS.find((x) => x.key === s);
    if (def) setStartTime(def.full[0]);
  };

  // Код слота для сохранения (time_slot).
  const currentSlotCode = () => {
    if (mode === 'intensive') {
      if (!pair || !endPair || Number(endPair) <= Number(pair)) return '';
      return `${pair}-${endPair}`;
    }
    if (!pair) return '';
    if (pair === '0' || part === 'full') return pair;
    return pair + (part === '1' ? 'a' : 'b');
  };

  const slotRange = slotRangeFromCode(currentSlotCode());
  const intensiveCount = (mode === 'intensive' && pair && endPair && Number(endPair) > Number(pair))
    ? Number(endPair) - Number(pair) + 1 : 0;

  const handleFinish = (v) => {
    onSave({
      title: v.title,
      group: v.group || '',
      date_plan: v.date_plan ? v.date_plan.toISOString() : dayjs().toISOString(),
      status: v.status || 'planned',
      time_slot: currentSlotCode(),
      materials: [
        ...(v.materials || []).map((id) => ({ type: 'work', id, title: worksMap.get(id) || '' })),
        ...fileMaterials,
      ],
    });
  };

  const editingExisting = initial?.id;

  return (
    <Modal
      open={open}
      title={editingExisting ? 'Урок' : 'Новый урок'}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={saving}
      okText="Сохранить"
      cancelText="Отмена"
      okButtonProps={{ disabled: !canEdit }}
      destroyOnHidden
      footer={(_, { OkBtn, CancelBtn }) => (
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <span>
            {editingExisting && canEdit && (
              <Popconfirm title="Удалить урок?" okText="Удалить" cancelText="Отмена" okButtonProps={{ danger: true }} onConfirm={onDelete}>
                <Button danger>Удалить</Button>
              </Popconfirm>
            )}
          </span>
          <Space><CancelBtn /><OkBtn /></Space>
        </Space>
      )}
    >
      <Form form={form} layout="vertical" onFinish={handleFinish} style={{ marginTop: 8 }} disabled={!canEdit}>
        <Form.Item name="title" label="Тема урока" rules={[{ required: true, message: 'Введите тему' }]}>
          <Input placeholder="Тема урока" maxLength={500} autoFocus />
        </Form.Item>
        <Space size="large" style={{ display: 'flex' }}>
          <Form.Item name="group" label="Группа" style={{ flex: 1 }}>
            <Select allowClear placeholder="Группа" options={groups.map((g) => ({ value: g.id, label: g.name }))} />
          </Form.Item>
          <Form.Item name="status" label="Статус" style={{ flex: 1 }}>
            <Select options={[
              { value: 'planned', label: 'Запланирован' },
              { value: 'done', label: 'Проведён' },
              { value: 'cancelled', label: 'Отменён' },
            ]} />
          </Form.Item>
        </Space>
        <Form.Item label="Время по расписанию" style={{ marginBottom: 8 }}>
          <Space direction="vertical" size={6} style={{ width: '100%' }}>
            <Segmented value={mode}
              onChange={(m) => {
                setMode(m);
                if (m === 'intensive') { if (pair) applyIntensive(pair, endPair); }
                else if (pair) applySlot(pair, part);
              }}
              options={[
                { value: 'single', label: 'Пара' },
                { value: 'intensive', label: 'Интенсив (2–4 пары)' },
              ]} />
            {mode === 'single' ? (
              <Space wrap>
                <Select allowClear placeholder="— своё время —" style={{ width: 150 }}
                  value={pair ?? undefined}
                  onChange={(v) => applySlot(v ?? null, v === '0' ? 'full' : part)}
                  options={PAIRS.map((p) => ({ value: p.key, label: p.label }))} />
                <Segmented value={part} disabled={!pair || pair === '0'}
                  onChange={(v) => applySlot(pair, v)}
                  options={[
                    { value: 'full', label: 'Вся пара' },
                    { value: '1', label: '1-я пол.' },
                    { value: '2', label: '2-я пол.' },
                  ]} />
                {slotRange && <Chip tone="blue" dot={false}>{slotRange[0]}–{slotRange[1]}</Chip>}
              </Space>
            ) : (
              <Space wrap>
                <Select placeholder="с пары" style={{ width: 130 }} value={pair ?? undefined}
                  onChange={(v) => applyIntensive(v ?? null, endPair)}
                  options={PAIRS.map((p) => ({ value: p.key, label: p.label }))} />
                <span>→</span>
                <Select placeholder="по пару" style={{ width: 130 }} value={endPair ?? undefined}
                  onChange={(v) => applyIntensive(pair, v ?? null)}
                  options={PAIRS.map((p) => ({ value: p.key, label: p.label }))} />
                {slotRange && (
                  <Chip tone="violet" dot={false}>{slotRange[0]}–{slotRange[1]} · {intensiveCount} пары</Chip>
                )}
                {pair && endPair && Number(endPair) <= Number(pair) && (
                  <Typography.Text type="danger" style={{ fontSize: 12 }}>конец должен быть позже начала</Typography.Text>
                )}
              </Space>
            )}
          </Space>
        </Form.Item>
        <Form.Item name="date_plan" label="Дата и время" rules={[{ required: true }]}>
          <DatePicker showTime={{ format: 'HH:mm' }} format="DD.MM.YYYY HH:mm" style={{ width: '100%' }}
            onChange={(d) => { if (d) { const g = guessSlot(d.toDate()); setPair(g.pair); setPart(g.part); } }} />
        </Form.Item>
        <Form.Item name="materials" label="Материалы урока (работы)">
          <Select
            mode="multiple"
            allowClear
            placeholder="Привязать работы к уроку"
            optionFilterProp="label"
            options={(works || []).map((w) => ({ value: w.id, label: w.title }))}
          />
        </Form.Item>
      </Form>

      {/* Файлы из Библиотеки (pb-files) */}
      <div style={{ marginBottom: 12 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 4 }}>
          <Typography.Text strong style={{ fontSize: 13 }}>
            <PaperClipOutlined /> Файлы из Библиотеки
          </Typography.Text>
          {canEdit && (
            <Button size="small" icon={<PaperClipOutlined />} onClick={() => setPickerOpen(true)}>
              Прикрепить
            </Button>
          )}
        </Space>
        {fileMaterials.length === 0 ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>Нет прикреплённых файлов</Typography.Text>
        ) : (
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            {fileMaterials.map((m) => (
              <Space key={m.id} style={{ width: '100%', justifyContent: 'space-between' }}>
                <a href={m.url} target="_blank" rel="noreferrer">
                  <DownloadOutlined /> {m.title}
                </a>
                {canEdit && (
                  <Button size="small" type="text" danger icon={<DeleteOutlined />}
                    onClick={() => setFileMaterials((prev) => prev.filter((x) => x.id !== m.id))} />
                )}
              </Space>
            ))}
          </Space>
        )}
      </div>

      <MaterialPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        existingIds={fileMaterials.map((m) => m.id)}
        onPick={(picked) => setFileMaterials((prev) => {
          const seen = new Set(prev.map((x) => x.id));
          return [...prev, ...picked.filter((p) => !seen.has(p.id))];
        })}
      />

      {/* Быстрый переход к материалам: выдача, результаты, работа над ошибками */}
      {materialIds.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>Открыть материал (выдача · результаты · работа над ошибками):</Typography.Text>
          <div style={{ marginTop: 4 }}>
            {materialIds.map((id) => (
              <Button key={id} size="small" type="link" icon={<LinkOutlined />} style={{ paddingLeft: 0 }} onClick={() => onOpenMaterial(id)}>
                {worksMap.get(id) || 'Работа'}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Заметка урока = общая заметка (BlockNote + формулы) */}
      <div style={{ marginTop: 8 }}>
        {editingExisting ? (
          <Button icon={<FileTextOutlined />} onClick={() => onOpenNote(initial)} block>
            Открыть заметку урока (формулы, блоки)
          </Button>
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Сохраните урок, чтобы добавить заметку с формулами.
          </Typography.Text>
        )}
      </div>
    </Modal>
  );
}

export default function TeacherCalendar() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { canEdit } = useAuth();

  const [groups, setGroups] = useState([]);
  const [works, setWorks] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [groupFilter, setGroupFilter] = useState(null);
  const [showDeadlines, setShowDeadlines] = useState(true);
  const [view, setView] = useState(Views.MONTH);
  const [date, setDate] = useState(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [g, l, d, w] = await Promise.all([
        api.getTeachingGroups(),
        api.getLessons(),
        api.getSessionsWithDeadline(),
        api.getWorks(),
      ]);
      setGroups(g);
      setLessons(l);
      setDeadlines(d);
      setWorks(w);
    } catch {
      message.error('Не удалось загрузить календарь');
    }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const events = useMemo(() => {
    const lessonEvents = lessons
      .filter((l) => !groupFilter || l.group === groupFilter)
      .map((l) => {
        const start = new Date(l.date_plan);
        const hasMaterials = Array.isArray(l.materials) && l.materials.length > 0;
        return {
          id: l.id,
          title: hasMaterials ? `📎 ${l.title}` : l.title,
          start,
          end: endForLesson(l, start),
          resource: { type: 'lesson', raw: l, groupName: l.expand?.group?.name, status: l.status || 'planned' },
        };
      });

    const deadlineEvents = showDeadlines
      ? deadlines.map((s) => {
          const start = new Date(s.deadline);
          const t = s.expand?.work?.title || s.student_title || s.expand?.mc_test?.title || s.expand?.trig_mc_test?.title || 'Работа';
          return {
            id: `dl_${s.id}`,
            title: `⏰ ${t}`,
            start,
            end: start,
            allDay: true,
            resource: { type: 'deadline', raw: s },
          };
        })
      : [];

    return [...lessonEvents, ...deadlineEvents];
  }, [lessons, deadlines, groupFilter, showDeadlines]);

  const eventPropGetter = useCallback((event) => {
    const r = event.resource;
    if (r?.type === 'deadline') {
      return { className: 'rbc-evt-deadline' };
    }
    const status = r?.status;
    // Цвет блока = группа (единый «язык» цвета во всём разделе). Нет группы → акцент.
    const hex = groupHex(r?.raw?.group || '');
    let cls = 'rbc-evt-lesson';
    if (status === 'done') cls += ' rbc-evt-done';
    else if (status === 'cancelled') cls += ' rbc-evt-cancelled';
    return { className: cls, style: { backgroundColor: hex.base, borderColor: hex.base } };
  }, []);

  const persistLessonDate = async (lessonId, start) => {
    // оптимистично
    setLessons((prev) => prev.map((l) => (l.id === lessonId ? { ...l, date_plan: start.toISOString() } : l)));
    try {
      await api.updateLesson(lessonId, { date_plan: start.toISOString() });
    } catch {
      message.error('Не удалось перенести урок');
      load();
    }
  };

  const persistDeadline = async (sessionId, start) => {
    setDeadlines((prev) => prev.map((s) => (s.id === sessionId ? { ...s, deadline: start.toISOString() } : s)));
    try {
      await api.updateSession(sessionId, { deadline: start.toISOString() });
    } catch {
      message.error('Не удалось перенести дедлайн');
      load();
    }
  };

  const onEventDrop = useCallback(({ event, start }) => {
    if (!canEdit) return;
    const r = event.resource;
    if (r?.type === 'lesson') persistLessonDate(r.raw.id, start);
    else if (r?.type === 'deadline') persistDeadline(r.raw.id, start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit]);

  const onSelectSlot = useCallback(({ start }) => {
    if (!canEdit) return;
    setEditing({ slotDate: start, group: groupFilter || undefined });
    setModalOpen(true);
  }, [canEdit, groupFilter]);

  const onSelectEvent = useCallback((event) => {
    const r = event.resource;
    if (r?.type === 'lesson') {
      setEditing(r.raw);
      setModalOpen(true);
    } else if (r?.type === 'deadline') {
      message.info(`Дедлайн: ${event.title.replace('⏰ ', '')} — ${dayjs(event.start).format('DD.MM.YYYY HH:mm')}`);
    }
  }, [message]);

  const handleSave = async (data) => {
    setSaving(true);
    try {
      if (editing?.id) {
        await api.updateLesson(editing.id, data);
      } else {
        await api.createLesson(data);
      }
      setModalOpen(false);
      setEditing(null);
      load();
    } catch {
      message.error('Не удалось сохранить урок');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenNote = async (lesson) => {
    try {
      const note = await api.getOrCreateLessonNote(lesson);
      navigate(`/app/notes?note=${note.id}`);
    } catch {
      message.error('Не удалось открыть заметку урока');
    }
  };

  const handleOpenMaterial = (workId) => {
    setModalOpen(false);
    navigate(`/app/works/${workId}/edit`);
  };

  const handleDelete = async () => {
    if (!editing?.id) return;
    try {
      await api.deleteLesson(editing.id);
      setModalOpen(false);
      setEditing(null);
      load();
    } catch {
      message.error('Не удалось удалить урок');
    }
  };

  return (
    <div>
      <WorkspacePageHeader
        icon={<CalendarOutlined />}
        accent="blue"
        title="Календарь"
        subtitle="Уроки и дедлайны выдач на сетке · перетащите событие, чтобы перенести"
        extra={(
          <>
            <Select
              allowClear
              style={{ minWidth: 180 }}
              placeholder="Все группы"
              value={groupFilter}
              onChange={setGroupFilter}
              options={groups.map((g) => ({ value: g.id, label: g.name }))}
            />
            <Space size={4}>
              <Switch checked={showDeadlines} onChange={setShowDeadlines} size="small" />
              <Text type="secondary">дедлайны</Text>
            </Space>
            {canEdit && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing({ slotDate: new Date(), group: groupFilter || undefined }); setModalOpen(true); }}>
                Урок
              </Button>
            )}
          </>
        )}
      />

      <div className="teacher-calendar-wrap">
        <DnDCalendar
          localizer={localizer}
          events={events}
          messages={RU_MESSAGES}
          culture="ru"
          views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
          view={view}
          onView={setView}
          date={date}
          onNavigate={setDate}
          popup
          selectable={canEdit}
          resizable={false}
          onEventDrop={onEventDrop}
          onSelectSlot={onSelectSlot}
          onSelectEvent={onSelectEvent}
          eventPropGetter={eventPropGetter}
          draggableAccessor={() => canEdit}
          style={{ height: 'calc(100vh - 230px)', minHeight: 520 }}
        />
      </div>

      <Space style={{ marginTop: 12 }} wrap size={[8, 6]}>
        <Text type="secondary" style={{ fontSize: 12 }}>Легенда:</Text>
        <Chip tone="neutral" dot={false}>цвет блока = группа</Chip>
        <Text type="secondary" style={{ fontSize: 12 }}>проведённый — бледнее, отменённый — зачёркнут</Text>
        <Chip tone="amber">дедлайн выдачи</Chip>
      </Space>

      <LessonModal
        open={modalOpen}
        initial={editing}
        groups={groups}
        saving={saving}
        works={works}
        canEdit={canEdit}
        onSave={handleSave}
        onDelete={handleDelete}
        onOpenNote={handleOpenNote}
        onOpenMaterial={handleOpenMaterial}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
      />
    </div>
  );
}
