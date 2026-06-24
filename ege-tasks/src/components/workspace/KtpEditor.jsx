import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App, Button, DatePicker, Form, Input, InputNumber, Modal, Popconfirm,
  Select, Space, Spin, Switch, Table, Tooltip, Typography,
} from 'antd';
import {
  ArrowLeftOutlined, ArrowUpOutlined, ArrowDownOutlined, DeleteOutlined, EditOutlined,
  FileWordOutlined, PlusOutlined, PrinterOutlined, ScheduleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../shared/services/pocketbase';
import { useAuth } from '../../contexts/AuthContext';
import { useReferenceData } from '../../contexts/ReferenceDataContext';
import { exportKtpToWord } from '../../utils/ktpDocx';
import KtpPrintView from './KtpPrintView';
import { WorkspacePageHeader, EmptyState, GroupChip, groupTone } from './ui';

const { Text } = Typography;

function topicLabel(t) {
  return `${t.ege_number ? `№${t.ege_number} — ` : ''}${t.title}`;
}

function EntryModal({ open, initial, topics, onSave, onCancel, saving }) {
  const [form] = Form.useForm();
  const isSection = Form.useWatch('is_section', form);

  useEffect(() => {
    if (open) {
      form.setFieldsValue(
        initial
          ? {
              title: initial.title,
              topic: initial.topic || undefined,
              hours: initial.hours ?? null,
              week_no: initial.week_no ?? null,
              planned_date: initial.planned_date ? dayjs(initial.planned_date) : null,
              planned_results: initial.planned_results || '',
              is_section: !!initial.is_section,
            }
          : { title: '', topic: undefined, hours: null, week_no: null, planned_date: null, planned_results: '', is_section: false },
      );
    }
  }, [open, initial, form]);

  const handleFinish = (values) => {
    onSave({
      title: values.title,
      topic: values.topic || '',
      hours: values.hours,
      week_no: values.week_no,
      planned_date: values.planned_date ? values.planned_date.toISOString() : '',
      planned_results: values.planned_results || '',
      is_section: !!values.is_section,
    });
  };

  return (
    <Modal
      open={open}
      title={initial ? 'Строка КТП' : 'Новая строка'}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={saving}
      okText="Сохранить"
      cancelText="Отмена"
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={handleFinish} style={{ marginTop: 8 }}>
        <Form.Item name="is_section" label="Раздел-заголовок" valuePropName="checked" extra="Строка-заголовок раздела (без часов/даты)">
          <Switch />
        </Form.Item>
        <Form.Item name="title" label="Тема" rules={[{ required: true, message: 'Введите тему' }]}>
          <Input.TextArea autoSize={{ minRows: 1, maxRows: 3 }} placeholder="Тема урока / раздела" maxLength={500} />
        </Form.Item>
        {!isSection && (
          <>
            <Form.Item name="topic" label="Связь с темой фонда (необязательно)" extra="Для перехода к материалам и аналитике">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Тема из каталога"
                options={topics.map((t) => ({ value: t.id, label: topicLabel(t) }))}
              />
            </Form.Item>
            <Space size="large" style={{ display: 'flex' }}>
              <Form.Item name="hours" label="Часов" style={{ flex: 1 }}>
                <InputNumber min={0} step={0.5} style={{ width: '100%' }} placeholder="2" />
              </Form.Item>
              <Form.Item name="week_no" label="Неделя" style={{ flex: 1 }}>
                <InputNumber min={1} max={52} style={{ width: '100%' }} placeholder="3" />
              </Form.Item>
              <Form.Item name="planned_date" label="Дата по плану" style={{ flex: 1.4 }}>
                <DatePicker format="DD.MM.YYYY" style={{ width: '100%' }} placeholder="—" />
              </Form.Item>
            </Space>
            <Form.Item name="planned_results" label="Планируемые результаты">
              <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} placeholder="Что ученик должен освоить (можно коды ФГОС)" maxLength={2000} />
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  );
}

export default function KtpEditor() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { canEdit } = useAuth();
  const { topics } = useReferenceData();

  const [course, setCourse] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [printMode, setPrintMode] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, e] = await Promise.all([api.getCourse(courseId), api.getKtpEntries(courseId)]);
      setCourse(c);
      setEntries(e);
    } catch {
      message.error('Не удалось загрузить КТП');
    } finally {
      setLoading(false);
    }
  }, [courseId, message]);

  useEffect(() => { load(); }, [load]);

  const totalHours = useMemo(
    () => entries.filter((e) => !e.is_section && e.hours != null).reduce((s, e) => s + Number(e.hours || 0), 0),
    [entries],
  );

  const handleSaveEntry = async (data) => {
    setSaving(true);
    try {
      if (editing?.id) {
        await api.updateKtpEntry(editing.id, data);
      } else {
        await api.createKtpEntry({ ...data, course: courseId, order: entries.length });
      }
      setModalOpen(false);
      setEditing(null);
      load();
    } catch {
      message.error('Не удалось сохранить строку');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteKtpEntry(id);
      load();
    } catch { message.error('Не удалось удалить'); }
  };

  const move = async (index, dir) => {
    const j = index + dir;
    if (j < 0 || j >= entries.length) return;
    const next = [...entries];
    [next[index], next[j]] = [next[j], next[index]];
    setEntries(next); // оптимистично
    try {
      await api.reorderKtpEntries(next.map((e) => e.id));
    } catch {
      message.error('Не удалось изменить порядок');
      load();
    }
  };

  const handleWord = async () => {
    try {
      await exportKtpToWord(course, entries, course?.expand?.group);
    } catch (e) {
      console.error(e);
      message.error('Не удалось сформировать Word');
    }
  };

  // Нумерация только по не-разделам.
  const numberMap = useMemo(() => {
    const m = {};
    let n = 0;
    for (const e of entries) {
      if (!e.is_section) { n += 1; m[e.id] = n; }
    }
    return m;
  }, [entries]);

  if (printMode) {
    return (
      <KtpPrintView
        course={course}
        entries={entries}
        group={course?.expand?.group}
        totalHours={totalHours}
        onBack={() => setPrintMode(false)}
      />
    );
  }

  if (loading && !course) {
    return <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>;
  }
  if (!course) {
    return (
      <EmptyState
        title="КТП не найдено"
        description="Возможно, план был удалён"
        cta="К списку КТП"
        onCta={() => navigate('/app/ktp')}
      />
    );
  }

  const columns = [
    {
      title: '№', key: 'n', width: 50, align: 'center',
      render: (_, e) => (e.is_section ? '' : numberMap[e.id]),
    },
    {
      title: 'Тема', dataIndex: 'title', key: 'title',
      render: (t, e) => e.is_section
        ? <Text strong>{t}</Text>
        : (
          <Space direction="vertical" size={0}>
            <span>{t}</span>
            {e.expand?.topic?.title && e.expand.topic.title !== t && (
              <Text type="secondary" style={{ fontSize: 12 }}>↳ {topicLabel(e.expand.topic)}</Text>
            )}
          </Space>
        ),
    },
    { title: 'Часы', dataIndex: 'hours', key: 'hours', width: 70, align: 'center', render: (h, e) => e.is_section ? '' : (h ?? '') },
    { title: 'Нед.', dataIndex: 'week_no', key: 'week_no', width: 60, align: 'center', render: (w, e) => e.is_section ? '' : (w ?? '') },
    { title: 'Дата', dataIndex: 'planned_date', key: 'planned_date', width: 100, render: (d, e) => e.is_section || !d ? '' : dayjs(d).format('DD.MM.YY') },
    { title: 'Планируемые результаты', dataIndex: 'planned_results', key: 'planned_results', responsive: ['lg'], render: (r, e) => e.is_section ? '' : (r || '') },
    ...(canEdit ? [{
      title: '', key: 'actions', width: 150,
      render: (_, e, idx) => (
        <Space size={2}>
          <Button size="small" type="text" icon={<ArrowUpOutlined />} disabled={idx === 0} onClick={() => move(idx, -1)} />
          <Button size="small" type="text" icon={<ArrowDownOutlined />} disabled={idx === entries.length - 1} onClick={() => move(idx, 1)} />
          <Button size="small" type="text" icon={<EditOutlined />} onClick={() => { setEditing(e); setModalOpen(true); }} />
          <Popconfirm title="Удалить строку?" okText="Удалить" cancelText="Отмена" okButtonProps={{ danger: true }} onConfirm={() => handleDelete(e.id)}>
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    }] : []),
  ];

  return (
    <div style={{ maxWidth: 1200 }}>
      <Space style={{ marginBottom: 12 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/app/ktp')}>К списку КТП</Button>
      </Space>

      <WorkspacePageHeader
        icon={<ScheduleOutlined />}
        accent={course.group ? groupTone(course.group) : 'violet'}
        title={course.title}
        subtitle={(
          <Space size={8} wrap>
            {course.expand?.group?.name && <GroupChip id={course.group} name={course.expand.group.name} />}
            {course.year && <span>{course.year}</span>}
            <span>Всего часов: <b>{totalHours}</b></span>
          </Space>
        )}
        extra={(
          <>
            <Tooltip title="Экспорт в Word (.docx)">
              <Button icon={<FileWordOutlined />} onClick={handleWord}>Word</Button>
            </Tooltip>
            <Tooltip title="Печать / PDF">
              <Button icon={<PrinterOutlined />} onClick={() => setPrintMode(true)}>Печать</Button>
            </Tooltip>
            {canEdit && (
              <>
                <Button onClick={() => { setEditing({ is_section: true }); setModalOpen(true); }}>+ Раздел</Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setModalOpen(true); }}>Строка</Button>
              </>
            )}
          </>
        )}
      />

      <div className="ws-card" style={{ overflow: 'hidden' }}>
        <Table
          rowKey="id"
          size="small"
          loading={loading}
          columns={columns}
          dataSource={entries}
          pagination={false}
          rowClassName={(e) => (e.is_section ? 'ktp-section-row' : '')}
          locale={{
            emptyText: (
              <EmptyState
                title="План пока пуст"
                description="Добавьте первую тему или раздел-заголовок"
                cta={canEdit ? 'Добавить строку' : undefined}
                ctaIcon={<PlusOutlined />}
                onCta={() => { setEditing(null); setModalOpen(true); }}
              />
            ),
          }}
        />
      </div>

      <EntryModal
        open={modalOpen}
        initial={editing && editing.id ? editing : (editing?.is_section ? { is_section: true } : null)}
        topics={topics || []}
        saving={saving}
        onSave={handleSaveEntry}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
      />
    </div>
  );
}
