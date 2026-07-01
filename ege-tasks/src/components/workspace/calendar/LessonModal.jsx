import { useEffect, useMemo, useState } from 'react';
import {
  Button, DatePicker, Form, Input, Modal, Popconfirm, Segmented, Select, Space, Switch, Tooltip, Typography,
} from 'antd';
import {
  FileTextOutlined, LinkOutlined, PaperClipOutlined, DeleteOutlined, DownloadOutlined,
  EyeOutlined, EyeInvisibleOutlined, VideoCameraOutlined, PlusOutlined, ReadOutlined, RetweetOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import MaterialPickerModal from '../MaterialPickerModal';
import AttendanceRoster from '../AttendanceRoster';
import { Chip } from '../ui';
import { PAIRS, guessSlot, slotRangeFromCode } from '../lessonTime';
import { api } from '../../../shared/services/pocketbase';

/**
 * Полная форма урока (создание/правка) + посещаемость + материалы + заметка.
 * Вынесена из TeacherCalendar без изменения поведения (редизайн календаря v3.9.108).
 */
export default function LessonModal({
  open, initial, groups, works, onSave, onDelete, onCancel, onOpenNote, onOpenMaterial, onRepeat, saving, canEdit,
}) {
  const [form] = Form.useForm();
  const materialIds = Form.useWatch('materials', form) || [];
  const watchedGroup = Form.useWatch('group', form);
  const worksMap = useMemo(() => new Map((works || []).map((w) => [w.id, w.title])), [works]);
  const selectedGroup = useMemo(
    () => (groups || []).find((g) => g.id === watchedGroup) || null,
    [groups, watchedGroup],
  );
  const isCourse = selectedGroup?.kind === 'course';
  const [fileMaterials, setFileMaterials] = useState([]);
  const [sessionItems, setSessionItems] = useState([]); // ДЗ/тесты: ссылки на выданные сессии
  const [textItems, setTextItems] = useState([]);        // текстовые задания/объявления
  const [coursePublished, setCoursePublished] = useState(true);
  const [newText, setNewText] = useState('');
  // Пикер ДЗ-работы: работы с выданными сессиями.
  const [workSessions, setWorkSessions] = useState({}); // workId -> sessions[]
  const [hw, setHw] = useState({ work: undefined, session: undefined, title: '', role: 'homework' });
  const [hwBusy, setHwBusy] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [newLink, setNewLink] = useState({ title: '', code: '', role: 'homework' });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [noteFiles, setNoteFiles] = useState([]);
  const [mode, setMode] = useState('single');
  const [pair, setPair] = useState(null);
  const [part, setPart] = useState('full');
  const [endPair, setEndPair] = useState(null);

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
        conference_url: initial?.conference_url || '',
        materials: all.filter((m) => m.type === 'work').map((m) => m.id),
      });
      setFileMaterials(all.filter((m) => m.type === 'material'));
      setSessionItems(all.filter((m) => m.type === 'session'));
      setTextItems(all.filter((m) => m.type === 'text'));
      const ts = initial?.time_slot || '';
      const inten = /^(\d)-(\d)$/.exec(ts);
      const half = /^(\d)([ab])$/.exec(ts);
      if (inten) { setMode('intensive'); setPair(inten[1]); setEndPair(inten[2]); setPart('full'); }
      else if (half) { setMode('single'); setPair(half[1]); setPart(half[2] === 'a' ? '1' : '2'); setEndPair(null); }
      else if (ts && PAIRS.some((p) => p.key === ts)) { setMode('single'); setPair(ts); setPart('full'); setEndPair(null); }
      else if (initial?.slotPair) { setMode('single'); setPair(initial.slotPair); setPart('full'); setEndPair(null); }
      else { const g = guessSlot(startDate.toDate()); setMode('single'); setPair(g.pair); setPart(g.part); setEndPair(null); }
    }
  }, [open, initial, form]);

  // Флаг «показывать ученикам курса» — из существующей витрины (по умолчанию да).
  useEffect(() => {
    let cancelled = false;
    if (!open) return undefined;
    setCoursePublished(true);
    setNewLink({ title: '', code: '', role: 'homework' });
    setNewText('');
    setHw({ work: undefined, session: undefined, title: '', role: 'homework' });
    setManualMode(false);
    if (initial?.id) {
      api.getLessonPublication(initial.id)
        .then((pub) => { if (!cancelled && pub) setCoursePublished(pub.published !== false); })
        .catch(() => { /* нет витрины — оставляем default */ });
    }
    return () => { cancelled = true; };
  }, [open, initial?.id]);

  // Сессии работ — для пикера ДЗ (только работы с выданной сессией можно дать ученику).
  useEffect(() => {
    let cancelled = false;
    if (!open || !isCourse || !(works || []).length) { setWorkSessions({}); return undefined; }
    api.getSessionsByWorks(works.map((w) => w.id))
      .then((sess) => {
        if (cancelled) return;
        const map = {};
        sess.forEach((s) => { (map[s.work] ||= []).push(s); });
        setWorkSessions(map);
      })
      .catch(() => { if (!cancelled) setWorkSessions({}); });
    return () => { cancelled = true; };
  }, [open, isCourse, works]);

  useEffect(() => {
    let cancelled = false;
    if (!open || !initial?.id) { setNoteFiles([]); return undefined; }
    api.getLessonNote(initial.id)
      .then((note) => {
        if (cancelled) return;
        const links = Array.isArray(note?.links) ? note.links : [];
        setNoteFiles(links.filter((l) => l.type === 'material'));
      })
      .catch(() => { if (!cancelled) setNoteFiles([]); });
    return () => { cancelled = true; };
  }, [open, initial?.id]);

  const setStartTime = (str) => {
    const [h, m] = str.split(':').map(Number);
    const cur = form.getFieldValue('date_plan') || dayjs();
    form.setFieldsValue({ date_plan: dayjs(cur).hour(h).minute(m).second(0).millisecond(0) });
  };

  const applySlot = (p, prt) => {
    setPair(p);
    setPart(prt);
    if (!p) return;
    const def = PAIRS.find((x) => x.key === p);
    if (def) setStartTime((p === '0' || prt === 'full') ? def.full[0] : (prt === '1' ? def.halves[0][0] : def.halves[1][0]));
  };

  const applyIntensive = (s, e) => {
    setPair(s);
    setEndPair(e);
    if (!s) return;
    const def = PAIRS.find((x) => x.key === s);
    if (def) setStartTime(def.full[0]);
  };

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
      conference_url: (v.conference_url || '').trim(),
      materials: [
        ...(v.materials || []).map((id) => ({ type: 'work', id, title: worksMap.get(id) || '' })),
        ...fileMaterials,
        ...sessionItems,
        ...textItems,
      ],
    }, { published: coursePublished });
  };

  // Извлечь код сессии из ссылки или взять как есть (15-символьный id).
  const parseSessionCode = (raw) => {
    const s = (raw || '').trim();
    const m = s.match(/\/student\/([a-z0-9]{6,})/i);
    return m ? m[1] : s;
  };
  const addSessionItem = () => {
    const id = parseSessionCode(newLink.code);
    if (!id) return;
    setSessionItems((prev) => [
      ...prev,
      { type: 'session', id, title: (newLink.title || '').trim() || 'Домашняя работа', role: newLink.role, visible: true },
    ]);
    setNewLink({ title: '', code: '', role: 'homework' });
  };
  const addTextItem = () => {
    const text = (newText || '').trim();
    if (!text) return;
    setTextItems((prev) => [...prev, { type: 'text', text, role: 'homework', visible: true }]);
    setNewText('');
  };
  // Выбор работы из списка. Если у работы уже есть сессия — берём её; иначе
  // сессия будет выдана при нажатии «Добавить».
  const selectHwWork = (workId) => {
    const sess = workSessions[workId] || [];
    setHw((s) => ({ ...s, work: workId, session: sess[0]?.id, title: worksMap.get(workId) || '' }));
  };
  const addHwFromWork = async () => {
    if (!hw.work) return;
    setHwBusy(true);
    try {
      let sessionId = hw.session;
      // Нет выданной сессии → выдаём работу ученикам (открытая сессия).
      if (!sessionId) {
        const title = (hw.title || '').trim() || worksMap.get(hw.work) || 'Домашняя работа';
        const rec = await api.createSession({ work: hw.work, is_open: true, student_title: title });
        sessionId = rec.id;
        setWorkSessions((prev) => ({ ...prev, [hw.work]: [rec, ...(prev[hw.work] || [])] }));
      }
      setSessionItems((prev) => [
        ...prev,
        { type: 'session', id: sessionId, title: (hw.title || '').trim() || worksMap.get(hw.work) || 'Работа', role: hw.role, visible: true },
      ]);
      setHw({ work: undefined, session: undefined, title: '', role: 'homework' });
    } catch (e) {
      console.error('addHwFromWork', e?.message);
    } finally {
      setHwBusy(false);
    }
  };
  // Перенести файл из заметки в «Файлы из Библиотеки» (там есть глаз/роль → публикуется).
  const showNoteFileToStudents = (m) => {
    setFileMaterials((prev) => (prev.some((x) => x.id === m.id)
      ? prev
      : [...prev, { type: 'material', id: m.id, title: m.title, url: m.url, visible: true, role: 'class' }]));
  };
  // Переключатели видимости/роли для файла из Библиотеки.
  const patchFile = (id, patch) => setFileMaterials((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));

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
      width={isCourse ? 720 : 560}
      destroyOnHidden
      footer={(_, { OkBtn, CancelBtn }) => (
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            {editingExisting && canEdit && (
              <Popconfirm title="Удалить урок?" okText="Удалить" cancelText="Отмена" okButtonProps={{ danger: true }} onConfirm={onDelete}>
                <Button danger>Удалить</Button>
              </Popconfirm>
            )}
            {editingExisting && canEdit && onRepeat && (
              <Button icon={<RetweetOutlined />} onClick={() => onRepeat(initial)} title="Запланировать серию занятий по расписанию">
                Повторить серию
              </Button>
            )}
          </Space>
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
        {isCourse && (
          <Form.Item
            name="conference_url"
            label="Ссылка на конференцию (этого занятия)"
            tooltip="Пусто → используется постоянная комната курса. Видна ученикам курса."
          >
            <Input
              prefix={<VideoCameraOutlined />}
              allowClear
              placeholder={selectedGroup?.conference_url ? `по умолчанию: ${selectedGroup.conference_url}` : 'https://telemost.yandex.ru/j/...'}
              maxLength={1000}
            />
          </Form.Item>
        )}
      </Form>

      <div style={{ margin: '4px 0 12px', paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
        {editingExisting ? (
          <AttendanceRoster lessonId={initial.id} groupId={watchedGroup} canEdit={canEdit} isCourse={isCourse} />
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Сохраните урок, чтобы отметить посещаемость.
          </Typography.Text>
        )}
      </div>

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
              <Space key={m.id} style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                <a href={m.url} target="_blank" rel="noreferrer">
                  <DownloadOutlined /> {m.title}
                </a>
                <Space size={4}>
                  {isCourse && canEdit && (
                    <>
                      <Segmented
                        size="small"
                        value={m.role === 'homework' ? 'homework' : 'class'}
                        onChange={(v) => patchFile(m.id, { role: v })}
                        options={[{ value: 'class', label: 'Классн.' }, { value: 'homework', label: 'ДЗ' }]}
                      />
                      <Tooltip title={m.visible === false ? 'Скрыт от учеников' : 'Виден ученикам'}>
                        <Button
                          size="small"
                          type="text"
                          icon={m.visible === false ? <EyeInvisibleOutlined /> : <EyeOutlined style={{ color: '#52c41a' }} />}
                          onClick={() => patchFile(m.id, { visible: m.visible === false })}
                        />
                      </Tooltip>
                    </>
                  )}
                  {canEdit && (
                    <Button size="small" type="text" danger icon={<DeleteOutlined />}
                      onClick={() => setFileMaterials((prev) => prev.filter((x) => x.id !== m.id))} />
                  )}
                </Space>
              </Space>
            ))}
          </Space>
        )}
      </div>

      {isCourse && (
        <div style={{ margin: '4px 0 12px', padding: '10px 12px', borderRadius: 8, background: 'rgba(114,46,209,0.06)', border: '1px solid rgba(114,46,209,0.18)' }}>
          <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }} wrap>
            <Typography.Text strong style={{ fontSize: 13 }}>
              <ReadOutlined /> Кабинет ученика курса
            </Typography.Text>
            <Space size={6}>
              <Typography.Text style={{ fontSize: 12 }}>Показывать ученикам</Typography.Text>
              <Switch size="small" checked={coursePublished} onChange={setCoursePublished} disabled={!canEdit} />
            </Space>
          </Space>
          <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 10 }}>
            Ученики курса увидят расписание, ссылку на конференцию и отмеченные материалы.
            Файлы из Библиотеки помечайте <EyeOutlined style={{ color: '#52c41a' }} /> (виден) и «Классн./ДЗ».
            Файл из заметки — кнопкой «Показать ученикам». ДЗ-тесты выбирайте из списка ваших работ.
          </Typography.Paragraph>

          {/* ДЗ / тесты — ссылки на выданные сессии */}
          <Typography.Text strong style={{ fontSize: 12 }}>Задания-ссылки (ДЗ / тесты)</Typography.Text>
          {sessionItems.length > 0 && (
            <Space direction="vertical" size={2} style={{ width: '100%', margin: '4px 0' }}>
              {sessionItems.map((it, idx) => (
                <Space key={`${it.id}-${idx}`} style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                  <span>
                    <LinkOutlined /> {it.title}{' '}
                    <Chip tone={it.role === 'homework' ? 'amber' : 'blue'} dot={false}>
                      {it.role === 'homework' ? 'ДЗ' : 'классн.'}
                    </Chip>{' '}
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>/student/{it.id}</Typography.Text>
                  </span>
                  {canEdit && (
                    <Button size="small" type="text" danger icon={<DeleteOutlined />}
                      onClick={() => setSessionItems((prev) => prev.filter((_, i) => i !== idx))} />
                  )}
                </Space>
              ))}
            </Space>
          )}
          {canEdit && !manualMode && (
            <div style={{ marginTop: 6 }}>
              <Space.Compact style={{ width: '100%' }}>
                <Select
                  showSearch
                  style={{ flex: 1 }}
                  placeholder="Выберите работу…"
                  optionFilterProp="label"
                  value={hw.work}
                  onChange={selectHwWork}
                  notFoundContent="Нет работ"
                  options={(works || []).map((w) => ({ value: w.id, label: w.title }))}
                />
                <Select
                  style={{ width: 110 }}
                  value={hw.role}
                  onChange={(v) => setHw((s) => ({ ...s, role: v }))}
                  options={[{ value: 'homework', label: 'ДЗ' }, { value: 'class', label: 'Классн.' }]}
                />
                <Button type="primary" icon={<PlusOutlined />} onClick={addHwFromWork} disabled={!hw.work} loading={hwBusy}>
                  Добавить
                </Button>
              </Space.Compact>
              {hw.work && (workSessions[hw.work] || []).length > 1 && (
                <Select
                  size="small"
                  style={{ width: '100%', marginTop: 6 }}
                  value={hw.session}
                  onChange={(v) => setHw((s) => ({ ...s, session: v }))}
                  options={(workSessions[hw.work] || []).map((sess) => ({
                    value: sess.id,
                    label: `выдача от ${dayjs(sess.created).format('DD.MM.YYYY')}${sess.is_open ? ' · открыта' : ''}`,
                  }))}
                />
              )}
              {hw.work && !(workSessions[hw.work] || []).length && (
                <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                  У этой работы ещё нет выдачи — при добавлении она будет автоматически выдана ученикам курса (откроется доступ).
                </Typography.Text>
              )}
              <Typography.Link style={{ fontSize: 11 }} onClick={() => setManualMode(true)}>
                или вставить код сессии вручную
              </Typography.Link>
            </div>
          )}
          {canEdit && manualMode && (
            <div style={{ marginTop: 6 }}>
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  style={{ width: '40%' }}
                  placeholder="Название (напр. ДЗ №3)"
                  value={newLink.title}
                  onChange={(e) => setNewLink((s) => ({ ...s, title: e.target.value }))}
                />
                <Input
                  style={{ width: '36%' }}
                  placeholder="Код сессии или /student/..."
                  value={newLink.code}
                  onChange={(e) => setNewLink((s) => ({ ...s, code: e.target.value }))}
                  onPressEnter={addSessionItem}
                />
                <Select
                  style={{ width: 90 }}
                  value={newLink.role}
                  onChange={(v) => setNewLink((s) => ({ ...s, role: v }))}
                  options={[{ value: 'homework', label: 'ДЗ' }, { value: 'class', label: 'Классн.' }]}
                />
                <Button icon={<PlusOutlined />} onClick={addSessionItem} disabled={!newLink.code.trim()} />
              </Space.Compact>
              <Typography.Link style={{ fontSize: 11 }} onClick={() => setManualMode(false)}>
                ← выбрать работу из списка
              </Typography.Link>
            </div>
          )}

          {/* Текстовые задания / объявления */}
          <div style={{ marginTop: 12 }}>
            <Typography.Text strong style={{ fontSize: 12 }}>Текст для учеников</Typography.Text>
            {textItems.length > 0 && (
              <Space direction="vertical" size={2} style={{ width: '100%', margin: '4px 0' }}>
                {textItems.map((it, idx) => (
                  <Space key={idx} style={{ width: '100%', justifyContent: 'space-between' }} align="start">
                    <span style={{ fontSize: 13 }}>📝 {it.text}</span>
                    {canEdit && (
                      <Button size="small" type="text" danger icon={<DeleteOutlined />}
                        onClick={() => setTextItems((prev) => prev.filter((_, i) => i !== idx))} />
                    )}
                  </Space>
                ))}
              </Space>
            )}
            {canEdit && (
              <Space.Compact style={{ width: '100%', marginTop: 4 }}>
                <Input
                  placeholder="Напр.: повторить формулы сокращённого умножения"
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  onPressEnter={addTextItem}
                />
                <Button icon={<PlusOutlined />} onClick={addTextItem} disabled={!newText.trim()} />
              </Space.Compact>
            )}
          </div>
        </div>
      )}

      {noteFiles.filter((m) => !fileMaterials.some((fm) => fm.id === m.id)).length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <Typography.Text strong style={{ fontSize: 13 }}>
            <FileTextOutlined /> Файлы заметки урока
          </Typography.Text>
          <Space direction="vertical" size={2} style={{ width: '100%', marginTop: 4 }}>
            {noteFiles.filter((m) => !fileMaterials.some((fm) => fm.id === m.id)).map((m) => (
              <Space key={m.id} style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                <a href={m.url} target="_blank" rel="noreferrer">
                  <DownloadOutlined /> {m.title}
                </a>
                <Space size={4}>
                  {isCourse && canEdit && (
                    <Button size="small" icon={<EyeOutlined style={{ color: '#52c41a' }} />} onClick={() => showNoteFileToStudents(m)}>
                      Показать ученикам
                    </Button>
                  )}
                  <Chip tone="violet" dot={false}>из заметки</Chip>
                </Space>
              </Space>
            ))}
          </Space>
        </div>
      )}

      <MaterialPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        existingIds={fileMaterials.map((m) => m.id)}
        onPick={(picked) => setFileMaterials((prev) => {
          const seen = new Set(prev.map((x) => x.id));
          return [...prev, ...picked.filter((p) => !seen.has(p.id))];
        })}
      />

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
