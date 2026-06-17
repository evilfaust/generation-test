import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  App, Button, Card, Col, DatePicker, Divider, Drawer, Input, InputNumber, List, Modal,
  Popconfirm, Progress, Radio, Row, Select, Space, Spin, Switch, Table, Tag, Tooltip, Typography,
} from 'antd';
import dayjs from 'dayjs';
import {
  ArrowLeftOutlined, ArrowDownOutlined, ArrowUpOutlined, CopyOutlined, DeleteOutlined, EditOutlined,
  ExportOutlined, EyeOutlined, PaperClipOutlined, PlusOutlined, PrinterOutlined, ShareAltOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import { api } from '../../../shared/services/pocketbase';
import { useReferenceData } from '../../../contexts/ReferenceDataContext';
import { useStudentWeaknessProfile } from '../../../hooks/useStudentWeaknessProfile';
import { WEAK_STATUS } from '../../../shared/utils/weaknessProfile';
import { summerWeeks, defaultSummerRange } from '../../../shared/utils/summerWeeks';
import { WorkspacePageHeader, EmptyState, Chip } from '../ui';
import MaterialPickerModal from '../MaterialPickerModal';
import { assembleSummerProgram, addExistingWorkItem, generateWorkItem } from './buildProgram';

const { Text } = Typography;

const buildStudentUrl = (sessionId) => {
  const base = import.meta.env.VITE_STUDENT_URL || `${window.location.origin}/student`;
  return `${base}/${sessionId}`;
};

const STATUS_CHIP = {
  [WEAK_STATUS.RED]: { tone: 'rose', label: 'слабая' },
  [WEAK_STATUS.AMBER]: { tone: 'amber', label: 'риск' },
  [WEAK_STATUS.GREEN]: { tone: 'teal', label: 'ок' },
  [WEAK_STATUS.NODATA]: { tone: 'neutral', label: 'нет данных' },
};

const BLOCK_LABEL = {
  algebra: 'Алгебра', geometry: 'Геометрия', custom: 'Работа',
  oral: 'Устный счёт', extra: 'Тригонометрия', // back-compat для старых элементов
};
const BLOCK_TONE = { algebra: 'blue', geometry: 'teal', custom: 'violet', oral: 'amber', extra: 'violet' };

const CONTEXT_LABELS = {
  ege_base: 'ЕГЭ база', ege_profile: 'ЕГЭ профиль', oge: 'ОГЭ', trig: 'Тригонометрия',
  oral: 'Устный счёт', mordkovich: 'Мордкович', vpr: 'ВПР', other: 'Другое',
};
const DIFFICULTY_OPTS = [
  { value: 1, label: 'Базовая' }, { value: 2, label: 'Средняя' }, { value: 3, label: 'Сложная' },
];

const DEFAULT_CONFIG = {
  startDate: null, // по умолчанию 1 июля текущего года
  endDate: null,   // ... по 31 августа
  blocks: {
    algebra: { enabled: true, perTopic: 4, maxTopics: 6 },
    geometry: { enabled: true, perTopic: 4, maxTopics: 4 },
  },
};

const trendIcon = (t) =>
  t === 'up' ? <ArrowUpOutlined style={{ color: '#52c41a' }} />
    : t === 'down' ? <ArrowDownOutlined style={{ color: '#ff4d4f' }} />
      : <span style={{ color: '#ccc' }}>—</span>;

export default function StudentProgramEditor() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { topics, subtopics } = useReferenceData();

  const [student, setStudent] = useState(null);
  const [group, setGroup] = useState(null);
  const [config, setConfig] = useState(() => ({ ...DEFAULT_CONFIG, ...defaultSummerRange(new Date().getFullYear()) }));
  const [program, setProgram] = useState(null);
  const [items, setItems] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [building, setBuilding] = useState(false);
  const [pickerItem, setPickerItem] = useState(null); // элемент, к которому прикрепляем файлы
  const [weekPicker, setWeekPicker] = useState(null);  // неделя, к которой прикрепляем файлы
  const [extraPicker, setExtraPicker] = useState(false); // прикрепление файлов к доп. заданию
  const [addWeek, setAddWeek] = useState(null);        // неделя, в которую добавляем работу
  const [preview, setPreview] = useState(false);       // drawer предпросмотра ученического вида
  const [memoOpen, setMemoOpen] = useState(false);     // модал «памятка ученику»
  const [doneSessions, setDoneSessions] = useState(() => new Set()); // сессии со сданной попыткой

  const { profile, loading: loadingProfile } = useStudentWeaknessProfile(student);
  const year = new Date().getFullYear();
  const gradeNum = Number(group?.grade) || 10;

  const topicTitle = useMemo(() => {
    const m = new Map();
    for (const t of topics || []) m.set(t.id, t);
    return m;
  }, [topics]);

  const loadItems = useCallback(async (programId) => {
    if (!programId) { setItems([]); return; }
    setItems(await api.getProgramItems(programId));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingMeta(true);
      try {
        const s = await api.getStudent(studentId);
        if (cancelled) return;
        setStudent(s);
        if (s?.teaching_group) {
          const g = await api.getTeachingGroup(s.teaching_group).catch(() => null);
          if (!cancelled) setGroup(g);
        }
        const prog = await api.getStudyProgramForStudent(studentId, { season: 'summer', year });
        if (cancelled) return;
        if (prog) {
          setProgram(prog);
          if (prog.config?.blocks) {
            const def = defaultSummerRange(year);
            setConfig({
              ...prog.config,
              startDate: prog.config.startDate || def.startDate,
              endDate: prog.config.endDate || def.endDate,
            });
          }
          await loadItems(prog.id);
        }
      } catch {
        message.error('Не удалось загрузить ученика');
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => { cancelled = true; };
  }, [studentId, year, loadItems, message]);

  // Какие сессии ученик уже сдал (для «графика выполнения» в памятке).
  useEffect(() => {
    if (!student?.id) { setDoneSessions(new Set()); return; }
    let cancelled = false;
    api.getAttemptsByStudentAll(student.id).then((atts) => {
      if (cancelled) return;
      const done = new Set(
        (atts || [])
          .filter((a) => a.status === 'submitted' || a.status === 'corrected')
          .map((a) => a.session)
      );
      setDoneSessions(done);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [student?.id, items]);

  const setBlock = (key, patch) =>
    setConfig((c) => ({ ...c, blocks: { ...c.blocks, [key]: { ...c.blocks[key], ...patch } } }));

  const weakCount = useMemo(
    () => profile.filter((p) => p.status === WEAK_STATUS.RED || p.status === WEAK_STATUS.AMBER).length,
    [profile],
  );

  // Недели каникул с датами.
  const weeksInfo = useMemo(() => summerWeeks(config.startDate, config.endDate), [config.startDate, config.endDate]);

  // Элементы, сгруппированные по неделям + «прочее» (week null или вне диапазона).
  const { byWeek, leftover } = useMemo(() => {
    const map = new Map();
    const extra = [];
    const maxW = weeksInfo.length;
    for (const it of items) {
      const w = it.params?.week;
      if (w == null || (maxW && w > maxW)) { extra.push(it); continue; }
      if (!map.has(w)) map.set(w, []);
      map.get(w).push(it);
    }
    return { byWeek: map, leftover: extra };
  }, [items, weeksInfo]);

  // Создать пустую программу, если её ещё нет (для ручного добавления работ).
  const ensureProgram = async () => {
    if (program) return program;
    const prog = await api.createStudyProgram({
      student: student.id, group: group?.id || null,
      title: `Каникулярное задание · ${student.name}`,
      year, season: 'summer', exam_type: 'ege_base',
      config, profile_snapshot: profile, status: 'issued',
    });
    setProgram(prog);
    return prog;
  };

  // Сохранить патч в program.config (создаёт программу при необходимости). Возвращает новый config.
  const patchConfig = async (patch) => {
    const prog = await ensureProgram();
    const nextConfig = { ...config, ...patch };
    await api.updateStudyProgram(prog.id, { config: nextConfig });
    setProgram((p) => (p ? { ...p, config: nextConfig } : p));
    setConfig(nextConfig);
    return nextConfig;
  };

  // ── Файлы недели (config.weekFiles[week]) ──
  const handleWeekPickFiles = async (picked) => {
    const wk = weekPicker;
    if (wk == null) return;
    const cur = config.weekFiles?.[wk] || [];
    const merged = [...cur, ...picked.filter((p) => !cur.some((a) => a.id === p.id))];
    try {
      await patchConfig({ weekFiles: { ...(config.weekFiles || {}), [wk]: merged } });
      message.success('Файлы прикреплены к неделе');
    } catch { message.error('Не удалось прикрепить файлы'); }
    setWeekPicker(null);
  };

  const removeWeekFile = async (wk, id) => {
    const next = (config.weekFiles?.[wk] || []).filter((a) => a.id !== id);
    try { await patchConfig({ weekFiles: { ...(config.weekFiles || {}), [wk]: next } }); }
    catch { message.error('Не удалось открепить файл'); }
  };

  const setWeekFileNote = async (wk, id, note) => {
    const cur = config.weekFiles?.[wk] || [];
    if (!cur.some((a) => a.id === id && (a.note || '') !== (note || ''))) return;
    const next = cur.map((a) => (a.id === id ? { ...a, note } : a));
    try { await patchConfig({ weekFiles: { ...(config.weekFiles || {}), [wk]: next } }); }
    catch { message.error('Не удалось сохранить пояснение'); }
  };

  // ── Дополнительное задание (config.extra = { text, files, links }) ──
  const extra = config.extra || { text: '', files: [], links: [] };
  const patchExtra = (patch) => patchConfig({ extra: { text: '', files: [], links: [], ...extra, ...patch } });

  const handleExtraPickFiles = async (picked) => {
    const cur = extra.files || [];
    const merged = [...cur, ...picked.filter((p) => !cur.some((a) => a.id === p.id))];
    try { await patchExtra({ files: merged }); message.success('Файлы прикреплены'); }
    catch { message.error('Не удалось прикрепить файлы'); }
    setExtraPicker(false);
  };

  const handleBuild = async () => {
    if (!student) return;
    setBuilding(true);
    try {
      const { program: prog } = await assembleSummerProgram({ student, profile, config, group, year, topicsById: topicTitle });
      setProgram(prog);
      await loadItems(prog.id);
      message.success('Программа собрана и выдана');
    } catch (e) {
      console.error(e);
      message.error('Не удалось собрать программу');
    } finally {
      setBuilding(false);
    }
  };

  // Добавление работы в неделю (выбор существующей / генерация из банка).
  const handleAddWork = async (payload) => {
    try {
      const prog = await ensureProgram();
      if (payload.mode === 'existing') {
        await addExistingWorkItem({ programId: prog.id, week: addWeek, work: payload.work });
      } else {
        const res = await generateWorkItem({
          programId: prog.id, week: addWeek, student, gradeNum,
          filters: payload.filters, count: payload.count, title: payload.title,
        });
        if (!res) { message.warning('В банке нет задач по выбранным фильтрам'); }
      }
      await loadItems(prog.id);
      setAddWeek(null);
      message.success('Работа добавлена');
    } catch (e) {
      console.error(e);
      message.error('Не удалось добавить работу');
    }
  };

  // Перенести элемент в другую неделю.
  const handleMoveItem = async (item, week) => {
    try {
      await api.updateProgramItem(item.id, { params: { ...(item.params || {}), week } });
      await loadItems(program.id);
    } catch {
      message.error('Не удалось перенести');
    }
  };

  // Прикрепление файлов из Библиотеки к элементу (params.attachments).
  const handlePickFiles = async (picked) => {
    if (!pickerItem) return;
    const cur = pickerItem.params?.attachments || [];
    const merged = [...cur, ...picked.filter((p) => !cur.some((a) => a.id === p.id))];
    try {
      await api.updateProgramItem(pickerItem.id, { params: { ...(pickerItem.params || {}), attachments: merged } });
      await loadItems(program.id);
      message.success('Файлы прикреплены');
    } catch {
      message.error('Не удалось прикрепить файлы');
    }
  };

  const handleRemoveAttachment = async (item, fileId) => {
    const next = (item.params?.attachments || []).filter((a) => a.id !== fileId);
    try {
      await api.updateProgramItem(item.id, { params: { ...(item.params || {}), attachments: next } });
      await loadItems(program.id);
    } catch {
      message.error('Не удалось открепить файл');
    }
  };

  // Удалить элемент: вместе с его работой (каскадно — варианты/сессия/результаты).
  const handleDeleteItem = async (item) => {
    try {
      if (item.params?.workId) await api.deleteWork(item.params.workId).catch(() => {});
      for (const tid of item.params?.genTaskIds || []) await api.deleteTask(tid).catch(() => {});
      await api.deleteProgramItem(item.id);
      await loadItems(program.id);
      message.success('Элемент удалён');
    } catch {
      message.error('Не удалось удалить элемент');
    }
  };

  const handleDeleteProgram = async () => {
    if (!program) return;
    try {
      for (const it of items) {
        if (it.params?.workId) await api.deleteWork(it.params.workId).catch(() => {});
        for (const tid of it.params?.genTaskIds || []) await api.deleteTask(tid).catch(() => {});
      }
      await api.deleteStudyProgram(program.id);
      setProgram(null);
      setItems([]);
      message.success('Программа удалена');
    } catch {
      message.error('Не удалось удалить программу');
    }
  };

  const profileColumns = [
    {
      title: 'Тема', key: 'topic',
      render: (_, r) => {
        const t = topicTitle.get(r.topicId);
        const num = r.egeNumber ? `№${r.egeNumber} — ` : '';
        return <Text>{num}{t?.title || r.topicId}</Text>;
      },
    },
    { title: 'Раздел', dataIndex: 'section', width: 110, render: (s) => s || '—' },
    {
      title: 'Верно', key: 'rate', width: 120,
      render: (_, r) => r.correctRate == null ? '—'
        : <Text>{Math.round(r.recencyWeightedRate * 100)}% <Text type="secondary">({r.correct}/{r.attempts})</Text></Text>,
    },
    { title: 'Тренд', key: 'trend', width: 70, align: 'center', render: (_, r) => trendIcon(r.trend) },
    {
      title: 'Статус', key: 'status', width: 130,
      render: (_, r) => {
        const c = STATUS_CHIP[r.status];
        return (
          <Space size={4}>
            <Chip tone={c.tone} dot={false}>{c.label}</Chip>
            {r.lowConfidence && r.status !== WEAK_STATUS.NODATA && (
              <Tooltip title="Мало данных — статус ориентировочный"><Tag color="default">?</Tag></Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  // Колонки таблицы элементов одной недели.
  const itemColumns = [
    {
      title: 'Работа', key: 'title',
      render: (_, r) => (
        <Space size={6}>
          <Tag color={BLOCK_TONE[r.block_type] === 'rose' ? 'red' : undefined} bordered>
            {BLOCK_LABEL[r.block_type] || r.block_type}
          </Tag>
          <Text>{r.title}</Text>
        </Space>
      ),
    },
    {
      title: 'Ссылка', key: 'link', width: 140,
      render: (_, r) => r.session ? (
        <Space size={6}>
          <a href={buildStudentUrl(r.session)} target="_blank" rel="noreferrer">открыть <ExportOutlined /></a>
          <Tooltip title="Скопировать">
            <CopyOutlined onClick={() => { navigator.clipboard.writeText(buildStudentUrl(r.session)); message.success('Скопировано'); }} />
          </Tooltip>
        </Space>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Файлы', key: 'files', width: 200,
      render: (_, r) => {
        const atts = r.params?.attachments || [];
        return (
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            {atts.map((a) => (
              <Space key={a.id} size={4}>
                <a href={a.url} target="_blank" rel="noreferrer">{a.title || 'файл'}</a>
                <Tooltip title="Открепить">
                  <DeleteOutlined style={{ color: '#bbb' }} onClick={() => handleRemoveAttachment(r, a.id)} />
                </Tooltip>
              </Space>
            ))}
            <Button size="small" type="link" icon={<PaperClipOutlined />} style={{ paddingLeft: 0 }}
              onClick={() => setPickerItem(r)}>Прикрепить</Button>
          </Space>
        );
      },
    },
    {
      title: 'Перенести', key: 'move', width: 130,
      render: (_, r) => (
        <Select
          size="small" style={{ width: 110 }} value={r.params?.week}
          onChange={(w) => handleMoveItem(r, w)}
          options={weeksInfo.map((w) => ({ value: w.week, label: `Неделя ${w.week}` }))}
        />
      ),
    },
    {
      title: '', key: 'actions', width: 80, align: 'right',
      render: (_, r) => (
        <Space size={4}>
          {r.params?.workId && (
            <Tooltip title="Открыть в редакторе работ">
              <Button size="small" type="text" icon={<EditOutlined />}
                onClick={() => navigate(`/app/works/${r.params.workId}/edit`)} />
            </Tooltip>
          )}
          <Popconfirm
            title="Удалить работу?" description="Работа, сессия и результаты будут удалены."
            okText="Удалить" okType="danger" cancelText="Отмена"
            onConfirm={() => handleDeleteItem(r)}
          >
            <Tooltip title="Удалить"><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (loadingMeta) return <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>;
  if (!student) return <EmptyState title="Ученик не найден" />;

  return (
    <div>
      <WorkspacePageHeader
        accent="violet"
        title={`Каникулярное задание · ${student.name}`}
        subtitle={`${group?.name || 'без группы'}${group?.grade ? ` · ${group.grade} кл.` : ''} · ${year}`}
        extra={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/app/summer')}>К списку</Button>
            {program && (
              <Button icon={<EyeOutlined />} onClick={() => setPreview(true)}>Глазами ученика</Button>
            )}
            {program && (
              <Button icon={<ShareAltOutlined />} onClick={() => setMemoOpen(true)}>Памятка ученику</Button>
            )}
            {program && (
              <Popconfirm
                title="Удалить всю программу?"
                description="Все работы, сессии и результаты этой программы будут удалены."
                okText="Удалить" okType="danger" cancelText="Отмена"
                onConfirm={handleDeleteProgram}
              >
                <Button danger icon={<DeleteOutlined />}>Удалить программу</Button>
              </Popconfirm>
            )}
            <Button type="primary" icon={<ThunderboltOutlined />} loading={building} onClick={handleBuild}>
              {program ? 'Пересобрать по слабым темам' : 'Собрать по слабым темам'}
            </Button>
          </Space>
        }
      />

      {!student.telegram_id && (
        <Card size="small" style={{ marginBottom: 12 }}>
          <Text type="warning">У ученика не указан telegram_id — внешние результаты решу матчатся по имени (менее надёжно).</Text>
        </Card>
      )}

      <Row gutter={16}>
        {/* Профиль слабостей */}
        <Col xs={24} lg={14}>
          <Card
            size="small"
            title={<Space>Профиль слабостей <Text type="secondary">слабых тем: {weakCount}</Text></Space>}
            styles={{ body: { padding: 0 } }}
          >
            {loadingProfile ? (
              <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>
            ) : profile.length ? (
              <Table size="small" rowKey="topicId" columns={profileColumns} dataSource={profile}
                pagination={false} scroll={{ y: 360 }} />
            ) : (
              <div style={{ padding: 24 }}>
                <EmptyState title="Нет данных по ученику"
                  description="Нет прохождений в Lemma и внешних результатов решу. Можно вручную добавлять работы по неделям." />
              </div>
            )}
          </Card>
        </Col>

        {/* Авто-сборка по слабым темам */}
        <Col xs={24} lg={10}>
          <Card
            size="small"
            title="Авто-сборка по слабым темам"
            extra={
              <Space size={6}>
                <Text type="secondary" style={{ fontSize: 12 }}>Каникулы:</Text>
                <DatePicker.RangePicker
                  size="small" format="DD.MM" allowClear={false}
                  value={config.startDate && config.endDate ? [dayjs(config.startDate), dayjs(config.endDate)] : null}
                  onChange={(range) => setConfig((c) => ({
                    ...c,
                    startDate: range?.[0] ? range[0].format('YYYY-MM-DD') : null,
                    endDate: range?.[1] ? range[1].format('YYYY-MM-DD') : null,
                  }))}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>{weeksInfo.length} нед.</Text>
              </Space>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                «Собрать по слабым темам» разложит алгебру и геометрию по неделям. Устный счёт и
                доп. работы добавляйте в недели вручную ниже.
              </Text>
              <BlockRow
                label="Алгебра — слабые темы" checked={config.blocks.algebra.enabled}
                onToggle={(v) => setBlock('algebra', { enabled: v })}
              >
                <NumPair a={config.blocks.algebra.perTopic} aLabel="задач/тему"
                  b={config.blocks.algebra.maxTopics} bLabel="макс. тем"
                  onA={(v) => setBlock('algebra', { perTopic: v })} onB={(v) => setBlock('algebra', { maxTopics: v })} />
              </BlockRow>
              <BlockRow
                label="Геометрия — слабые темы" checked={config.blocks.geometry.enabled}
                onToggle={(v) => setBlock('geometry', { enabled: v })}
              >
                <NumPair a={config.blocks.geometry.perTopic} aLabel="задач/тему"
                  b={config.blocks.geometry.maxTopics} bLabel="макс. тем"
                  onA={(v) => setBlock('geometry', { perTopic: v })} onB={(v) => setBlock('geometry', { maxTopics: v })} />
              </BlockRow>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Доска по неделям */}
      <Divider orientation="left" style={{ marginTop: 20 }}>План по неделям</Divider>

      {!weeksInfo.length ? (
        <EmptyState title="Укажите даты каникул" description="Сверху в «Авто-сборке» задайте диапазон каникул." />
      ) : (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {weeksInfo.map((w) => {
            const list = byWeek.get(w.week) || [];
            return (
              <Card
                key={w.week}
                size="small"
                title={<Space><Chip tone="blue" dot={false}>Неделя {w.week}</Chip><Text type="secondary">{w.label}</Text></Space>}
                extra={
                  <Space size={4}>
                    <Button size="small" icon={<PaperClipOutlined />} onClick={() => setWeekPicker(w.week)}>Файл недели</Button>
                    <Button size="small" icon={<PlusOutlined />} onClick={() => setAddWeek(w.week)}>Добавить работу</Button>
                  </Space>
                }
                styles={{ body: { padding: 12 } }}
              >
                {list.length ? (
                  <Table size="small" rowKey="id" columns={itemColumns} dataSource={list} pagination={false} showHeader={false}
                    style={{ marginLeft: -12, marginRight: -12 }} />
                ) : (
                  <Text type="secondary">Пусто — добавьте работу или соберите по слабым темам.</Text>
                )}
                <WeekFiles
                  files={config.weekFiles?.[w.week] || []}
                  onRemove={(id) => removeWeekFile(w.week, id)}
                  onNote={(id, note) => setWeekFileNote(w.week, id, note)}
                />
              </Card>
            );
          })}

          {leftover.length > 0 && (
            <Card size="small" title={<Text type="secondary">Вне недель</Text>} styles={{ body: { padding: 0 } }}>
              <Table size="small" rowKey="id" columns={itemColumns} dataSource={leftover} pagination={false} showHeader={false} />
            </Card>
          )}
        </Space>
      )}

      {/* Дополнительное (творческое) задание вне недель */}
      <Divider orientation="left" style={{ marginTop: 24 }}>Дополнительное задание</Divider>
      <ExtraTaskEditor
        extra={extra}
        onSaveText={(text) => patchExtra({ text })}
        onPickFiles={() => setExtraPicker(true)}
        onRemoveFile={(id) => patchExtra({ files: (extra.files || []).filter((f) => f.id !== id) })}
        onFileNote={(id, note) => patchExtra({ files: (extra.files || []).map((f) => (f.id === id ? { ...f, note } : f)) })}
        onSaveLinks={(links) => patchExtra({ links })}
      />

      <MaterialPickerModal
        open={!!pickerItem}
        onClose={() => setPickerItem(null)}
        existingIds={(pickerItem?.params?.attachments || []).map((a) => a.id)}
        onPick={handlePickFiles}
      />

      <MaterialPickerModal
        open={weekPicker != null}
        onClose={() => setWeekPicker(null)}
        existingIds={(config.weekFiles?.[weekPicker] || []).map((a) => a.id)}
        onPick={handleWeekPickFiles}
      />

      <MaterialPickerModal
        open={extraPicker}
        onClose={() => setExtraPicker(false)}
        existingIds={(extra.files || []).map((a) => a.id)}
        onPick={handleExtraPickFiles}
      />

      <AddWorkModal
        open={addWeek != null}
        week={addWeek}
        topics={topics || []}
        subtopics={subtopics || []}
        onClose={() => setAddWeek(null)}
        onAdd={handleAddWork}
      />

      <Drawer
        title={`Глазами ученика · ${student.name}`}
        open={preview}
        onClose={() => setPreview(false)}
        width={520}
      >
        <StudentPreview weeksInfo={weeksInfo} byWeek={byWeek} weekFiles={config.weekFiles || {}} extra={extra} />
      </Drawer>

      <ShareMemoModal
        open={memoOpen}
        onClose={() => setMemoOpen(false)}
        student={student}
        program={program}
        weeksInfo={weeksInfo}
        byWeek={byWeek}
        doneSessions={doneSessions}
        onSaveIntro={async (intro) => {
          if (!program) return;
          const cfg = { ...(program.config || {}), intro };
          await api.updateStudyProgram(program.id, { config: cfg });
          setProgram((p) => ({ ...p, config: cfg }));
        }}
      />
    </div>
  );
}

// ─── Предпросмотр ученического вида (read-only, без зависимости от student-CSS) ───
function StudentPreview({ weeksInfo, byWeek, weekFiles = {}, extra }) {
  const hasExtra = extra && (extra.text?.trim() || (extra.files || []).length || (extra.links || []).length);
  if (!weeksInfo.length && !hasExtra) return <EmptyState title="Нет недель" />;
  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Text type="secondary">Так план выглядит у ученика: по неделям, порциями.</Text>
      {weeksInfo.map((w) => {
        const list = byWeek.get(w.week) || [];
        const files = weekFiles[w.week] || [];
        return (
          <Card key={w.week} size="small" title={<>Неделя {w.week} · <Text type="secondary">{w.label}</Text></>}>
            {list.length ? (
              <List
                size="small"
                dataSource={list}
                renderItem={(it) => (
                  <List.Item actions={it.session ? [<a key="go" href={buildStudentUrl(it.session)} target="_blank" rel="noreferrer">Решать</a>] : []}>
                    <Space size={6}>
                      <Tag>{BLOCK_LABEL[it.block_type] || it.block_type}</Tag>
                      <Text>{it.title}</Text>
                    </Space>
                  </List.Item>
                )}
              />
            ) : <Text type="secondary">На эту неделю заданий нет</Text>}
            {files.map((f) => (
              <div key={f.id} style={{ marginTop: 6 }}>
                <a href={f.url} target="_blank" rel="noreferrer"><PaperClipOutlined /> {f.title || 'файл'}</a>
                {f.note && <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{f.note}</Text>}
              </div>
            ))}
          </Card>
        );
      })}
      {hasExtra && (
        <Card size="small" title="✨ Дополнительное задание">
          {extra.text?.trim() && <div style={{ whiteSpace: 'pre-wrap', marginBottom: 8 }}>{extra.text}</div>}
          {(extra.files || []).map((f) => (
            <div key={f.id} style={{ marginTop: 4 }}>
              <a href={f.url} target="_blank" rel="noreferrer"><PaperClipOutlined /> {f.title || 'файл'}</a>
              {f.note && <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{f.note}</Text>}
            </div>
          ))}
          {(extra.links || []).map((l, i) => (
            <div key={i} style={{ marginTop: 4 }}>
              <a href={l.url} target="_blank" rel="noreferrer"><ExportOutlined /> {l.label || l.url}</a>
            </div>
          ))}
        </Card>
      )}
    </Space>
  );
}

// ─── Файлы недели (учительский редактор) ───
function WeekFiles({ files, onRemove, onNote }) {
  if (!files.length) return null;
  return (
    <div style={{ marginTop: 8, borderTop: '1px dashed #eee', paddingTop: 8 }}>
      <Text type="secondary" style={{ fontSize: 12 }}><PaperClipOutlined /> Файлы недели</Text>
      <Space direction="vertical" size={6} style={{ width: '100%', marginTop: 6 }}>
        {files.map((f) => (
          <FileRow key={f.id} file={f} onRemove={() => onRemove(f.id)} onNote={(note) => onNote(f.id, note)} />
        ))}
      </Space>
    </div>
  );
}

// Строка файла с inline-пояснением (персист на blur).
function FileRow({ file, onRemove, onNote }) {
  const [note, setNote] = useState(file.note || '');
  useEffect(() => { setNote(file.note || ''); }, [file.note]);
  return (
    <Space size={6} align="start" style={{ width: '100%' }}>
      <a href={file.url} target="_blank" rel="noreferrer" style={{ whiteSpace: 'nowrap' }}>
        <PaperClipOutlined /> {file.title || 'файл'}
      </a>
      <Input
        size="small" placeholder="пояснение к файлу (необязательно)"
        value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => onNote(note)}
        style={{ flex: 1, minWidth: 140 }}
      />
      <Tooltip title="Открепить"><DeleteOutlined style={{ color: '#bbb' }} onClick={onRemove} /></Tooltip>
    </Space>
  );
}

// ─── Редактор дополнительного (творческого) задания ───
function ExtraTaskEditor({ extra, onSaveText, onPickFiles, onRemoveFile, onFileNote, onSaveLinks }) {
  const [text, setText] = useState(extra.text || '');
  const [links, setLinks] = useState(extra.links || []);
  useEffect(() => { setText(extra.text || ''); }, [extra.text]);
  useEffect(() => { setLinks(extra.links || []); }, [extra.links]);

  const updateLink = (i, patch) => setLinks((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLink = () => setLinks((ls) => [...ls, { url: '', label: '' }]);
  const removeLink = (i) => { const next = links.filter((_, idx) => idx !== i); setLinks(next); onSaveLinks(next); };

  return (
    <Card size="small">
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Необязательное задание (например, творческое или проектное). Появится у ученика отдельным блоком, если заполнено.
          </Text>
          <Input.TextArea
            rows={4} value={text} onChange={(e) => setText(e.target.value)} onBlur={() => onSaveText(text)}
            placeholder="Текст задания. Например: придумай и оформи задачу из жизни на тему «проценты»…"
            style={{ marginTop: 6 }}
          />
        </div>

        <div>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Text strong style={{ fontSize: 13 }}>Файлы</Text>
            <Button size="small" type="link" icon={<PaperClipOutlined />} onClick={onPickFiles} style={{ paddingLeft: 0 }}>
              Прикрепить
            </Button>
          </Space>
          {(extra.files || []).length ? (
            <Space direction="vertical" size={6} style={{ width: '100%', marginTop: 4 }}>
              {extra.files.map((f) => (
                <FileRow key={f.id} file={f} onRemove={() => onRemoveFile(f.id)} onNote={(note) => onFileNote(f.id, note)} />
              ))}
            </Space>
          ) : <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Файлы не прикреплены</Text>}
        </div>

        <div>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Text strong style={{ fontSize: 13 }}>Ссылки</Text>
            <Button size="small" type="link" icon={<PlusOutlined />} onClick={addLink} style={{ paddingLeft: 0 }}>
              Добавить ссылку
            </Button>
          </Space>
          {links.length ? (
            <Space direction="vertical" size={6} style={{ width: '100%', marginTop: 4 }}>
              {links.map((l, i) => (
                <Space key={i} size={6} style={{ width: '100%' }}>
                  <Input
                    size="small" placeholder="https://…" value={l.url}
                    onChange={(e) => updateLink(i, { url: e.target.value })} onBlur={() => onSaveLinks(links)}
                    style={{ flex: 1, minWidth: 160 }}
                  />
                  <Input
                    size="small" placeholder="подпись" value={l.label}
                    onChange={(e) => updateLink(i, { label: e.target.value })} onBlur={() => onSaveLinks(links)}
                    style={{ width: 160 }}
                  />
                  <Tooltip title="Удалить"><DeleteOutlined style={{ color: '#bbb' }} onClick={() => removeLink(i)} /></Tooltip>
                </Space>
              ))}
            </Space>
          ) : <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Ссылки не добавлены</Text>}
        </div>
      </Space>
    </Card>
  );
}

// ─── Модал «Памятка ученику» (страница со ссылками + прогресс + напутствие) ───
function ShareMemoModal({ open, onClose, student, program, weeksInfo, byWeek, doneSessions, onSaveIntro }) {
  const { message } = App.useApp();
  const [intro, setIntro] = useState('');
  useEffect(() => { if (open) setIntro(program?.config?.intro || ''); }, [open, program]);

  const studentName = student?.name || '';
  const period = useMemo(() => {
    if (!weeksInfo.length) return '';
    const fmt = (d) => d.toLocaleDateString('ru', { day: 'numeric', month: 'long' });
    return `${fmt(weeksInfo[0].from)} – ${fmt(weeksInfo[weeksInfo.length - 1].to)}`;
  }, [weeksInfo]);

  const { total, done } = useMemo(() => {
    const all = [...byWeek.values()].flat().filter((i) => i.session);
    return { total: all.length, done: all.filter((i) => doneSessions.has(i.session)).length };
  }, [byWeek, doneSessions]);
  const pct = total ? Math.round((done / total) * 100) : 0;

  const buildText = () => {
    const lines = [];
    if (intro.trim()) lines.push(intro.trim(), '');
    lines.push(`Каникулярное задание — ${studentName}`);
    if (period) lines.push(period);
    lines.push('');
    for (const w of weeksInfo) {
      const list = byWeek.get(w.week) || [];
      if (!list.length) continue;
      lines.push(`📅 Неделя ${w.week} · ${w.label}`);
      for (const it of list) lines.push(it.session ? `• ${it.title}: ${buildStudentUrl(it.session)}` : `• ${it.title}`);
      lines.push('');
    }
    return lines.join('\n').trim();
  };

  const handleCopy = async () => {
    await onSaveIntro?.(intro);
    try { await navigator.clipboard.writeText(buildText()); message.success('Скопировано — вставьте в сообщение ученику'); }
    catch { message.error('Не удалось скопировать'); }
  };

  const handlePrint = async () => {
    await onSaveIntro?.(intro);
    const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const weeksHtml = weeksInfo.map((w) => {
      const list = byWeek.get(w.week) || [];
      if (!list.length) return '';
      const items = list.map((it) => `<li>${esc(it.title)}${it.session ? ` — <a href="${buildStudentUrl(it.session)}">${buildStudentUrl(it.session)}</a>` : ''}</li>`).join('');
      return `<h3>Неделя ${w.week} · ${esc(w.label)}</h3><ul>${items}</ul>`;
    }).join('');
    const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Каникулярное задание — ${esc(studentName)}</title>
      <style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:720px;margin:24px auto;padding:0 16px;color:#222}
      h1{font-size:22px;margin:0 0 4px}h3{margin:18px 0 6px;color:#5b5bd6}ul{margin:0;padding-left:20px}li{margin:4px 0}
      a{color:#3a3ad6;word-break:break-all}.intro{white-space:pre-wrap;background:#f6f5fb;border-radius:10px;padding:12px 14px;margin-bottom:16px}
      .muted{color:#888;margin-bottom:8px}</style></head><body>
      ${intro.trim() ? `<div class="intro">${esc(intro.trim())}</div>` : ''}
      <h1>Каникулярное задание — ${esc(studentName)}</h1>
      <div class="muted">${esc(period)} · выполнено ${done} из ${total}</div>
      ${weeksHtml}</body></html>`;
    const wnd = window.open('', '_blank');
    if (!wnd) { message.error('Разрешите всплывающие окна для печати'); return; }
    wnd.document.write(html); wnd.document.close(); wnd.focus();
    setTimeout(() => wnd.print(), 300);
  };

  return (
    <Modal
      open={open} onCancel={onClose} width={640}
      title={`Памятка ученику · ${studentName}`}
      footer={[
        <Button key="print" icon={<PrinterOutlined />} onClick={handlePrint}>Печать</Button>,
        <Button key="copy" type="primary" icon={<CopyOutlined />} onClick={handleCopy}>Скопировать текст</Button>,
      ]}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>Напутствие (попадёт в начало):</Text>
          <Input.TextArea
            rows={3} value={intro} onChange={(e) => setIntro(e.target.value)}
            placeholder="Например: Привет! Вот задание на каникулы — делай по чуть-чуть каждую неделю 💪"
          />
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>Выполнено {done} из {total}</Text>
          <Progress percent={pct} size="small" />
        </div>
        <div style={{ maxHeight: 340, overflowY: 'auto' }}>
          {weeksInfo.map((w) => {
            const list = byWeek.get(w.week) || [];
            if (!list.length) return null;
            return (
              <div key={w.week} style={{ marginBottom: 10 }}>
                <Text strong>Неделя {w.week}</Text> <Text type="secondary">· {w.label}</Text>
                <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                  {list.map((it) => (
                    <li key={it.id} style={{ margin: '2px 0' }}>
                      {it.session && doneSessions.has(it.session) ? '✅ ' : ''}{it.title}
                      {it.session && <> — <a href={buildStudentUrl(it.session)} target="_blank" rel="noreferrer">ссылка</a></>}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Space>
    </Modal>
  );
}

// ─── Модал «Добавить работу» ───
// Простой генератор тренажёров (в основном под устный счёт): каскад
// Контекст → Тема → Подтема + сложность. Для предметных работ — полноценные рабочие листы.
function AddWorkModal({ open, week, topics, subtopics, onClose, onAdd }) {
  const [mode, setMode] = useState('existing');
  const [works, setWorks] = useState([]);
  const [loadingWorks, setLoadingWorks] = useState(false);
  const [workId, setWorkId] = useState(null);
  // Каскад генерации:
  const [context, setContext] = useState(null);
  const [topicId, setTopicId] = useState(null);
  const [subtopicId, setSubtopicId] = useState(null);
  const [difficulty, setDifficulty] = useState(null);
  const [count, setCount] = useState(10);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode('existing'); setWorkId(null);
    setContext(null); setTopicId(null); setSubtopicId(null); setDifficulty(null);
    setCount(10); setTitle('');
    setLoadingWorks(true);
    api.getWorks().then((w) => setWorks(w)).catch(() => setWorks([])).finally(() => setLoadingWorks(false));
  }, [open]);

  // Контексты — уникальные exam_type из тем.
  const contextOpts = useMemo(() => {
    const set = new Set((topics || []).map((t) => t.exam_type).filter(Boolean));
    return [...set].map((c) => ({ value: c, label: CONTEXT_LABELS[c] || c }));
  }, [topics]);

  // Темы выбранного контекста.
  const topicOpts = useMemo(() => (topics || [])
    .filter((t) => !context || t.exam_type === context)
    .map((t) => ({ value: t.id, label: t.ege_number ? `№${t.ege_number} — ${t.title}` : t.title })),
  [topics, context]);

  // Подтемы выбранной темы.
  const subtopicOpts = useMemo(() => (subtopics || [])
    .filter((s) => topicId && s.topic === topicId)
    .map((s) => ({ value: s.id, label: s.name })),
  [subtopics, topicId]);

  const topicById = useMemo(() => new Map((topics || []).map((t) => [t.id, t])), [topics]);

  const confirm = async () => {
    setBusy(true);
    try {
      if (mode === 'existing') {
        const work = works.find((w) => w.id === workId);
        if (!work) return;
        await onAdd({ mode: 'existing', work });
      } else {
        const t = topicById.get(topicId);
        const finalTitle = title.trim()
          || (t ? (t.ege_number ? `№${t.ege_number} — ${t.title}` : t.title) : (CONTEXT_LABELS[context] || 'Работа'));
        const filters = {
          exam_type: context || undefined,
          topic: topicId || undefined,
          subtopic: subtopicId || undefined,
          difficulty: difficulty || undefined,
        };
        await onAdd({ mode: 'generate', filters, count, title: finalTitle });
      }
    } finally {
      setBusy(false);
    }
  };

  const canConfirm = mode === 'existing' ? !!workId : !!context;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={confirm}
      okText="Добавить"
      okButtonProps={{ disabled: !canConfirm, loading: busy }}
      title={`Добавить работу · Неделя ${week ?? ''}`}
    >
      <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)} style={{ marginBottom: 16 }}>
        <Radio.Button value="existing">Выбрать существующую</Radio.Button>
        <Radio.Button value="generate">Сгенерировать из банка</Radio.Button>
      </Radio.Group>

      {mode === 'existing' ? (
        <Select
          showSearch optionFilterProp="label"
          style={{ width: '100%' }}
          placeholder="Выберите работу"
          loading={loadingWorks}
          value={workId}
          onChange={setWorkId}
          options={works.map((w) => ({ value: w.id, label: w.title || w.id }))}
        />
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>Контекст:</Text>
            <Select
              style={{ width: '100%', marginTop: 4 }}
              placeholder="Выберите контекст"
              value={context}
              onChange={(v) => { setContext(v); setTopicId(null); setSubtopicId(null); }}
              options={contextOpts}
            />
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>Тема (необязательно):</Text>
            <Select
              showSearch optionFilterProp="label" allowClear
              style={{ width: '100%', marginTop: 4 }}
              placeholder="Любая тема контекста"
              disabled={!context}
              value={topicId}
              onChange={(v) => { setTopicId(v); setSubtopicId(null); }}
              options={topicOpts}
            />
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>Подтема (необязательно):</Text>
            <Select
              showSearch optionFilterProp="label" allowClear
              style={{ width: '100%', marginTop: 4 }}
              placeholder={topicId ? 'Любая подтема темы' : 'Сначала выберите тему'}
              disabled={!topicId || !subtopicOpts.length}
              value={subtopicId}
              onChange={setSubtopicId}
              options={subtopicOpts}
            />
          </div>
          <Space size={16} wrap>
            <Space size={6}>
              <Text type="secondary" style={{ fontSize: 12 }}>Сложность:</Text>
              <Select
                allowClear size="small" style={{ width: 130 }} placeholder="Любая"
                value={difficulty} onChange={setDifficulty} options={DIFFICULTY_OPTS}
              />
            </Space>
            <Space size={6}>
              <Text type="secondary" style={{ fontSize: 12 }}>Задач:</Text>
              <InputNumber min={1} max={40} size="small" value={count} onChange={(v) => setCount(v || 10)} style={{ width: 70 }} />
            </Space>
          </Space>
          <Input size="small" placeholder="Название (необязательно)" value={title}
            onChange={(e) => setTitle(e.target.value)} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Задачи берутся из существующего банка — новые в базе не создаются. Это простой
            генератор тренажёров (например, устный счёт); предметные работы удобнее собирать
            через «Рабочие листы».
          </Text>
        </Space>
      )}
    </Modal>
  );
}

function BlockRow({ label, hint, checked, onToggle, children }) {
  return (
    <div>
      <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
        <div>
          <Text strong>{label}</Text>
          {hint && <div><Text type="secondary" style={{ fontSize: 12 }}>{hint}</Text></div>}
        </div>
        <Switch checked={checked} onChange={onToggle} />
      </Space>
      {checked && children && <div style={{ marginTop: 8 }}>{children}</div>}
    </div>
  );
}

function NumPair({ a, aLabel, b, bLabel, onA, onB }) {
  return (
    <Space size={16} wrap>
      <Space size={6}>
        <InputNumber min={1} max={20} size="small" value={a} onChange={onA} style={{ width: 64 }} />
        <Text type="secondary" style={{ fontSize: 12 }}>{aLabel}</Text>
      </Space>
      <Space size={6}>
        <InputNumber min={1} max={20} size="small" value={b} onChange={onB} style={{ width: 64 }} />
        <Text type="secondary" style={{ fontSize: 12 }}>{bLabel}</Text>
      </Space>
    </Space>
  );
}
