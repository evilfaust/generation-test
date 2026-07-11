import { useCallback, useEffect, useState } from 'react';
import {
  App,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
} from 'antd';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EditOutlined,
  FundProjectionScreenOutlined,
  InboxOutlined,
  PlusOutlined,
  TeamOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../../shared/services/pocketbase';
import { useAuth } from '../../contexts/AuthContext';
import { WorkspacePageHeader, EmptyState, Chip, groupHex } from './ui';

const { Text } = Typography;

// Дефолтный учебный год вида «2025/2026» по текущей дате (учебный год с сентября).
function defaultYear() {
  const now = new Date();
  const y = now.getFullYear();
  const start = now.getMonth() >= 7 ? y : y - 1; // с августа считаем новый учебный год
  return `${start}/${start + 1}`;
}

function GroupModal({ open, initial, onSave, onCancel, saving }) {
  const [form] = Form.useForm();
  const kind = Form.useWatch('kind', form) || 'class';

  useEffect(() => {
    if (open) {
      form.setFieldsValue(
        initial
          ? { kind: 'class', ...initial }
          : {
            name: '',
            subject: 'Математика',
            grade: null,
            hours_per_week: null,
            umk: '',
            year: defaultYear(),
            kind: 'class',
            conference_url: '',
            board_url: '',
          },
      );
    }
  }, [open, initial, form]);

  return (
    <Modal
      open={open}
      title={initial ? 'Редактировать группу' : 'Новая группа'}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={saving}
      okText={initial ? 'Сохранить' : 'Создать'}
      cancelText="Отмена"
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={onSave} style={{ marginTop: 8 }}>
        <Form.Item name="kind" label="Тип">
          <Select
            options={[
              { value: 'class', label: 'Класс / группа (обычная)' },
              { value: 'course', label: 'Курс с кабинетом для учеников (онлайн-интенсив)' },
            ]}
          />
        </Form.Item>
        <Form.Item
          name="name"
          label="Название"
          rules={[{ required: true, message: 'Введите название (напр. «9А»)' }]}
        >
          <Input placeholder={kind === 'course' ? 'Летний интенсив 10 кл.' : '9А'} maxLength={100} autoFocus />
        </Form.Item>
        {kind === 'course' && (
          <>
            <Form.Item
              name="conference_url"
              label="Ссылка на конференцию (комната курса)"
              tooltip="Постоянная ссылка на телемост. На конкретном занятии её можно переопределить. Видна ученикам курса."
            >
              <Input prefix={<VideoCameraOutlined />} placeholder="https://telemost.yandex.ru/j/..." maxLength={1000} />
            </Form.Item>
            <Form.Item
              name="board_url"
              label="Ссылка на онлайн-доску (для всего курса)"
              tooltip="Постоянная доска курса (Miro, Excalidraw и т.п.). Видна ученикам курса рядом с комнатой."
            >
              <Input prefix={<FundProjectionScreenOutlined />} placeholder="https://miro.com/app/board/..." maxLength={1000} />
            </Form.Item>
          </>
        )}
        <Form.Item name="subject" label="Предмет">
          <Input placeholder="Математика" maxLength={100} />
        </Form.Item>
        <Space size="large" style={{ display: 'flex' }}>
          <Form.Item name="grade" label="Класс обучения" style={{ flex: 1 }}>
            <InputNumber min={1} max={11} style={{ width: '100%' }} placeholder="9" />
          </Form.Item>
          <Form.Item name="hours_per_week" label="Часов в неделю" style={{ flex: 1 }}>
            <InputNumber min={0} max={40} step={0.5} style={{ width: '100%' }} placeholder="5" />
          </Form.Item>
        </Space>
        <Form.Item name="umk" label="УМК">
          <Input placeholder="Мерзляк / Макарычев / Атанасян…" maxLength={200} />
        </Form.Item>
        <Form.Item name="year" label="Учебный год">
          <Input placeholder="2025/2026" maxLength={20} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default function GroupManager() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { canEdit, canDelete } = useAuth();

  const [groups, setGroups] = useState([]);
  const [counts, setCounts] = useState({}); // groupId -> кол-во учеников
  const [loading, setLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.getTeachingGroups({ includeArchived: showArchived });
      setGroups(list);
      // Лёгкий подсчёт учеников по каждой группе (параллельно).
      const entries = await Promise.all(
        list.map(async (g) => {
          try {
            const studs = await api.getStudentsByGroup(g.id);
            return [g.id, studs.length];
          } catch {
            return [g.id, 0];
          }
        }),
      );
      setCounts(Object.fromEntries(entries));
    } catch (e) {
      message.error('Не удалось загрузить группы');
    } finally {
      setLoading(false);
    }
  }, [showArchived, message]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (values) => {
    setSaving(true);
    try {
      if (editing) {
        await api.updateTeachingGroup(editing.id, values);
        message.success('Группа обновлена');
      } else {
        await api.createTeachingGroup(values);
        message.success('Группа создана');
      }
      setModalOpen(false);
      setEditing(null);
      load();
    } catch (e) {
      message.error('Не удалось сохранить группу');
    } finally {
      setSaving(false);
    }
  };

  // Переместить группу вверх/вниз в списке (dir = -1 | +1).
  const handleMove = async (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= groups.length) return;
    const prev = groups;
    const next = [...groups];
    [next[index], next[target]] = [next[target], next[index]];
    setGroups(next); // оптимистично
    setReordering(true);
    try {
      await api.reorderTeachingGroups(next.map((g) => g.id), prev);
    } catch {
      message.error('Не удалось изменить порядок');
      setGroups(prev); // откат
    } finally {
      setReordering(false);
    }
  };

  const handleArchive = async (group) => {
    try {
      await api.archiveTeachingGroup(group.id, !group.archived);
      message.success(group.archived ? 'Группа восстановлена' : 'Группа в архиве');
      load();
    } catch {
      message.error('Не удалось изменить статус');
    }
  };

  const handleDelete = async (group) => {
    try {
      await api.deleteTeachingGroup(group.id);
      message.success('Группа удалена');
      load();
    } catch {
      message.error('Не удалось удалить группу');
    }
  };

  const stop = (e) => e.stopPropagation();

  const renderCard = (g, index) => {
    const hex = groupHex(g.id || g.name);
    const n = counts[g.id] ?? 0;
    const initials = (g.name || '?').replace(/[«»"]/g, '').trim().slice(0, 2).toUpperCase();
    const meta = [
      g.grade != null && <span key="grade"><b>{g.grade}</b> кл.</span>,
      g.hours_per_week != null && <span key="hpw"><b>{g.hours_per_week}</b> ч/нед</span>,
      g.umk && <span key="umk">{g.umk}</span>,
      g.year && <span key="year">{g.year}</span>,
    ].filter(Boolean);
    return (
      <div
        key={g.id}
        className={`ws-tile${g.archived ? ' ws-tile--muted' : ''}`}
        onClick={() => navigate(`/app/groups/${g.id}`)}
      >
        <div className="ws-tile__top">
          <span className="ws-tile__badge" style={{ color: hex.base, background: hex.soft }}>{initials}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="ws-tile__name">
              {g.name}
              {g.kind === 'course' && <Tag color="purple" style={{ marginLeft: 6 }}>курс</Tag>}
              {g.archived && <Tag style={{ marginLeft: 6 }}>архив</Tag>}
            </div>
            {g.subject && <div className="ws-tile__sub">{g.subject}</div>}
          </div>
        </div>

        {meta.length > 0 && <div className="ws-tile__meta">{meta}</div>}

        <div className="ws-tile__foot">
          <Chip tone={n ? 'blue' : 'neutral'} dot={false}>
            <TeamOutlined style={{ marginRight: 4 }} />{n}
          </Chip>
          {(canEdit || canDelete) && (
            <div className="ws-tile__actions" onClick={stop}>
              {canEdit && (
                <Button.Group>
                  <Button size="small" type="text" icon={<ArrowUpOutlined />} disabled={reordering || index === 0} title="Выше" onClick={() => handleMove(index, -1)} />
                  <Button size="small" type="text" icon={<ArrowDownOutlined />} disabled={reordering || index === groups.length - 1} title="Ниже" onClick={() => handleMove(index, 1)} />
                </Button.Group>
              )}
              {canEdit && (
                <Button size="small" type="text" icon={<EditOutlined />} title="Редактировать" onClick={() => { setEditing(g); setModalOpen(true); }} />
              )}
              {canEdit && (
                <Button size="small" type="text" icon={<InboxOutlined />} title={g.archived ? 'Восстановить' : 'В архив'} onClick={() => handleArchive(g)} />
              )}
              {canDelete && (
                <Popconfirm
                  title="Удалить группу?"
                  description="Ученики не удаляются, только отвязываются."
                  okText="Удалить"
                  cancelText="Отмена"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => handleDelete(g)}
                >
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} title="Удалить" />
                </Popconfirm>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 1100 }}>
      <WorkspacePageHeader
        icon={<TeamOutlined />}
        accent="blue"
        title="Классы и группы"
        subtitle="Ваши учебные группы — основа планирования и журнала"
        extra={(
          <>
            <Space size={4}>
              <Switch checked={showArchived} onChange={setShowArchived} size="small" />
              <Text type="secondary">архив</Text>
            </Space>
            {canEdit && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditing(null);
                  setModalOpen(true);
                }}
              >
                Новая группа
              </Button>
            )}
          </>
        )}
      />

      {loading && !groups.length ? (
        <div style={{ textAlign: 'center', padding: 64 }}><Spin /></div>
      ) : groups.length ? (
        <div className="ws-grid">{groups.map(renderCard)}</div>
      ) : showArchived ? (
        <EmptyState title="Архив пуст" description="Сюда попадают группы, отправленные в архив" />
      ) : (
        <EmptyState
          title="Пока нет групп"
          description="Создайте первый класс — к нему привяжутся ученики, журнал и планирование"
          cta={canEdit ? 'Новая группа' : undefined}
          ctaIcon={<PlusOutlined />}
          onCta={() => { setEditing(null); setModalOpen(true); }}
        />
      )}

      <GroupModal
        open={modalOpen}
        initial={editing}
        saving={saving}
        onSave={handleSave}
        onCancel={() => {
          setModalOpen(false);
          setEditing(null);
        }}
      />
    </div>
  );
}
