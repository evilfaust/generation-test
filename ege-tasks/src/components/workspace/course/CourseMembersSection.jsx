import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Modal, Select, Space, Switch, Tag, Typography } from 'antd';
import {
  CalendarOutlined,
  DeleteOutlined,
  PlusOutlined,
  TeamOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../shared/services/pocketbase';
import { useAuth } from '../../../contexts/AuthContext';
import { SectionCard, EmptyState, Chip, groupHex } from '../ui';

const { Text } = Typography;

// Раздел курса в GroupDetail (только для teaching_groups.kind='course'):
// участники курса (course_members, независимо от класса) + обзор витрины.
export default function CourseMembersSection({ group, allStudents = [] }) {
  const { message } = App.useApp();
  const { canEdit } = useAuth();
  const navigate = useNavigate();

  const [members, setMembers] = useState([]);
  const [pubs, setPubs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, p] = await Promise.all([
        api.getCourseMembers(group.id),
        api.getPublicationsByGroup(group.id),
      ]);
      setMembers(m);
      setPubs(p);
    } catch {
      message.error('Не удалось загрузить участников курса');
    } finally {
      setLoading(false);
    }
  }, [group.id, message]);

  useEffect(() => { load(); }, [load]);

  const memberIds = useMemo(() => new Set(members.map((m) => m.student)), [members]);
  // Имена берём из публичного списka (students.viewRule = self → expand не работает).
  const studentsById = useMemo(
    () => new Map(allStudents.map((s) => [s.id, s])),
    [allStudents],
  );
  const candidates = useMemo(
    () => allStudents.filter((s) => !s.external && !memberIds.has(s.id)),
    [allStudents, memberIds],
  );

  const handleAdd = async () => {
    if (!picked.length) return;
    setBusy(true);
    try {
      await api.addCourseMembers(group.id, picked);
      message.success(`Добавлено: ${picked.length}`);
      setAddOpen(false);
      setPicked([]);
      load();
    } catch {
      message.error('Не удалось добавить участников');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (member) => {
    try {
      await api.removeCourseMember(member.id);
      message.success('Участник убран из курса');
      load();
    } catch {
      message.error('Не удалось убрать участника');
    }
  };

  const handleToggleActive = async (member, active) => {
    try {
      await api.setCourseMemberActive(member.id, active);
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, active } : m)));
    } catch {
      message.error('Не удалось изменить статус');
    }
  };

  const publishedCount = pubs.filter((p) => p.published).length;

  return (
    <>
      {/* Кабинет ученика — сводка */}
      <div style={{ marginBottom: 16 }}>
        <SectionCard
          icon={<VideoCameraOutlined />}
          iconColor="var(--accent-violet, #722ed1)"
          title="Кабинет курса"
          extra={(
            <Button
              size="small"
              icon={<CalendarOutlined />}
              onClick={() => navigate(`/app/calendar?group=${group.id}`)}
            >
              В календарь
            </Button>
          )}
        >
          <div className="ws-tile__meta" style={{ margin: '2px 8px 6px', gap: '8px 22px' }}>
            <span>
              Комната:{' '}
              {group.conference_url
                ? <a href={group.conference_url} target="_blank" rel="noreferrer">ссылка на конференцию</a>
                : <b>не задана</b>}
            </span>
            <span>
              Доска:{' '}
              {group.board_url
                ? <a href={group.board_url} target="_blank" rel="noreferrer">ссылка на онлайн-доску</a>
                : <b>не задана</b>}
            </span>
            <span>Опубликовано занятий: <b>{publishedCount}</b> из {pubs.length}</span>
          </div>
          <Text type="secondary" style={{ fontSize: 12, padding: '0 8px' }}>
            Ученики курса видят расписание, ссылку на конференцию, материалы и ДЗ в своём
            кабинете. Занятия и материалы задаются на уроках курса в календаре.
          </Text>
        </SectionCard>
      </div>

      {/* Участники курса */}
      <SectionCard
        icon={<TeamOutlined />}
        iconColor={groupHex(group.id || group.name).base}
        title={`Участники курса (${members.length})`}
        extra={canEdit && (
          <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
            Добавить
          </Button>
        )}
      >
        {members.length === 0 ? (
          <EmptyState
            title="В курсе пока нет участников"
            description="Добавьте учеников — они увидят курс в своём кабинете. Ученик может при этом оставаться в своём обычном классе."
            cta={canEdit ? 'Добавить учеников' : undefined}
            ctaIcon={<PlusOutlined />}
            onCta={() => setAddOpen(true)}
          />
        ) : (
          members.map((m) => {
            const s = studentsById.get(m.student) || m.expand?.student;
            const name = s?.name || '—';
            const hex = groupHex(s?.id || name);
            const initials = name.replace(/[«»"]/g, '').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
            return (
              <div key={m.id} className="ws-roster__item" style={m.active === false ? { opacity: 0.55 } : undefined}>
                <span className="ws-roster__avatar" style={{ color: hex.base, background: hex.soft }}>{initials || '?'}</span>
                <div className="ws-roster__main">
                  <div className="ws-roster__name">{name}</div>
                  <div className="ws-roster__sub">
                    {s?.username && <Text type="secondary" style={{ fontSize: 12 }}>@{s.username}</Text>}
                    {s?.student_class && <Chip tone="neutral" dot={false}>{s.student_class}</Chip>}
                    {m.active === false && <Tag>неактивен</Tag>}
                  </div>
                </div>
                <div className="ws-roster__actions">
                  {s?.id && <Button size="small" type="link" onClick={() => navigate(`/app/students/${s.id}`)}>профиль</Button>}
                  {canEdit && (
                    <>
                      <Space size={4} style={{ marginRight: 4 }}>
                        <Switch size="small" checked={m.active !== false} onChange={(v) => handleToggleActive(m, v)} />
                      </Space>
                      <Button size="small" type="text" danger icon={<DeleteOutlined />} title="Убрать из курса" onClick={() => handleRemove(m)} />
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </SectionCard>

      <Modal
        open={addOpen}
        title="Добавить участников курса"
        onCancel={() => { setAddOpen(false); setPicked([]); }}
        onOk={handleAdd}
        confirmLoading={busy}
        okText="Добавить"
        cancelText="Отмена"
        okButtonProps={{ disabled: !picked.length }}
      >
        <Text type="secondary">Выберите учеников (можно из любых классов):</Text>
        <Select
          mode="multiple"
          style={{ width: '100%', marginTop: 8 }}
          placeholder="Имя ученика…"
          value={picked}
          onChange={setPicked}
          optionFilterProp="label"
          loading={loading}
          options={candidates.map((s) => ({
            value: s.id,
            label: `${s.name || '—'}${s.username ? ` (@${s.username})` : ''}${s.student_class ? ` · ${s.student_class}` : ''}`,
          }))}
        />
      </Modal>
    </>
  );
}
