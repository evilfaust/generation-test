import { useCallback, useEffect, useState } from 'react';
import {
  App, Button, Form, Input, Modal, Popconfirm, Select, Space, Spin, Switch, Tag, Typography,
} from 'antd';
import {
  DeleteOutlined, EditOutlined, InboxOutlined, PlusOutlined, ScheduleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../../shared/services/pocketbase';
import { useAuth } from '../../contexts/AuthContext';
import { WorkspacePageHeader, EmptyState, GroupChip, groupHex, TONE_HEX } from './ui';

const { Text } = Typography;

function defaultYear() {
  const now = new Date();
  const y = now.getFullYear();
  const start = now.getMonth() >= 7 ? y : y - 1;
  return `${start}/${start + 1}`;
}

function CourseModal({ open, initial, groups, onSave, onCancel, saving }) {
  const [form] = Form.useForm();
  useEffect(() => {
    if (open) {
      form.setFieldsValue(
        initial
          ? { title: initial.title, group: initial.group || undefined, year: initial.year }
          : { title: '', group: undefined, year: defaultYear() },
      );
    }
  }, [open, initial, form]);

  return (
    <Modal
      open={open}
      title={initial ? 'Редактировать КТП' : 'Новое КТП'}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={saving}
      okText={initial ? 'Сохранить' : 'Создать'}
      cancelText="Отмена"
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onFinish={onSave} style={{ marginTop: 8 }}>
        <Form.Item name="title" label="Название" rules={[{ required: true, message: 'Введите название' }]}>
          <Input placeholder="Математика, 9 класс" maxLength={200} autoFocus />
        </Form.Item>
        <Form.Item name="group" label="Группа">
          <Select
            allowClear
            placeholder="Привязать к группе (необязательно)"
            options={groups.map((g) => ({ value: g.id, label: g.name }))}
          />
        </Form.Item>
        <Form.Item name="year" label="Учебный год">
          <Input placeholder="2025/2026" maxLength={20} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default function KtpList() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { canEdit, canDelete } = useAuth();

  const [courses, setCourses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, g] = await Promise.all([
        api.getCourses({ includeArchived: showArchived }),
        api.getTeachingGroups(),
      ]);
      setCourses(c);
      setGroups(g);
    } catch {
      message.error('Не удалось загрузить КТП');
    } finally {
      setLoading(false);
    }
  }, [showArchived, message]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (values) => {
    setSaving(true);
    try {
      if (editing) {
        await api.updateCourse(editing.id, values);
        message.success('КТП обновлено');
      } else {
        const rec = await api.createCourse(values);
        message.success('КТП создано');
        navigate(`/app/ktp/${rec.id}`);
      }
      setModalOpen(false);
      setEditing(null);
      load();
    } catch {
      message.error('Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (c) => {
    try {
      await api.archiveCourse(c.id, !c.archived);
      load();
    } catch { message.error('Не удалось'); }
  };

  const handleDelete = async (c) => {
    try {
      await api.deleteCourse(c.id);
      message.success('КТП удалено');
      load();
    } catch { message.error('Не удалось удалить'); }
  };

  const stop = (e) => e.stopPropagation();

  const renderCard = (c) => {
    const hex = c.expand?.group?.name ? groupHex(c.group || c.expand.group.name) : TONE_HEX.violet;
    return (
      <div key={c.id} className={`ws-tile${c.archived ? ' ws-tile--muted' : ''}`} onClick={() => navigate(`/app/ktp/${c.id}`)}>
        <div className="ws-tile__top">
          <span className="ws-tile__badge" style={{ color: hex.base, background: hex.soft }}><ScheduleOutlined /></span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="ws-tile__name">{c.title}{c.archived && <Tag style={{ marginLeft: 6 }}>архив</Tag>}</div>
            <div className="ws-tile__sub">{c.year || 'без года'}</div>
          </div>
        </div>

        <div className="ws-tile__foot">
          {c.expand?.group?.name
            ? <GroupChip id={c.group} name={c.expand.group.name} />
            : <span className="lemma-chip lemma-chip-neutral lemma-chip--nodot">без группы</span>}
          {(canEdit || canDelete) && (
            <div className="ws-tile__actions" onClick={stop}>
              {canEdit && <Button size="small" type="text" icon={<EditOutlined />} title="Редактировать" onClick={() => { setEditing(c); setModalOpen(true); }} />}
              {canEdit && <Button size="small" type="text" icon={<InboxOutlined />} title={c.archived ? 'Восстановить' : 'В архив'} onClick={() => handleArchive(c)} />}
              {canDelete && (
                <Popconfirm title="Удалить КТП?" description="Все строки плана будут удалены." okText="Удалить" cancelText="Отмена" okButtonProps={{ danger: true }} onConfirm={() => handleDelete(c)}>
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
        icon={<ScheduleOutlined />}
        accent="violet"
        title="Календарно-тематическое планирование"
        subtitle="Темы по неделям и часам — с экспортом в Word и PDF"
        extra={(
          <>
            <Space size={4}>
              <Switch checked={showArchived} onChange={setShowArchived} size="small" />
              <Text type="secondary">архив</Text>
            </Space>
            {canEdit && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setModalOpen(true); }}>
                Новое КТП
              </Button>
            )}
          </>
        )}
      />

      {loading && !courses.length ? (
        <div style={{ textAlign: 'center', padding: 64 }}><Spin /></div>
      ) : courses.length ? (
        <div className="ws-grid">{courses.map(renderCard)}</div>
      ) : showArchived ? (
        <EmptyState title="Архив пуст" description="Сюда попадают планы, отправленные в архив" />
      ) : (
        <EmptyState
          title="Пока нет планов"
          description="Создайте КТП: распишите темы по неделям и часам, выгрузите в Word или PDF"
          cta={canEdit ? 'Новое КТП' : undefined}
          ctaIcon={<PlusOutlined />}
          onCta={() => { setEditing(null); setModalOpen(true); }}
        />
      )}

      <CourseModal
        open={modalOpen}
        initial={editing}
        groups={groups}
        saving={saving}
        onSave={handleSave}
        onCancel={() => { setModalOpen(false); setEditing(null); }}
      />
    </div>
  );
}
