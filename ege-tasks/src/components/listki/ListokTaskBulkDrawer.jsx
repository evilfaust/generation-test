import { useMemo, useState } from 'react';
import { Button, Divider, Drawer, Radio, Select, Space, Tag, Typography } from 'antd';
import { SettingOutlined, CloseOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const EXAM_TYPE_LABELS = {
  ege_base: 'ЕГЭ базовый (11 кл.)',
  ege_profile: 'ЕГЭ профильный (11 кл.)',
  oge: 'ОГЭ (9 кл.)',
  vpr: 'ВПР',
  oral: 'Устный счёт',
  trig: 'Тригонометрия',
  mordkovich: 'Мордкович',
  other: 'Прочее',
};

const DIFFICULTY_OPTIONS = [
  { label: '1 — Базовый', value: '1' },
  { label: '2 — Средний', value: '2' },
  { label: '3 — Повышенный', value: '3' },
  { label: '4 — Высокий', value: '4' },
  { label: '5 — Олимпиадный', value: '5' },
];

const topicLabel = (t) => (t.ege_number ? `№${t.ege_number} — ${t.title}` : t.title);

/**
 * Drawer массового изменения атрибутов задач листка.
 * Чистый UI: операции (api.updateTask + reload) выполняет родитель через коллбэки.
 */
export default function ListokTaskBulkDrawer({
  open, onClose, count, loading,
  topics = [], subtopics = [], tags = [],
  onApplyMove, onApplyTags, onApplyDifficulty, onClearSelection,
}) {
  const [examType, setExamType] = useState(null);
  const [topic, setTopic] = useState(null);
  const [subs, setSubs] = useState([]);
  const [tagIds, setTagIds] = useState([]);
  const [tagMode, setTagMode] = useState('add');
  const [difficulty, setDifficulty] = useState(null);

  // Контексты, реально присутствующие среди тем
  const examOptions = useMemo(() => {
    const present = new Set((topics || []).map((t) => t.exam_type).filter(Boolean));
    return [...present].map((v) => ({ label: EXAM_TYPE_LABELS[v] || v, value: v }));
  }, [topics]);

  const topicOptions = useMemo(
    () => (topics || [])
      .filter((t) => !examType || t.exam_type === examType)
      .map((t) => ({ label: topicLabel(t), value: t.id })),
    [topics, examType],
  );

  const subOptions = useMemo(
    () => (subtopics || [])
      .filter((st) => st.topic === topic)
      .map((st) => ({ label: st.name || st.title, value: st.id })),
    [subtopics, topic],
  );

  return (
    <Drawer
      title={<Space><SettingOutlined /><span>Изменить атрибуты</span><Tag color="blue">{count}</Tag></Space>}
      open={open}
      onClose={onClose}
      width={380}
      mask={false}
      extra={(
        <Button size="small" icon={<CloseOutlined />} onClick={onClearSelection}>Снять выделение</Button>
      )}
    >
      {/* Контекст → Тема → Подтема */}
      <Title level={5} style={{ marginTop: 0 }}>Перенести в каталог</Title>
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        <Select
          placeholder="Контекст (необязательно — фильтрует темы)…"
          value={examType}
          onChange={(v) => { setExamType(v); setTopic(null); setSubs([]); }}
          style={{ width: '100%' }}
          options={examOptions}
          disabled={loading}
          allowClear
        />
        <Select
          placeholder="1. Выберите тему…"
          value={topic}
          onChange={(v) => { setTopic(v); setSubs([]); }}
          style={{ width: '100%' }}
          options={topicOptions}
          disabled={loading}
          showSearch
          optionFilterProp="label"
          allowClear
        />
        <Select
          mode="multiple"
          placeholder={topic ? '2. Подтемы (необязательно)…' : 'Сначала выберите тему'}
          value={subs}
          onChange={setSubs}
          style={{ width: '100%' }}
          options={subOptions}
          disabled={loading || !topic}
          showSearch
          optionFilterProp="label"
        />
        <Button
          block
          type="primary"
          loading={loading}
          disabled={!topic}
          onClick={() => onApplyMove(topic, subs)}
        >
          Перенести {count ? `${count} задач(и)` : 'задачи'}
        </Button>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Контекст задаётся выбранной темой. После переноса задачи появятся в общем
          каталоге по теме/подтеме. Без подтем — переносятся только в тему.
        </Text>
      </Space>

      <Divider />

      {/* Теги */}
      <Title level={5}>Теги</Title>
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        <Select
          mode="multiple"
          placeholder="Выберите теги…"
          value={tagIds}
          onChange={setTagIds}
          style={{ width: '100%' }}
          options={(tags || []).map((t) => ({ label: t.title, value: t.id }))}
          disabled={loading}
        />
        <Radio.Group
          value={tagMode}
          onChange={(e) => setTagMode(e.target.value)}
          disabled={loading}
          size="small"
          optionType="button"
          buttonStyle="solid"
          options={[{ label: 'Добавить', value: 'add' }, { label: 'Заменить', value: 'replace' }]}
        />
        <Button
          type="primary"
          block
          loading={loading}
          disabled={!tagIds.length}
          onClick={() => onApplyTags(tagIds, tagMode)}
        >
          {tagMode === 'replace' ? 'Заменить теги' : 'Добавить теги'}
        </Button>
      </Space>

      <Divider />

      {/* Сложность */}
      <Title level={5}>Сложность</Title>
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        <Select
          placeholder="Выберите сложность…"
          value={difficulty}
          onChange={setDifficulty}
          style={{ width: '100%' }}
          options={DIFFICULTY_OPTIONS}
          disabled={loading}
          allowClear
        />
        <Button block loading={loading} disabled={!difficulty} onClick={() => onApplyDifficulty(difficulty)}>
          Применить сложность
        </Button>
      </Space>
    </Drawer>
  );
}
