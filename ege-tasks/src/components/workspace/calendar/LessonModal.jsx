import { useEffect, useMemo, useState } from 'react';
import {
  Button, DatePicker, Form, Input, Modal, Popconfirm, Segmented, Select, Space, Typography,
} from 'antd';
import {
  FileTextOutlined, LinkOutlined, PaperClipOutlined, DeleteOutlined, DownloadOutlined,
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
  open, initial, groups, works, onSave, onDelete, onCancel, onOpenNote, onOpenMaterial, saving, canEdit,
}) {
  const [form] = Form.useForm();
  const materialIds = Form.useWatch('materials', form) || [];
  const watchedGroup = Form.useWatch('group', form);
  const worksMap = useMemo(() => new Map((works || []).map((w) => [w.id, w.title])), [works]);
  const [fileMaterials, setFileMaterials] = useState([]);
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
        materials: all.filter((m) => m.type !== 'material').map((m) => m.id),
      });
      setFileMaterials(all.filter((m) => m.type === 'material'));
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

      <div style={{ margin: '4px 0 12px', paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
        {editingExisting ? (
          <AttendanceRoster lessonId={initial.id} groupId={watchedGroup} canEdit={canEdit} />
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

      {noteFiles.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <Typography.Text strong style={{ fontSize: 13 }}>
            <FileTextOutlined /> Файлы заметки урока
          </Typography.Text>
          <Space direction="vertical" size={2} style={{ width: '100%', marginTop: 4 }}>
            {noteFiles.map((m) => (
              <Space key={m.id} style={{ width: '100%', justifyContent: 'space-between' }}>
                <a href={m.url} target="_blank" rel="noreferrer">
                  <DownloadOutlined /> {m.title}
                </a>
                <Chip tone="violet" dot={false}>из заметки</Chip>
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
