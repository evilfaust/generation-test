import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import {
  ArrowLeftOutlined,
  CopyOutlined,
  DisconnectOutlined,
  EditOutlined,
  IdcardOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../shared/services/pocketbase';
import { useAuth } from '../../contexts/AuthContext';
import { WorkspacePageHeader, EmptyState, SectionCard, Chip, groupTone, groupHex } from './ui';
import CourseMembersSection from './course/CourseMembersSection';

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
  // Создание полноценных аккаунтов учеников (v3.9.120)
  const [accOpen, setAccOpen] = useState(false);
  const [accText, setAccText] = useState('');
  const [accResults, setAccResults] = useState(null); // [{name, username, password}] после создания

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

  // Создать полноценные аккаунты (по имени на строку): логины/пароли
  // генерируются и показываются ОДИН раз — скопировать и раздать ученикам.
  const handleCreateAccounts = async () => {
    const names = accText.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!names.length) return;
    setBusy(true);
    const results = [];
    let failed = 0;
    for (const name of names) {
      try {
        const { username, password } = await api.createStudentAccount({
          name,
          groupId,
          studentClass: group?.name || '',
        });
        results.push({ name, username, password });
      } catch {
        failed += 1;
      }
    }
    setBusy(false);
    if (results.length) {
      setAccResults(results);
      setAccText('');
      load();
    }
    if (failed) message.error(`Не удалось создать: ${failed}`);
  };

  const copyAccResults = async () => {
    const text = (accResults || [])
      .map((r) => `${r.name}\tлогин: ${r.username}\tпароль: ${r.password}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      message.success('Список логинов и паролей скопирован');
    } catch {
      message.error('Не удалось скопировать — выделите текст вручную');
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
        extra={(
          <Space>
            {group.kind === 'course' && <Tag color="purple">курс</Tag>}
            {group.archived ? <Tag>архив</Tag> : null}
          </Space>
        )}
      />

      <div style={{ marginBottom: 16 }}>
        <SectionCard icon={<InfoCircleOutlined />} iconColor="var(--ink-3)" title="Сведения о группе">
          <div className="ws-tile__meta" style={{ margin: '2px 8px 6px', gap: '8px 22px' }}>
            <span>Предмет: <b>{group.subject || '—'}</b></span>
            <span>Класс: <b>{group.grade ? `${group.grade} кл.` : '—'}</b></span>
            <span>Часов/нед: <b>{group.hours_per_week != null ? group.hours_per_week : '—'}</b></span>
            <span>УМК: <b>{group.umk || '—'}</b></span>
            <span>Год: <b>{group.year || '—'}</b></span>
          </div>
        </SectionCard>
      </div>

      {group.kind === 'course' ? (
        <CourseMembersSection group={group} allStudents={allStudents} />
      ) : (
      <SectionCard
        icon={<TeamOutlined />}
        iconColor={groupHex(group.id || group.name).base}
        title={`Ученики (${students.length})`}
        extra={canEdit && (
          <Space size={6} style={{ marginLeft: 'auto' }}>
            {matchByName.length > 0 && (
              <Button
                size="small"
                icon={<ThunderboltOutlined />}
                loading={busy}
                onClick={handleLinkByName}
                title={`Привязать ${matchByName.length} учеников с классом «${group.name}»`}
              >
                По совпадению ({matchByName.length})
              </Button>
            )}
            <Button
              size="small"
              icon={<UserAddOutlined />}
              onClick={() => setManualOpen(true)}
              title="Вписать ученика без аккаунта (для заметок и посещаемости)"
            >
              Вручную
            </Button>
            <Button
              size="small"
              icon={<IdcardOutlined />}
              onClick={() => { setAccResults(null); setAccOpen(true); }}
              title="Создать ученикам полноценные аккаунты с логином и паролем"
            >
              Аккаунты
            </Button>
            <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
              Добавить
            </Button>
          </Space>
        )}
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
          students.map((s) => {
            const hex = groupHex(s.id || s.name);
            const initials = (s.name || '?').replace(/[«»"]/g, '').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
            return (
              <div key={s.id} className="ws-roster__item">
                <span className="ws-roster__avatar" style={{ color: hex.base, background: hex.soft }}>{initials || '?'}</span>
                <div className="ws-roster__main">
                  <div className="ws-roster__name">{s.name || '—'}</div>
                  <div className="ws-roster__sub">
                    {s.external
                      ? <Chip tone="amber" dot={false}>без аккаунта</Chip>
                      : (s.username && <Text type="secondary" style={{ fontSize: 12 }}>@{s.username}</Text>)}
                    {s.student_class && <Chip tone="neutral" dot={false}>{s.student_class}</Chip>}
                  </div>
                </div>
                <div className="ws-roster__actions">
                  <Button size="small" type="link" onClick={() => navigate(`/app/students/${s.id}`)}>профиль</Button>
                  {canEdit && (
                    <>
                      <Button size="small" type="text" icon={<EditOutlined />} title="Переименовать" onClick={() => { setEditStudent(s); setEditName(s.name || ''); }} />
                      <Button size="small" type="text" danger icon={<DisconnectOutlined />} title={s.external ? 'Убрать' : 'Отвязать'} onClick={() => handleUnlink(s)} />
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </SectionCard>
      )}

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

      <Modal
        open={accOpen}
        title="Создать аккаунты учеников"
        onCancel={() => { setAccOpen(false); setAccResults(null); }}
        confirmLoading={busy}
        okText={accResults ? 'Готово' : 'Создать'}
        cancelText="Отмена"
        onOk={accResults ? () => { setAccOpen(false); setAccResults(null); } : handleCreateAccounts}
        okButtonProps={accResults ? {} : { disabled: !accText.trim() }}
        width={620}
        destroyOnHidden
      >
        {!accResults ? (
          <>
            <Text type="secondary">
              По одному ученику на строку (Фамилия Имя). Каждому создаётся
              полноценный аккаунт с логином и паролем, привязанный к этой группе.
            </Text>
            <Input.TextArea
              value={accText}
              onChange={(e) => setAccText(e.target.value)}
              autoSize={{ minRows: 5, maxRows: 14 }}
              placeholder={'Иванов Иван\nПетрова Мария'}
              style={{ marginTop: 8 }}
              autoFocus
            />
          </>
        ) : (
          <>
            <Text strong style={{ color: '#d4380d' }}>
              Пароли показываются один раз — скопируйте список и раздайте ученикам.
            </Text>
            <div style={{ margin: '12px 0', maxHeight: 320, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#888' }}>
                    <th style={{ padding: '4px 8px' }}>Ученик</th>
                    <th style={{ padding: '4px 8px' }}>Логин</th>
                    <th style={{ padding: '4px 8px' }}>Пароль</th>
                  </tr>
                </thead>
                <tbody>
                  {accResults.map((r) => (
                    <tr key={r.username} style={{ borderTop: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '4px 8px' }}>{r.name}</td>
                      <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>{r.username}</td>
                      <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>{r.password}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button icon={<CopyOutlined />} onClick={copyAccResults}>
              Скопировать список
            </Button>
          </>
        )}
      </Modal>
    </div>
  );
}
