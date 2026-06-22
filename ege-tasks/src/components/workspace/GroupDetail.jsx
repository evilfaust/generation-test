import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Card,
  Descriptions,
  Input,
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
  EditOutlined,
  PlusOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UserAddOutlined,
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
  const [manualOpen, setManualOpen] = useState(false);
  const [manualText, setManualText] = useState('');
  const [editStudent, setEditStudent] = useState(null);
  const [editName, setEditName] = useState('');

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

  // Вписать учеников «без аккаунта» (по одному имени на строку).
  const handleAddManual = async () => {
    const names = manualText.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!names.length) return;
    setBusy(true);
    try {
      await Promise.all(names.map((name) => api.createManualStudent({ name, groupId })));
      message.success(`Вписано: ${names.length}`);
      setManualOpen(false);
      setManualText('');
      load();
    } catch {
      message.error('Не удалось вписать учеников');
    } finally {
      setBusy(false);
    }
  };

  // Переименование ученика (имя/фамилия). updateStudent — правила students публичны.
  const handleSaveName = async () => {
    const name = editName.trim();
    if (!editStudent || !name) return;
    setBusy(true);
    try {
      await api.updateStudent(editStudent.id, { name });
      message.success('Имя обновлено');
      setEditStudent(null);
      setEditName('');
      load();
    } catch {
      message.error('Не удалось обновить имя');
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
                icon={<UserAddOutlined />}
                onClick={() => setManualOpen(true)}
                title="Вписать ученика без аккаунта (для заметок и посещаемости)"
              >
                Вписать вручную
              </Button>
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
                actions={[
                  <Button
                    key="profile"
                    size="small"
                    type="link"
                    onClick={() => navigate(`/app/students/${s.id}`)}
                  >
                    профиль
                  </Button>,
                  ...(canEdit
                    ? [
                        <Button
                          key="edit"
                          size="small"
                          type="text"
                          icon={<EditOutlined />}
                          onClick={() => { setEditStudent(s); setEditName(s.name || ''); }}
                          title="Переименовать"
                        />,
                        <Button
                          key="unlink"
                          size="small"
                          type="text"
                          danger
                          icon={<DisconnectOutlined />}
                          onClick={() => handleUnlink(s)}
                        >
                          {s.external ? 'убрать' : 'отвязать'}
                        </Button>,
                      ]
                    : []),
                ]}
              >
                <List.Item.Meta
                  title={s.name || '—'}
                  description={
                    <Space size={6}>
                      {s.external
                        ? <Chip tone="amber" dot={false}>без аккаунта</Chip>
                        : (s.username && <Text type="secondary">@{s.username}</Text>)}
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

      <Modal
        open={manualOpen}
        title="Вписать учеников вручную"
        onCancel={() => { setManualOpen(false); setManualText(''); }}
        onOk={handleAddManual}
        confirmLoading={busy}
        okText="Вписать"
        cancelText="Отмена"
        okButtonProps={{ disabled: !manualText.trim() }}
      >
        <Text type="secondary">
          Ученики без аккаунта — только для заметок и фиксации продвижения
          (тесты и ДЗ им не выдаются, в журнале и прогрессе не показываются).
          По одному на строку: Фамилия Имя.
        </Text>
        <Input.TextArea
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
          rows={6}
          placeholder={'Иванов Иван\nПетрова Мария'}
          style={{ marginTop: 8 }}
        />
      </Modal>

      <Modal
        open={!!editStudent}
        title="Переименовать ученика"
        onCancel={() => { setEditStudent(null); setEditName(''); }}
        onOk={handleSaveName}
        confirmLoading={busy}
        okText="Сохранить"
        cancelText="Отмена"
        okButtonProps={{ disabled: !editName.trim() }}
        destroyOnHidden
      >
        <Text type="secondary">Фамилия Имя:</Text>
        <Input
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onPressEnter={handleSaveName}
          placeholder="Иванов Иван"
          autoFocus
          style={{ marginTop: 8 }}
        />
      </Modal>
    </div>
  );
}
