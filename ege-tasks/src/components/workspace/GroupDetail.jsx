import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Card,
  Descriptions,
  List,
  Modal,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import {
  ArrowLeftOutlined,
  DisconnectOutlined,
  PlusOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../shared/services/pocketbase';
import { useAuth } from '../../contexts/AuthContext';
import { WorkspacePageHeader, EmptyState, Chip, groupTone } from './ui';

const { Text } = Typography;

export default function GroupDetail() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { canEdit } = useAuth();

  const [group, setGroup] = useState(null);
  const [students, setStudents] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, inGroup, all] = await Promise.all([
        api.getTeachingGroup(groupId),
        api.getStudentsByGroup(groupId),
        api.getStudentsForGroupPicker(),
      ]);
      setGroup(g);
      setStudents(inGroup);
      setAllStudents(all);
    } catch {
      message.error('Не удалось загрузить группу');
    } finally {
      setLoading(false);
    }
  }, [groupId, message]);

  useEffect(() => {
    load();
  }, [load]);

  // Кандидаты на добавление: ученики без этой группы.
  const candidates = useMemo(
    () => allStudents.filter((s) => s.teaching_group !== groupId),
    [allStudents, groupId],
  );

  // Предложение «привязать по совпадению»: ученики, у кого student_class совпадает
  // с названием группы, но они ещё не привязаны.
  const matchByName = useMemo(() => {
    if (!group) return [];
    const target = (group.name || '').trim().toLowerCase();
    if (!target) return [];
    return candidates.filter(
      (s) => (s.student_class || '').trim().toLowerCase() === target,
    );
  }, [candidates, group]);

  const handleAdd = async () => {
    if (!picked.length) return;
    setBusy(true);
    try {
      await Promise.all(picked.map((id) => api.setStudentGroup(id, groupId)));
      message.success(`Привязано: ${picked.length}`);
      setAddOpen(false);
      setPicked([]);
      load();
    } catch {
      message.error('Не удалось привязать учеников');
    } finally {
      setBusy(false);
    }
  };

  const handleLinkByName = async () => {
    setBusy(true);
    try {
      await Promise.all(matchByName.map((s) => api.setStudentGroup(s.id, groupId)));
      message.success(`Привязано по совпадению: ${matchByName.length}`);
      load();
    } catch {
      message.error('Не удалось привязать');
    } finally {
      setBusy(false);
    }
  };

  const handleUnlink = async (student) => {
    try {
      await api.setStudentGroup(student.id, null);
      message.success('Ученик отвязан');
      load();
    } catch {
      message.error('Не удалось отвязать');
    }
  };

  if (loading && !group) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin />
      </div>
    );
  }

  if (!group) {
    return (
      <EmptyState
        title="Группа не найдена"
        description="Возможно, она была удалена"
        cta="К группам"
        onCta={() => navigate('/app/groups')}
      />
    );
  }

  const subtitleParts = [
    group.subject,
    group.grade ? `${group.grade} кл.` : null,
    group.year,
  ].filter(Boolean);

  return (
    <div style={{ maxWidth: 900 }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/app/groups')}>
          К группам
        </Button>
      </Space>

      <WorkspacePageHeader
        icon={<TeamOutlined />}
        accent={groupTone(group.id || group.name)}
        title={group.name}
        subtitle={subtitleParts.join(' · ') || undefined}
        extra={group.archived ? <Tag>архив</Tag> : null}
      />

      <Card size="small" style={{ marginBottom: 16 }}>
        <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small">
          <Descriptions.Item label="Предмет">{group.subject || '—'}</Descriptions.Item>
          <Descriptions.Item label="Класс">{group.grade ? `${group.grade} кл.` : '—'}</Descriptions.Item>
          <Descriptions.Item label="Часов/нед">
            {group.hours_per_week != null ? group.hours_per_week : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="УМК">{group.umk || '—'}</Descriptions.Item>
          <Descriptions.Item label="Учебный год">{group.year || '—'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        size="small"
        title={
          <Space>
            <TeamOutlined />
            <span>Ученики ({students.length})</span>
          </Space>
        }
        extra={
          canEdit && (
            <Space>
              {matchByName.length > 0 && (
                <Button
                  size="small"
                  icon={<ThunderboltOutlined />}
                  loading={busy}
                  onClick={handleLinkByName}
                  title={`Привязать ${matchByName.length} учеников с классом «${group.name}»`}
                >
                  Привязать по совпадению ({matchByName.length})
                </Button>
              )}
              <Button
                size="small"
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setAddOpen(true)}
              >
                Добавить
              </Button>
            </Space>
          )
        }
      >
        {students.length === 0 ? (
          <EmptyState
            title="В группе пока нет учеников"
            description="Добавьте учеников вручную или привяжите по совпадению класса"
            cta={canEdit ? 'Добавить учеников' : undefined}
            ctaIcon={<PlusOutlined />}
            onCta={() => setAddOpen(true)}
          />
        ) : (
          <List
            size="small"
            dataSource={students}
            renderItem={(s) => (
              <List.Item
                actions={
                  canEdit
                    ? [
                        <Button
                          key="unlink"
                          size="small"
                          type="text"
                          danger
                          icon={<DisconnectOutlined />}
                          onClick={() => handleUnlink(s)}
                        >
                          отвязать
                        </Button>,
                      ]
                    : []
                }
              >
                <List.Item.Meta
                  title={s.name || '—'}
                  description={
                    <Space size={6}>
                      {s.username && <Text type="secondary">@{s.username}</Text>}
                      {s.student_class && <Chip tone="neutral" dot={false}>{s.student_class}</Chip>}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      <Modal
        open={addOpen}
        title="Добавить учеников в группу"
        onCancel={() => {
          setAddOpen(false);
          setPicked([]);
        }}
        onOk={handleAdd}
        confirmLoading={busy}
        okText="Привязать"
        cancelText="Отмена"
        okButtonProps={{ disabled: !picked.length }}
      >
        <Text type="secondary">Выберите учеников (показаны не входящие в эту группу):</Text>
        <Select
          mode="multiple"
          style={{ width: '100%', marginTop: 8 }}
          placeholder="Имя ученика…"
          value={picked}
          onChange={setPicked}
          optionFilterProp="label"
          options={candidates.map((s) => ({
            value: s.id,
            label: `${s.name || '—'}${s.username ? ` (@${s.username})` : ''}${
              s.student_class ? ` · ${s.student_class}` : ''
            }`,
          }))}
        />
      </Modal>
    </div>
  );
}
