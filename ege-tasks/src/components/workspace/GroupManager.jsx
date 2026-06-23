import { useCallback, useEffect, useState } from 'react';
import {
  App,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EditOutlined,
  InboxOutlined,
  PlusOutlined,
  TeamOutlined,
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

  useEffect(() => {
    if (open) {
      form.setFieldsValue(
        initial || {
          name: '',
          subject: 'Математика',
          grade: null,
          hours_per_week: null,
          umk: '',
          year: defaultYear(),
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
        <Form.Item
          name="name"
          label="Название"
          rules={[{ required: true, message: 'Введите название (напр. «9А»)' }]}
        >
          <Input placeholder="9А" maxLength={100} autoFocus />
        </Form.Item>
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

  const columns = [
    {
      title: 'Группа',
      dataIndex: 'name',
      key: 'name',
      render: (name, g) => (
        <Space size={8}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            background: groupHex(g.id || name).base, display: 'inline-block',
          }}
          />
          <Button type="link" style={{ padding: 0, fontWeight: 600 }} onClick={() => navigate(`/app/groups/${g.id}`)}>
            {name}
          </Button>
          {g.archived && <Tag style={{ margin: 0 }}>архив</Tag>}
        </Space>
      ),
    },
    { title: 'Предмет', dataIndex: 'subject', key: 'subject', responsive: ['md'] },
    {
      title: 'Класс',
      dataIndex: 'grade',
      key: 'grade',
      width: 80,
      render: (g) => (g ? `${g} кл.` : '—'),
    },
    {
      title: 'Часов/нед',
      dataIndex: 'hours_per_week',
      key: 'hours_per_week',
      width: 100,
      responsive: ['lg'],
      render: (h) => (h != null ? h : '—'),
    },
    { title: 'УМК', dataIndex: 'umk', key: 'umk', responsive: ['lg'], render: (u) => u || '—' },
    { title: 'Год', dataIndex: 'year', key: 'year', width: 110, responsive: ['md'], render: (y) => y || '—' },
    {
      title: 'Учеников',
      key: 'students',
      width: 100,
      render: (_, g) => (
        <Chip tone={counts[g.id] ? 'blue' : 'neutral'} dot={false}>
          <TeamOutlined style={{ marginRight: 4 }} />{counts[g.id] ?? 0}
        </Chip>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 190,
      render: (_, g, index) => (
        <Space>
          {canEdit && (
            <Button.Group>
              <Button
                size="small"
                icon={<ArrowUpOutlined />}
                disabled={reordering || index === 0}
                title="Выше"
                onClick={() => handleMove(index, -1)}
              />
              <Button
                size="small"
                icon={<ArrowDownOutlined />}
                disabled={reordering || index === groups.length - 1}
                title="Ниже"
                onClick={() => handleMove(index, 1)}
              />
            </Button.Group>
          )}
          {canEdit && (
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setEditing(g);
                setModalOpen(true);
              }}
            />
          )}
          {canEdit && (
            <Button
              size="small"
              icon={<InboxOutlined />}
              title={g.archived ? 'Восстановить' : 'В архив'}
              onClick={() => handleArchive(g)}
            />
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
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

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

      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={groups}
        pagination={false}
        locale={{
          emptyText: showArchived ? (
            <EmptyState title="Архив пуст" description="Сюда попадают группы, отправленные в архив" />
          ) : (
            <EmptyState
              title="Пока нет групп"
              description="Создайте первый класс — к нему привяжутся ученики, журнал и планирование"
              cta={canEdit ? 'Новая группа' : undefined}
              ctaIcon={<PlusOutlined />}
              onCta={() => { setEditing(null); setModalOpen(true); }}
            />
          ),
        }}
      />

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
