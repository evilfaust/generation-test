import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Card, List, Select, Space, Spin, Tag, Typography } from 'antd';
import { RightOutlined } from '@ant-design/icons';
import { api } from '../../../shared/services/pocketbase';
import { WorkspacePageHeader, EmptyState, GroupChip } from '../ui';

const { Text } = Typography;

// Список «Каникулярное задание»: выбор группы → карточки учеников → редактор программы.
export default function SummerProgramList() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState(null);
  const [students, setStudents] = useState([]);
  const [programs, setPrograms] = useState({}); // studentId → program
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getTeachingGroups().then((g) => {
      setGroups(g);
      if (g.length) setGroupId(g[0].id);
    }).catch(() => message.error('Не удалось загрузить группы'));
  }, [message]);

  useEffect(() => {
    if (!groupId) { setStudents([]); return; }
    setLoading(true);
    Promise.all([api.getStudentsByGroup(groupId), api.getStudyPrograms({ group: groupId })])
      .then(([st, progs]) => {
        setStudents(st.filter((s) => !s.external)); // внешним летнее ДЗ не выдаём
        setPrograms(Object.fromEntries(progs.map((p) => [p.student, p])));
      })
      .catch(() => message.error('Не удалось загрузить учеников'))
      .finally(() => setLoading(false));
  }, [groupId, message]);

  const group = useMemo(() => groups.find((g) => g.id === groupId), [groups, groupId]);

  return (
    <div>
      <WorkspacePageHeader
        accent="violet"
        title="Каникулярное задание"
        subtitle="Индивидуальный план на каникулы по слабым темам каждого ученика"
        extra={
          <Select
            style={{ minWidth: 220 }}
            placeholder="Выберите группу"
            value={groupId}
            onChange={setGroupId}
            options={groups.map((g) => ({ value: g.id, label: `${g.name}${g.grade ? ` · ${g.grade} кл.` : ''}` }))}
          />
        }
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
      ) : !groupId ? (
        <EmptyState title="Выберите группу" description="Сверху выберите класс/группу, чтобы увидеть учеников." />
      ) : !students.length ? (
        <EmptyState
          title="В группе нет учеников"
          description="Привяжите учеников к группе в разделе «Классы и группы»."
        />
      ) : (
        <Card size="small" styles={{ body: { padding: 0 } }}>
          <List
            dataSource={students}
            renderItem={(s) => {
              const prog = programs[s.id];
              return (
                <List.Item
                  className="ws-clickable"
                  style={{ padding: '12px 16px', cursor: 'pointer' }}
                  onClick={() => navigate(`/app/summer/${s.id}`)}
                  actions={[<RightOutlined key="go" style={{ color: '#bbb' }} />]}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text strong>{s.name}</Text>
                        {group && <GroupChip id={group.id}>{group.name}</GroupChip>}
                        {!s.telegram_id && <Tag color="default">нет telegram_id</Tag>}
                      </Space>
                    }
                    description={
                      prog
                        ? <Text type="secondary">Программа собрана · {prog.status === 'issued' ? 'выдана' : prog.status}</Text>
                        : <Text type="secondary">Программа ещё не собрана</Text>
                    }
                  />
                </List.Item>
              );
            }}
          />
        </Card>
      )}
    </div>
  );
}
