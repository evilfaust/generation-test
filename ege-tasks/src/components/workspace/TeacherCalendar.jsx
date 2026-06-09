import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, dayjsLocalizer, Views } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import {
  App, Button, DatePicker, Form, Input, Modal, Popconfirm, Select, Space, Switch, Tag, Typography,
} from 'antd';
import { FileTextOutlined, LinkOutlined, PlusOutlined, PaperClipOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import MaterialPickerModal from './MaterialPickerModal';
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

const { Title, Text } = Typography;
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

function LessonModal({ open, initial, groups, works, onSave, onDelete, onCancel, onOpenNote, onOpenMaterial, saving, canEdit }) {
  const [form] = Form.useForm();
  const materialIds = Form.useWatch('materials', form) || [];
  const worksMap = useMemo(() => new Map((works || []).map((w) => [w.id, w.title])), [works]);
  // Файлы из Библиотеки (type:'material') живут отдельно от работ (type:'work').
  const [fileMaterials, setFileMaterials] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (open) {
      const all = Array.isArray(initial?.materials) ? initial.materials : [];
      form.setFieldsValue({
        title: initial?.title || '',
        group: initial?.group || undefined,
        date_plan: initial?.date_plan ? dayjs(initial.date_plan) : (initial?.slotDate ? dayjs(initial.slotDate) : dayjs()),
        status: initial?.status || 'planned',
        materials: all.filter((m) => m.type !== 'material').map((m) => m.id),
      });
      setFileMaterials(all.filter((m) => m.type === 'material'));
    }
  }, [open, initial, form]);

  const handleFinish = (v) => {
    onSave({
      title: v.title,
      group: v.group || '',
      date_plan: v.date_plan ? v.date_plan.toISOString() : dayjs().toISOString(),
      status: v.status || 'planned',
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
        <Form.Item name="date_plan" label="Дата и время" rules={[{ required: true }]}>
          <DatePicker showTime={{ format: 'HH:mm' }} format="DD.MM.YYYY HH:mm" style={{ width: '100%' }} />
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
          end: new Date(start.getTime() + 45 * 60 * 1000),
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
    let cls = 'rbc-evt-lesson';
    if (status === 'done') cls += ' rbc-evt-done';
    else if (status === 'cancelled') cls += ' rbc-evt-cancelled';
    return { className: cls };
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
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <div>
          <Title level={4} style={{ margin: 0 }}>Календарь</Title>
          <Text type="secondary">Уроки и дедлайны выдач на сетке · перетащите событие, чтобы перенести</Text>
        </div>
        <Space wrap>
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
        </Space>
      </Space>

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

      <Space style={{ marginTop: 12 }} wrap size={[8, 4]}>
        <Text type="secondary" style={{ fontSize: 12 }}>Легенда:</Text>
        <Tag color="blue">урок</Tag>
        <Tag color="green">проведён</Tag>
        <Tag>отменён</Tag>
        <Tag color="orange">дедлайн выдачи</Tag>
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
