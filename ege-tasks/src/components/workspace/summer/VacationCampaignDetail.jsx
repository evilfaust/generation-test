import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  App, Button, Card, Collapse, DatePicker, Descriptions, Form, Input, Modal, Popconfirm,
  Progress, Select, Space, Spin, Switch, Table, Tag, Tooltip, Typography,
} from 'antd';
import {
  ArrowLeftOutlined, CheckOutlined, DeleteOutlined, EditOutlined,
  LinkOutlined, PaperClipOutlined, PlusOutlined, UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '../../../shared/services/pocketbase';
import { WorkspacePageHeader, Chip, GroupChip } from '../ui';
import MaterialPickerModal from '../MaterialPickerModal';
import {
  computeCampaignProgress, lastActivityLabel, PACE, PACE_LABEL, PACE_TONE,
} from './campaignProgress';

const { Text, Paragraph } = Typography;

// ─── helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLOR = { draft: 'default', issued: 'blue', archived: 'default' };
const STATUS_LABEL = { draft: 'Черновик', issued: 'Выдано', archived: 'Архив' };
const PROG_STATUS_TAG = {
  issued: <Tag color="blue">Выдана</Tag>,
  done:   <Tag color="green">Готово</Tag>,
  draft:  <Tag color="default">Черновик</Tag>,
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Модал редактирования кампании ───────────────────────────────────────────

function EditCampaignModal({ open, campaign, groups, onClose, onSave }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && campaign) {
      form.setFieldsValue({
        title:        campaign.title,
        season:       campaign.season,
        group:        campaign.group,
        year:         campaign.year,
        deadline:     campaign.deadline ? dayjs(campaign.deadline) : null,
        mode:         campaign.mode,
        status:       campaign.status,
        instructions: campaign.instructions,
      });
    }
  }, [open, campaign, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await onSave({ ...values, deadline: values.deadline ? values.deadline.toISOString() : null });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title="Редактировать кампанию" okText="Сохранить"
      cancelText="Отмена" onOk={handleOk} onCancel={onClose}
      confirmLoading={saving} destroyOnHidden
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="title" label="Название" rules={[{ required: true }]}>
          <Input maxLength={300} />
        </Form.Item>
        <Form.Item name="season" label="Сезон / повод">
          <Input maxLength={80} placeholder="Лето, Зима, Майские праздники…" />
        </Form.Item>
        <Form.Item name="group" label="Группа">
          <Select allowClear placeholder="Выберите группу"
            options={groups.map((g) => ({ value: g.id, label: `${g.name}${g.grade ? ` · ${g.grade} кл.` : ''}` }))}
          />
        </Form.Item>
        <Form.Item name="year" label="Год">
          <Select options={[0, 1, 2].map((d) => { const y = new Date().getFullYear() + d; return { value: y, label: String(y) }; })} />
        </Form.Item>
        <Form.Item name="deadline" label="Дедлайн">
          <DatePicker style={{ width: '100%' }} format="D MMMM YYYY" />
        </Form.Item>
        <Form.Item name="status" label="Статус">
          <Select options={[
            { value: 'draft',    label: 'Черновик' },
            { value: 'issued',   label: 'Выдано' },
            { value: 'archived', label: 'Архив' },
          ]} />
        </Form.Item>
        <Form.Item name="instructions" label="Общая инструкция для учеников">
          <Input.TextArea rows={3} maxLength={2000} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ─── Модал редактирования блока общего задания ────────────────────────────────

function BlockModal({ open, block, onClose, onSave }) {
  const [form] = Form.useForm();
  const [works, setWorks] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loadingWorks, setLoadingWorks] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const { message } = App.useApp();

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      title:      block?.title || '',
      description: block?.description || '',
      work_id:    block?.work_id || null,
      session_id: block?.session_id || null,
      url:        block?.url || '',
      url_label:  block?.url_label || '',
    });
    setFiles(block?.files || []);
    setSessions([]);

    setLoadingWorks(true);
    api.getWorks({ includeArchived: false })
      .then(setWorks)
      .catch(() => message.error('Не удалось загрузить работы'))
      .finally(() => setLoadingWorks(false));

    // Если уже выбрана работа — загрузим её сессии
    if (block?.work_id) loadSessions(block.work_id);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSessions = async (workId) => {
    if (!workId) { setSessions([]); return; }
    try {
      const list = await api.getSessionsByWork(workId);
      setSessions(list);
    } catch { /* ignore */ }
  };

  const handleWorkChange = (workId) => {
    form.setFieldValue('session_id', null);
    loadSessions(workId);
  };

  const handleOk = async () => {
    const values = await form.validateFields();
    const workTitle = works.find((w) => w.id === values.work_id)?.title || '';
    onSave({
      id:          block?.id || uid(),
      title:       values.title,
      description: values.description || '',
      work_id:     values.work_id || null,
      work_title:  workTitle,
      session_id:  values.session_id || null,
      url:         values.url || '',
      url_label:   values.url_label || '',
      files,
    });
    onClose();
  };

  const handleFilePick = (picked) => {
    const newFiles = picked.filter((p) => !files.some((f) => f.id === p.id));
    setFiles((prev) => [...prev, ...newFiles.map((f) => ({ id: f.id, title: f.name || f.title || 'файл', url: f.url || '' }))]);
  };

  return (
    <Modal open={open} title={block?.id ? 'Редактировать блок' : 'Новый блок задания'}
      okText="Сохранить" cancelText="Отмена"
      onOk={handleOk} onCancel={onClose} destroyOnHidden width={560}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="title" label="Название блока" rules={[{ required: true, message: 'Укажите название' }]}>
          <Input placeholder="Вычислительные навыки" maxLength={300} />
        </Form.Item>
        <Form.Item name="description" label="Описание / инструкция">
          <Input.TextArea rows={3} placeholder="Что нужно сделать, сроки, рекомендации…" maxLength={2000} />
        </Form.Item>
        <Form.Item name="work_id" label="Прикрепить работу">
          <Select
            allowClear
            showSearch
            loading={loadingWorks}
            placeholder="Выберите работу из «Моих работ»"
            optionFilterProp="label"
            onChange={handleWorkChange}
            options={works.map((w) => ({ value: w.id, label: w.title || '(без названия)' }))}
          />
        </Form.Item>
        <Form.Item
          noStyle
          shouldUpdate={(prev, cur) => prev.work_id !== cur.work_id}
        >
          {({ getFieldValue }) => getFieldValue('work_id') && sessions.length > 0 ? (
            <Form.Item name="session_id" label="Выдача (сессия)">
              <Select
                allowClear
                placeholder="Выберите выдачу для ученика"
                options={sessions.map((s) => ({
                  value: s.id,
                  label: s.student_title || `Выдача ${dayjs(s.created).format('D MMM')}`,
                }))}
              />
            </Form.Item>
          ) : null}
        </Form.Item>
        <Form.Item label="Ссылка">
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="url_label" noStyle>
              <Input style={{ width: '35%' }} placeholder="Название" maxLength={80} />
            </Form.Item>
            <Form.Item name="url" noStyle>
              <Input style={{ width: '65%' }} placeholder="https://…" maxLength={500} />
            </Form.Item>
          </Space.Compact>
        </Form.Item>

        {/* Файлы */}
        <Form.Item label="Файлы из библиотеки">
          <Space direction="vertical" style={{ width: '100%' }} size={4}>
            {files.map((f) => (
              <Space key={f.id}>
                <PaperClipOutlined style={{ color: '#999' }} />
                <Text>{f.title}</Text>
                <Button type="link" size="small" danger
                  onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))}>
                  убрать
                </Button>
              </Space>
            ))}
            <Button size="small" icon={<PaperClipOutlined />} onClick={() => setPickerOpen(true)}>
              Добавить из библиотеки
            </Button>
          </Space>
        </Form.Item>
      </Form>

      <MaterialPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleFilePick}
        multiple
      />
    </Modal>
  );
}

// ─── Карточка одного блока общего задания ─────────────────────────────────────

function BlockCard({ block, onEdit, onDelete }) {
  return (
    <Card
      size="small"
      style={{ marginBottom: 8 }}
      styles={{ body: { padding: '10px 14px' } }}
      extra={
        <Space size={4}>
          <Button size="small" type="text" icon={<EditOutlined />} onClick={onEdit} />
          <Popconfirm title="Удалить блок?" okText="Да" cancelText="Нет" onConfirm={onDelete}>
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      }
      title={<Text strong>{block.title}</Text>}
    >
      {block.description && (
        <Paragraph type="secondary" style={{ margin: '0 0 8px', fontSize: 13 }}>
          {block.description}
        </Paragraph>
      )}
      <Space wrap size={6}>
        {block.work_id && (
          <Tag icon={<EditOutlined />} color="blue" style={{ cursor: 'default' }}>
            {block.work_title || 'Работа'}
          </Tag>
        )}
        {block.url && (
          <a href={block.url} target="_blank" rel="noopener noreferrer">
            <Tag icon={<LinkOutlined />}>{block.url_label || block.url}</Tag>
          </a>
        )}
        {(block.files || []).map((f) => (
          <Tag key={f.id} icon={<PaperClipOutlined />}>{f.title}</Tag>
        ))}
      </Space>
    </Card>
  );
}

// ─── Сводка прогресса класса ──────────────────────────────────────────────────

// Порядок чипов: сначала то, что требует реакции учителя.
const PACE_ORDER = [PACE.NOT_STARTED, PACE.BEHIND, PACE.ON_TRACK, PACE.DONE];

function ProgressSummary({ progress, reviewedCount, loading, onOpenStudent }) {
  const { totals } = progress;
  const pct = totals.works ? Math.round((totals.done / totals.works) * 100) : 0;
  const dash = loading ? '…' : null;

  const cells = [
    { label: 'Учеников', value: totals.students },
    { label: 'Есть программа', value: totals.withProgram },
    { label: 'Приступили', value: dash ?? `${totals.startedStudents} из ${totals.withProgram}`, color: '#1677ff' },
    { label: 'Сдано работ', value: dash ?? `${totals.done} из ${totals.works}`, color: '#52c41a' },
    {
      label: 'Решаемость',
      value: dash ?? (totals.quality == null ? '—' : `${Math.round(totals.quality * 100)}%`),
    },
    { label: 'Проверено', value: reviewedCount },
  ];

  return (
    <Card size="small" style={{ marginBottom: 16 }}>
      <Space size={32} wrap style={{ width: '100%' }}>
        {cells.map(({ label, value, color }) => (
          <span key={label}>
            <Text type="secondary" style={{ fontSize: 12 }}>{label}</Text><br />
            <Text strong style={{ fontSize: 20, color }}>{value}</Text>
          </span>
        ))}
        <div style={{ flex: 1, minWidth: 180 }}>
          <Progress
            percent={pct}
            size="small"
            status={loading ? 'active' : 'normal'}
            format={() => `${totals.done}/${totals.works} работ сдано`}
          />
        </div>
      </Space>

      {!loading && (totals.works > 0 || totals.notStarted.length > 0) && (
        <Space size={8} wrap style={{ marginTop: 12 }}>
          {PACE_ORDER.filter((p) => totals.pace[p] > 0).map((p) => (
            <Chip key={p} tone={PACE_TONE[p]}>{PACE_LABEL[p]}: {totals.pace[p]}</Chip>
          ))}
          {totals.notStarted.length > 0 && (
            <>
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>Не приступили:</Text>
              {totals.notStarted.slice(0, 8).map((s) => (
                <Button key={s.id} size="small" type="link" style={{ padding: '0 4px', height: 22 }}
                  onClick={() => onOpenStudent(s.id)}>
                  {s.name}
                </Button>
              ))}
              {totals.notStarted.length > 8 && (
                <Text type="secondary" style={{ fontSize: 12 }}>ещё {totals.notStarted.length - 8}</Text>
              )}
            </>
          )}
        </Space>
      )}

      {!loading && totals.works === 0 && (
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
          Прогресс считается по выданным работам. В планах учеников их пока нет —
          файлы, ссылки и устный счёт факта выполнения не оставляют.
        </Text>
      )}
    </Card>
  );
}

// ─── Главный компонент ────────────────────────────────────────────────────────

export default function VacationCampaignDetail() {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();

  const [campaign, setCampaign]   = useState(null);
  const [groups, setGroups]       = useState([]);
  const [students, setStudents]   = useState([]);
  const [programs, setPrograms]   = useState({});
  const [loading, setLoading]     = useState(true);
  const [editOpen, setEditOpen]   = useState(false);
  const [creating, setCreating]   = useState(false);
  const [blockModal, setBlockModal] = useState({ open: false, block: null });
  const [factData, setFactData] = useState(null);        // { items, attempts } — факт по выдачам
  const [factLoading, setFactLoading] = useState(false);
  const saveTimer = useRef(null);

  // Блоки общего задания (из template_config)
  const [blocks, setBlocks] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [camp, grps] = await Promise.all([api.getCampaign(campaignId), api.getTeachingGroups()]);
      setCampaign(camp);
      setGroups(grps);
      setBlocks(camp.template_config?.blocks || []);

      const groupId = camp.group;
      const [st, progs] = await Promise.all([
        groupId ? api.getStudentsByGroup(groupId) : Promise.resolve([]),
        api.getCampaignPrograms(campaignId),
      ]);
      setStudents(st.filter((s) => !s.external));
      setPrograms(progs);
    } catch {
      message.error('Не удалось загрузить кампанию');
    } finally {
      setLoading(false);
    }
  }, [campaignId, message]);

  useEffect(() => { load(); }, [load]);

  // Факт выполнения грузим вторым этапом — страница не ждёт его, чтобы отрисоваться.
  const programIds = useMemo(
    () => Object.values(programs).map((p) => p.id).sort().join(','),
    [programs],
  );

  useEffect(() => {
    if (!programIds) { setFactData(null); return undefined; }
    let cancelled = false;
    (async () => {
      setFactLoading(true);
      try {
        const items = await api.getCampaignProgramItems(programIds.split(','));
        const sessionIds = [...new Set(items.map((i) => i.session).filter(Boolean))];
        const attempts = sessionIds.length
          ? await api.getAttemptsBySessions(sessionIds, {
            fields: 'id,session,status,score,total,submitted_at,created',
          })
          : [];
        if (!cancelled) setFactData({ items, attempts });
      } catch {
        if (!cancelled) setFactData({ items: [], attempts: [] });
      } finally {
        if (!cancelled) setFactLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [programIds]);

  // Автосохранение блоков с debounce 800ms
  const saveBlocks = useCallback((nextBlocks) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await api.updateCampaign(campaignId, {
          template_config: { blocks: nextBlocks },
        });
      } catch {
        message.error('Ошибка сохранения');
      }
    }, 800);
  }, [campaignId, message]);

  const handleBlockSave = (saved) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === saved.id);
      const next = idx >= 0
        ? prev.map((b, i) => (i === idx ? saved : b))
        : [...prev, saved];
      saveBlocks(next);
      return next;
    });
  };

  const handleBlockDelete = (id) => {
    setBlocks((prev) => {
      const next = prev.filter((b) => b.id !== id);
      saveBlocks(next);
      return next;
    });
  };

  const handleCampaignSave = async (data) => {
    try {
      const updated = await api.updateCampaign(campaignId, data);
      setCampaign(updated);
      message.success('Сохранено');
    } catch {
      message.error('Ошибка сохранения');
    }
  };

  const handleBulkCreate = async () => {
    const missing = students.filter((s) => !programs[s.id]);
    if (!missing.length) { message.info('У всех учеников уже есть программа'); return; }
    setCreating(true);
    try {
      let created = 0;
      for (const s of missing) {
        const prog = await api.createStudyProgram({
          student: s.id,
          group: campaign.group || null,
          title: `${campaign.title} · ${s.name}`,
          year: campaign.year || new Date().getFullYear(),
          season: 'summer',
          campaign: campaignId,
          status: 'draft',
        });
        setPrograms((prev) => ({ ...prev, [s.id]: prog }));
        created++;
      }
      message.success(`Создано черновиков: ${created}`);
    } catch {
      message.error('Ошибка при создании программ');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleReviewed = async (studentId) => {
    const prog = programs[studentId];
    if (!prog) return;
    try {
      const updated = await api.markReviewed(prog.id, !prog.reviewed_at);
      setPrograms((prev) => ({ ...prev, [studentId]: { ...prog, ...updated } }));
    } catch {
      message.error('Ошибка');
    }
  };

  // Прогресс = факт по выдачам (attempts), а не статус программы: его никто не двигает.
  const progress = useMemo(() => computeCampaignProgress({
    students,
    programs,
    items: factData?.items || [],
    attempts: factData?.attempts || [],
    campaign,
    now: new Date(),
  }), [students, programs, factData, campaign]);

  const reviewedCount = useMemo(
    () => students.filter((s) => !!programs[s.id]?.reviewed_at).length,
    [students, programs],
  );

  const group = useMemo(() => groups.find((g) => g.id === campaign?.group), [groups, campaign]);

  const rosterColumns = [
    {
      title: 'Ученик',
      dataIndex: 'name',
      fixed: 'left',
      width: 200,
      render: (name) => <Text strong>{name}</Text>,
    },
    {
      title: 'Программа',
      key: 'status',
      width: 110,
      render: (_, s) => {
        const prog = programs[s.id];
        if (!prog) return <Text type="secondary">Нет</Text>;
        return PROG_STATUS_TAG[prog.status] || <Tag>{prog.status}</Tag>;
      },
    },
    {
      title: 'Выполнено',
      key: 'progress',
      width: 170,
      sorter: (a, b) => {
        const ratio = (id) => {
          const p = progress.byStudent[id];
          return p?.works ? p.done / p.works : -1;
        };
        return ratio(a.id) - ratio(b.id);
      },
      render: (_, s) => {
        if (factLoading) return <Text type="secondary">…</Text>;
        const p = progress.byStudent[s.id];
        if (!p || !p.works) return <Text type="secondary">—</Text>;
        return (
          <Tooltip title={p.inProgress ? `${p.inProgress} начато, но не сдано` : null}>
            <Progress
              percent={Math.round((p.done / p.works) * 100)}
              size="small"
              status={p.pace === PACE.BEHIND ? 'exception' : (p.done >= p.works ? 'success' : 'normal')}
              format={() => `${p.done}/${p.works}${p.inProgress ? ` +${p.inProgress}` : ''}`}
            />
          </Tooltip>
        );
      },
    },
    {
      title: 'Темп',
      key: 'pace',
      width: 130,
      sorter: (a, b) => {
        const rank = { [PACE.NOT_STARTED]: 0, [PACE.BEHIND]: 1, [PACE.ON_TRACK]: 2, [PACE.DONE]: 3, [PACE.NO_PLAN]: 4 };
        return (rank[progress.byStudent[a.id]?.pace] ?? 9) - (rank[progress.byStudent[b.id]?.pace] ?? 9);
      },
      render: (_, s) => {
        if (factLoading) return <Text type="secondary">…</Text>;
        const p = progress.byStudent[s.id];
        if (!p || p.pace === PACE.NO_PLAN) return <Text type="secondary">—</Text>;
        const hint = p.expected == null
          ? 'Даты плана не заданы — темп относительно плана не считается'
          : `Ожидалось к сегодня: ${p.expected} из ${p.works}`;
        return (
          <Tooltip title={hint}>
            <span>
              <Chip tone={PACE_TONE[p.pace]}>
                {PACE_LABEL[p.pace]}{p.behindBy > 0 ? ` на ${p.behindBy}` : ''}
              </Chip>
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: 'Решаемость',
      key: 'quality',
      width: 110,
      sorter: (a, b) => (progress.byStudent[a.id]?.quality ?? -1) - (progress.byStudent[b.id]?.quality ?? -1),
      render: (_, s) => {
        if (factLoading) return <Text type="secondary">…</Text>;
        const p = progress.byStudent[s.id];
        if (!p || p.quality == null) return <Text type="secondary">—</Text>;
        return (
          <Tooltip title={`Верно ${p.correct} из ${p.answered} задач (лучшая попытка каждой работы)`}>
            <Text strong>{Math.round(p.quality * 100)}%</Text>
          </Tooltip>
        );
      },
    },
    {
      title: 'Активность',
      key: 'activity',
      width: 120,
      sorter: (a, b) => (progress.byStudent[a.id]?.lastActivity?.getTime() || 0)
        - (progress.byStudent[b.id]?.lastActivity?.getTime() || 0),
      render: (_, s) => {
        if (factLoading) return <Text type="secondary">…</Text>;
        const p = progress.byStudent[s.id];
        const label = lastActivityLabel(p?.lastActivity);
        if (!label) return <Text type="secondary">—</Text>;
        return (
          <Tooltip title={dayjs(p.lastActivity).format('D MMMM YYYY, HH:mm')}>
            <Text type="secondary">{label}</Text>
          </Tooltip>
        );
      },
    },
    {
      title: 'Проверено',
      key: 'reviewed',
      width: 100,
      render: (_, s) => {
        const prog = programs[s.id];
        if (!prog) return null;
        return (
          <Switch
            size="small"
            checked={!!prog.reviewed_at}
            onChange={() => handleToggleReviewed(s.id)}
            checkedChildren={<CheckOutlined />}
          />
        );
      },
    },
    {
      title: '',
      key: 'action',
      width: 120,
      render: (_, s) => {
        const prog = programs[s.id];
        if (prog) {
          return (
            <Button size="small" icon={<EditOutlined />}
              onClick={() => navigate(`/app/summer/${s.id}?campaign=${campaignId}`)}>
              Открыть
            </Button>
          );
        }
        return (
          <Button size="small" icon={<PlusOutlined />} type="dashed"
            onClick={() => navigate(`/app/summer/${s.id}?campaign=${campaignId}`)}>
            Создать
          </Button>
        );
      },
    },
  ];

  if (loading) return <div style={{ textAlign: 'center', padding: 64 }}><Spin /></div>;
  if (!campaign) return null;

  const missingCount = students.filter((s) => !programs[s.id]).length;

  return (
    <div>
      <WorkspacePageHeader
        accent="violet"
        title={campaign.title || '(без названия)'}
        subtitle={
          <Space size={8}>
            {campaign.season && <Chip tone="violet">{campaign.season}</Chip>}
            {campaign.year && <Text type="secondary">{campaign.year}</Text>}
            {group && <GroupChip id={group.id}>{group.name}</GroupChip>}
            <Tag color={STATUS_COLOR[campaign.status] || 'default'}>
              {STATUS_LABEL[campaign.status] || campaign.status}
            </Tag>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/app/summer')}>Назад</Button>
            <Button icon={<EditOutlined />} onClick={() => setEditOpen(true)}>Настройки</Button>
          </Space>
        }
      />

      {/* ── Общая инструкция ── */}
      {campaign.instructions && (
        <Collapse size="small" style={{ marginBottom: 16 }}
          items={[{
            key: '1',
            label: 'Общая инструкция для учеников',
            children: <Paragraph style={{ margin: 0 }}>{campaign.instructions}</Paragraph>,
          }]}
        />
      )}

      {/* ── Общее задание для класса ── */}
      <Card
        size="small"
        style={{ marginBottom: 16 }}
        title={
          <Space>
            <span>📋 Общее задание для класса</span>
            <Text type="secondary" style={{ fontWeight: 400, fontSize: 12 }}>
              — одинаковое для всех учеников
            </Text>
          </Space>
        }
        extra={
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() => setBlockModal({ open: true, block: null })}
          >
            Добавить блок
          </Button>
        }
      >
        {blocks.length === 0 ? (
          <Text type="secondary" style={{ fontSize: 13 }}>
            Нет общих блоков. Добавьте задание на вычислительные навыки, стереометрию или другое —
            оно будет видно всем ученикам класса.
          </Text>
        ) : (
          blocks.map((b) => (
            <BlockCard
              key={b.id}
              block={b}
              onEdit={() => setBlockModal({ open: true, block: b })}
              onDelete={() => handleBlockDelete(b.id)}
            />
          ))
        )}
      </Card>

      {/* ── Прогресс класса ── */}
      {students.length > 0 && (
        <ProgressSummary
          progress={progress}
          reviewedCount={reviewedCount}
          loading={factLoading}
          onOpenStudent={(sid) => navigate(`/app/summer/${sid}?campaign=${campaignId}`)}
        />
      )}

      {/* ── Индивидуальные задания (ростер) ── */}
      <Card
        size="small"
        title={
          <Space>
            <UserOutlined />
            <span>Индивидуальные задания</span>
            {campaign.deadline && (
              <Text type="secondary" style={{ fontWeight: 400 }}>
                · Дедлайн: {dayjs(campaign.deadline).format('D MMMM YYYY')}
              </Text>
            )}
          </Space>
        }
        extra={
          students.length > 0 && missingCount > 0 && (
            <Button size="small" icon={<PlusOutlined />} loading={creating} onClick={handleBulkCreate}>
              Создать черновики для всех ({missingCount})
            </Button>
          )
        }
      >
        {!campaign.group ? (
          <Text type="secondary">
            Группа не выбрана.{' '}
            <Button type="link" size="small" onClick={() => setEditOpen(true)}>Указать группу</Button>
          </Text>
        ) : students.length === 0 ? (
          <Text type="secondary">В группе нет учеников (или все без аккаунта).</Text>
        ) : (
          <Table
            dataSource={students}
            columns={rosterColumns}
            rowKey="id"
            pagination={false}
            size="small"
            scroll={{ x: 1080 }}
          />
        )}
      </Card>

      {/* ── Модалы ── */}
      <EditCampaignModal
        open={editOpen}
        campaign={campaign}
        groups={groups}
        onClose={() => setEditOpen(false)}
        onSave={handleCampaignSave}
      />

      <BlockModal
        open={blockModal.open}
        block={blockModal.block}
        onClose={() => setBlockModal({ open: false, block: null })}
        onSave={handleBlockSave}
      />
    </div>
  );
}
