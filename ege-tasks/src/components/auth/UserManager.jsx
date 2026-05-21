/**
 * UserManager — управление учителями.
 *
 * Доступно только superadmin (защищено через ProtectedRoute requireSuperAdmin).
 *
 * Возможности:
 * - Список всех учителей с ролями и набором секций.
 * - Создание нового учителя (username + password + name + role + allowed_sections).
 * - Редактирование (включая смену пароля).
 * - Удаление (нельзя удалить самого себя).
 */
import { useEffect, useState, useMemo } from 'react';
import {
  Table, Button, Space, Tag, Modal, Form, Input, Select, Checkbox,
  Popconfirm, message, Typography, Card, Empty,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, KeyOutlined,
  CrownOutlined, EyeOutlined, UserOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '../../services/pocketbase';
import { useAuth } from '../../contexts/AuthContext';
import { ALL_SECTIONS } from '../../contexts/AuthContext';

const { Title, Text } = Typography;

const ROLE_OPTIONS = [
  { value: 'superadmin', label: 'Суперадмин', color: 'gold',  icon: <CrownOutlined /> },
  { value: 'editor',     label: 'Редактор',   color: 'blue',  icon: <EditOutlined /> },
  { value: 'viewer',     label: 'Зритель',    color: 'default', icon: <EyeOutlined /> },
];

// Человекочитаемые названия секций — должны совпадать с ALL_SECTIONS.
const SECTION_LABELS = {
  tasks:        'Задачи + Аналитика',
  worksheets:   'Рабочие листы',
  gamification: 'Геймификация',
  works:        'Мои работы',
  students:     'Ученики',
  geometry:     'Геометрия',
  tdf:          'ТДФ',
  trig:         'Тригонометрия',
  arith:        'Устный счёт',
  theory:       'Теория',
  lab:          'Лаборатория',
  import:       'Импорт задач',
  admin:        'Управление пользователями',
};

// Для редактора/зрителя секцию `admin` не показываем — она только для superadmin (он и так видит всё).
const SELECTABLE_SECTIONS = ALL_SECTIONS.filter((s) => s !== 'admin');

export default function UserManager() {
  const { teacher: currentTeacher } = useAuth();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null); // null = create mode
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getTeachers();
      setTeachers(data);
    } catch (e) {
      message.error('Не удалось загрузить список учителей');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditingTeacher(null);
    form.resetFields();
    form.setFieldsValue({
      role: 'editor',
      allowed_sections: ['tasks', 'worksheets', 'works'],
    });
    setModalOpen(true);
  };

  const openEdit = (record) => {
    setEditingTeacher(record);
    form.setFieldsValue({
      username: record.username,
      name: record.name,
      role: record.role,
      allowed_sections: Array.isArray(record.allowed_sections) ? record.allowed_sections : [],
      password: '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      if (editingTeacher) {
        const payload = {
          name: values.name,
          role: values.role,
          allowed_sections: values.role === 'superadmin' ? [] : (values.allowed_sections || []),
        };
        if (values.password) payload.password = values.password;
        await api.updateTeacher(editingTeacher.id, payload);
        message.success('Учитель обновлён');
      } else {
        await api.createTeacher({
          username: values.username,
          name: values.name,
          password: values.password,
          role: values.role,
          allowed_sections: values.role === 'superadmin' ? [] : (values.allowed_sections || []),
        });
        message.success('Учитель создан');
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      const msg = e?.data?.data
        ? Object.entries(e.data.data).map(([k, v]) => `${k}: ${v.message || v.code}`).join('; ')
        : e?.message || 'Неизвестная ошибка';
      message.error(`Ошибка: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteTeacher(id);
      message.success('Учитель удалён');
      await load();
    } catch (e) {
      message.error(`Не удалось удалить: ${e?.message || 'ошибка'}`);
    }
  };

  const watchedRole = Form.useWatch('role', form);

  const columns = useMemo(() => [
    {
      title: 'Пользователь',
      dataIndex: 'username',
      key: 'username',
      render: (username, record) => (
        <Space>
          <UserOutlined />
          <div>
            <div style={{ fontWeight: 500 }}>{record.name}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>@{username}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Роль',
      dataIndex: 'role',
      key: 'role',
      width: 140,
      render: (role) => {
        const meta = ROLE_OPTIONS.find((r) => r.value === role);
        return meta ? (
          <Tag color={meta.color} icon={meta.icon}>{meta.label}</Tag>
        ) : <Tag>{role}</Tag>;
      },
      filters: ROLE_OPTIONS.map((r) => ({ text: r.label, value: r.value })),
      onFilter: (val, record) => record.role === val,
    },
    {
      title: 'Доступные секции',
      dataIndex: 'allowed_sections',
      key: 'allowed_sections',
      render: (sections, record) => {
        if (record.role === 'superadmin') {
          return <Tag color="gold">Все секции</Tag>;
        }
        const arr = Array.isArray(sections) ? sections : [];
        if (arr.length === 0) return <Text type="secondary">— ничего —</Text>;
        return (
          <Space size={[4, 4]} wrap>
            {arr.map((s) => (
              <Tag key={s} style={{ marginRight: 0 }}>{SECTION_LABELS[s] || s}</Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: 'Последний вход',
      dataIndex: 'last_login',
      key: 'last_login',
      width: 140,
      render: (v) => {
        if (!v) return <Text type="secondary" style={{ fontSize: 12 }}>— никогда —</Text>;
        const d = dayjs(v);
        const isToday = d.isSame(dayjs(), 'day');
        return (
          <div>
            <div style={{ fontSize: 13 }}>{isToday ? 'сегодня' : d.format('DD.MM.YYYY')}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>{d.format('HH:mm')}</Text>
          </div>
        );
      },
      sorter: (a, b) => (a.last_login || '').localeCompare(b.last_login || ''),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 180,
      render: (_, record) => {
        const isSelf = record.id === currentTeacher?.id;
        return (
          <Space>
            <Button
              icon={<EditOutlined />}
              size="small"
              onClick={() => openEdit(record)}
            >
              Изменить
            </Button>
            <Popconfirm
              title="Удалить учителя?"
              description={`Точно удалить ${record.username}? Действие нельзя отменить.`}
              okText="Удалить"
              cancelText="Отмена"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleDelete(record.id)}
              disabled={isSelf}
            >
              <Button
                icon={<DeleteOutlined />}
                size="small"
                danger
                disabled={isSelf}
                title={isSelf ? 'Нельзя удалить самого себя' : undefined}
              />
            </Popconfirm>
          </Space>
        );
      },
    },
  ], [currentTeacher]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Управление пользователями</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Создать учителя
        </Button>
      </div>

      <Card bodyStyle={{ padding: 0 }}>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={teachers}
          columns={columns}
          pagination={false}
          locale={{ emptyText: <Empty description="Учителей пока нет" /> }}
        />
      </Card>

      <Modal
        title={editingTeacher ? `Редактирование: ${editingTeacher.username}` : 'Новый учитель'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText={editingTeacher ? 'Сохранить' : 'Создать'}
        cancelText="Отмена"
        width={640}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
        >
          <Form.Item
            label="Имя пользователя (для входа)"
            name="username"
            rules={[
              { required: true, message: 'Введите имя пользователя' },
              { min: 3, message: 'Минимум 3 символа' },
              { pattern: /^[\w][\w.\-]*$/, message: 'Только буквы, цифры, _ . -' },
            ]}
          >
            <Input disabled={!!editingTeacher} placeholder="ivanov" autoComplete="off" />
          </Form.Item>

          <Form.Item
            label="Имя (отображаемое)"
            name="name"
            rules={[{ required: true, message: 'Введите имя' }, { min: 2 }]}
          >
            <Input placeholder="Иван Иванов" />
          </Form.Item>

          <Form.Item
            label={editingTeacher
              ? <Space><KeyOutlined /> Новый пароль (оставьте пустым, чтобы не менять)</Space>
              : <Space><KeyOutlined /> Пароль</Space>
            }
            name="password"
            rules={editingTeacher ? [] : [
              { required: true, message: 'Введите пароль' },
              { min: 8, message: 'Минимум 8 символов' },
            ]}
          >
            <Input.Password placeholder={editingTeacher ? 'без изменений' : 'минимум 8 символов'} autoComplete="new-password" />
          </Form.Item>

          <Form.Item
            label="Роль"
            name="role"
            rules={[{ required: true }]}
          >
            <Select options={ROLE_OPTIONS.map((r) => ({ value: r.value, label: <Space>{r.icon}{r.label}</Space> }))} />
          </Form.Item>

          {watchedRole === 'superadmin' ? (
            <Card size="small" style={{ background: '#fffbe6', borderColor: '#ffe58f' }}>
              <Text>
                <CrownOutlined style={{ color: '#faad14' }} /> Суперадмин видит <b>все секции</b> автоматически.
                Также может управлять пользователями и просматривать журнал действий.
              </Text>
            </Card>
          ) : (
            <Form.Item
              label="Доступные секции"
              name="allowed_sections"
              tooltip="Секции, видимые в меню для этого пользователя"
            >
              <Checkbox.Group style={{ width: '100%' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {SELECTABLE_SECTIONS.map((s) => (
                    <Checkbox key={s} value={s}>
                      {SECTION_LABELS[s] || s}
                    </Checkbox>
                  ))}
                </div>
              </Checkbox.Group>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}
