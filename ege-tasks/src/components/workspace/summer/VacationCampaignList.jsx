import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  App, Button, Card, DatePicker, Form, Input, List, Modal, Select, Space,
  Spin, Tag, Typography,
} from 'antd';
import { PlusOutlined, RightOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { api } from '../../../shared/services/pocketbase';
import { WorkspacePageHeader, EmptyState, GroupChip, Chip } from '../ui';

const { Text } = Typography;

const STATUS_COLOR = { draft: 'default', issued: 'blue', archived: 'default' };
const STATUS_LABEL = { draft: 'Черновик', issued: 'Выдано', archived: 'Архив' };

function CampaignCard({ campaign, onClick }) {
  const group = campaign.expand?.group;
  return (
    <List.Item
      className="ws-clickable"
      style={{ padding: '12px 16px', cursor: 'pointer' }}
      onClick={onClick}
      actions={[<RightOutlined key="go" style={{ color: '#bbb' }} />]}
    >
      <List.Item.Meta
        title={
          <Space>
            <Text strong>{campaign.title || '(без названия)'}</Text>
            <Tag color={STATUS_COLOR[campaign.status] || 'default'}>
              {STATUS_LABEL[campaign.status] || campaign.status}
            </Tag>
          </Space>
        }
        description={
          <Space wrap size={4}>
            {campaign.season && <Chip tone="violet">{campaign.season}</Chip>}
            {campaign.year && <Text type="secondary">{campaign.year}</Text>}
            {group && <GroupChip id={group.id}>{group.name}</GroupChip>}
            {campaign.deadline && (
              <Text type="secondary">
                до {dayjs(campaign.deadline).format('D MMM')}
              </Text>
            )}
          </Space>
        }
      />
    </List.Item>
  );
}

function CreateCampaignModal({ open, groups, onClose, onCreate }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const handleOk = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const data = {
        ...values,
        deadline: values.deadline ? values.deadline.toISOString() : null,
        year: values.year || new Date().getFullYear(),
      };
      delete data.year_picker; // dayjs year picker if used
      await onCreate(data);
      form.resetFields();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Новая кампания"
      okText="Создать"
      cancelText="Отмена"
      onOk={handleOk}
      onCancel={onClose}
      confirmLoading={saving}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}
        initialValues={{ year: new Date().getFullYear(), mode: 'individual' }}
      >
        <Form.Item name="title" label="Название" rules={[{ required: true, message: 'Укажите название' }]}>
          <Input placeholder="Летнее задание 10А 2026" maxLength={300} />
        </Form.Item>
        <Form.Item name="season" label="Сезон / повод">
          <Input placeholder="Лето, Зима, Майские праздники…" maxLength={80} />
        </Form.Item>
        <Form.Item name="group" label="Группа / класс">
          <Select
            allowClear
            placeholder="Выберите группу"
            options={groups.map((g) => ({ value: g.id, label: `${g.name}${g.grade ? ` · ${g.grade} кл.` : ''}` }))}
          />
        </Form.Item>
        <Form.Item name="year" label="Учебный год">
          <Select options={[0, 1, 2].map((d) => {
            const y = new Date().getFullYear() + d;
            return { value: y, label: String(y) };
          })} />
        </Form.Item>
        <Form.Item name="deadline" label="Дедлайн">
          <DatePicker style={{ width: '100%' }} placeholder="Выберите дату" format="D MMMM YYYY" />
        </Form.Item>
        <Form.Item name="mode" label="Режим задания">
          <Select options={[
            { value: 'individual', label: '📊 Индивидуальное (по профилю слабостей)' },
            { value: 'identical',  label: '👥 Одинаковое для всех' },
          ]} />
        </Form.Item>
        <Form.Item name="instructions" label="Инструкция для учеников">
          <Input.TextArea rows={3} placeholder="Общее описание задания, пожелания…" maxLength={2000} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default function VacationCampaignList() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [campaigns, setCampaigns] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [c, g] = await Promise.all([api.getCampaigns(), api.getTeachingGroups()]);
      setCampaigns(c);
      setGroups(g);
    } catch {
      message.error('Не удалось загрузить кампании');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async (data) => {
    try {
      const rec = await api.createCampaign(data);
      message.success('Кампания создана');
      navigate(`/app/summer/campaign/${rec.id}`);
    } catch {
      message.error('Не удалось создать кампанию');
    }
  };

  // Разбиваем кампании по годам для группировки
  const byYear = useMemo(() => {
    const map = new Map();
    for (const c of campaigns) {
      const y = c.year || 0;
      if (!map.has(y)) map.set(y, []);
      map.get(y).push(c);
    }
    return [...map.entries()].sort(([a], [b]) => b - a);
  }, [campaigns]);

  return (
    <div>
      <WorkspacePageHeader
        accent="violet"
        icon={<TeamOutlined />}
        title="Каникулярные задания"
        subtitle="Кампании для классов и индивидуальные программы"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            Новая кампания
          </Button>
        }
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
      ) : campaigns.length === 0 ? (
        <EmptyState
          title="Кампаний пока нет"
          description="Создайте кампанию, чтобы выдать каникулярное задание классу или отдельному ученику."
          action={<Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>Создать первую</Button>}
        />
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          {byYear.map(([year, items]) => (
            <Card
              key={year}
              size="small"
              title={<Text type="secondary" style={{ fontSize: 13 }}>{year || 'Без года'}</Text>}
              styles={{ body: { padding: 0 } }}
            >
              <List
                dataSource={items}
                renderItem={(c) => (
                  <CampaignCard
                    key={c.id}
                    campaign={c}
                    onClick={() => navigate(`/app/summer/campaign/${c.id}`)}
                  />
                )}
              />
            </Card>
          ))}
        </Space>
      )}

      {/* Быстрый переход к индивидуальным программам (без кампании) */}
      {!loading && (
        <Card
          size="small"
          style={{ marginTop: 16 }}
          styles={{ body: { padding: '10px 16px' } }}
        >
          <Space>
            <UserOutlined style={{ color: '#999' }} />
            <Text type="secondary">Индивидуальные программы (без кампании)</Text>
            <Button size="small" type="link" onClick={() => navigate('/app/summer/individual')}>
              Перейти →
            </Button>
          </Space>
        </Card>
      )}

      <CreateCampaignModal
        open={modalOpen}
        groups={groups}
        onClose={() => setModalOpen(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}
