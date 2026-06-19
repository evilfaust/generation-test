import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Alert, Button, Collapse, Empty, Modal, Popover, Progress, Select, Space, Spin, Table, Tag, Typography } from 'antd';
import { MergeCellsOutlined, ReloadOutlined, UserOutlined, TeamOutlined } from '@ant-design/icons';
import { api } from '../services/pocketbase';
import { PageHeader, StatRow, Stat } from '../ui';

const { Text } = Typography;

const toPercent = (score, total) => {
  if (!total) return 0;
  return Math.round((score / total) * 100);
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ru-RU');
};

const getAttemptTestTitle = (attempt, worksById) => {
  const session = attempt?.expand?.session;

  const expandedWorkTitle = session?.expand?.work?.title?.trim();
  if (expandedWorkTitle) return expandedWorkTitle;

  const workTitle = session?.work ? worksById?.get(session.work)?.title?.trim() : '';
  if (workTitle) return workTitle;

  const mcTitle = session?.expand?.mc_test?.title?.trim();
  if (mcTitle) return mcTitle;

  return session?.id || attempt?.session || '—';
};

const normalizeUnlockedIds = (value) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && typeof item.id === 'string') return item.id;
        return null;
      })
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (typeof item === 'string' ? item : item?.id))
          .filter(Boolean);
      }
    } catch (_) {
      return [];
    }
  }

  return [];
};

const StudentProgressDashboard = ({ onOpenWork, onOpenStudent }) => {
  const { message, modal } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [works, setWorks] = useState([]);
  const [achievements, setAchievements] = useState([]);

  // Состояние объединения аккаунтов
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeSource, setMergeSource] = useState(null); // старый аккаунт (удалить)
  const [mergeTarget, setMergeTarget] = useState(null); // основной аккаунт (сохранить)
  const [merging, setMerging] = useState(false);


  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [studentsData, attemptsData, worksData, achievementsData] = await Promise.all([
        api.getStudents(),
        api.getAttemptsForRegisteredStudents(),
        api.getWorks({ includeArchived: true }),
        api.getAchievements(),
      ]);
      // Внешних (вписанных вручную, без тестов) в дашборде прогресса не показываем.
      setStudents(studentsData.filter((s) => !s.external));
      setAttempts(attemptsData);
      setWorks(worksData);
      setAchievements(achievementsData);
    } catch (err) {
      console.error('Error loading student progress dashboard:', err);
      message.error('Ошибка загрузки прогресса учеников');
    }
    setLoading(false);
  }, [message]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleMerge = useCallback(async () => {
    if (!mergeSource || !mergeTarget || mergeSource === mergeTarget) return;
    const sourceStudent = students.find(s => s.id === mergeSource);
    const targetStudent = students.find(s => s.id === mergeTarget);
    const sourceAttempts = attempts.filter(a => a.student === mergeSource);

    modal.confirm({
      title: 'Подтвердите объединение аккаунтов',
      content: (
        <div>
          <p>Все попытки (<strong>{sourceAttempts.length}</strong>) от аккаунта <strong>@{sourceStudent?.username}</strong> будут перенесены на <strong>@{targetStudent?.username}</strong>.</p>
          <p style={{ color: 'var(--lvl-3)' }}>Аккаунт <strong>@{sourceStudent?.username}</strong> будет удалён. Это действие необратимо.</p>
        </div>
      ),
      okText: 'Объединить',
      okButtonProps: { danger: true },
      cancelText: 'Отмена',
      onOk: async () => {
        setMerging(true);
        try {
          const result = await api.mergeStudents(mergeSource, mergeTarget);
          message.success(`Перенесено ${result.moved} попыток. Аккаунт @${result.deletedUsername} удалён.`);
          setMergeOpen(false);
          setMergeSource(null);
          setMergeTarget(null);
          await loadData();
        } catch (err) {
          message.error(`Ошибка объединения: ${err.message}`);
        } finally {
          setMerging(false);
        }
      },
    });
  }, [mergeSource, mergeTarget, students, attempts, modal, message, loadData]);

  const worksById = useMemo(() => {
    const map = new Map();
    works.forEach((work) => map.set(work.id, work));
    return map;
  }, [works]);

  const achievementsById = useMemo(() => {
    const map = new Map();
    achievements.forEach((achievement) => {
      map.set(achievement.id, achievement);
    });
    return map;
  }, [achievements]);

  const attemptsByStudentId = useMemo(() => {
    const map = new Map();
    attempts.forEach((attempt) => {
      if (!attempt.student) return;
      if (!map.has(attempt.student)) map.set(attempt.student, []);
      map.get(attempt.student).push(attempt);
    });
    return map;
  }, [attempts]);

  const tableData = useMemo(() => {
    return students.map((student) => {
      const studentAttempts = attemptsByStudentId.get(student.id) || [];
      const finishedAttempts = studentAttempts.filter((a) => a.status !== 'started');
      const totalScore = finishedAttempts.reduce((sum, a) => sum + (a.score || 0), 0);
      const totalTasks = finishedAttempts.reduce((sum, a) => sum + (a.total || 0), 0);
      const avgPercent = toPercent(totalScore, totalTasks);
      const bestPercent = finishedAttempts.reduce((best, a) => {
        return Math.max(best, toPercent(a.score || 0, a.total || 0));
      }, 0);
      const lastAttemptAt = studentAttempts
        .map((a) => a.created)
        .filter(Boolean)
        .sort((a, b) => new Date(b) - new Date(a))[0] || null;
      const latestAttempt = studentAttempts
        .slice()
        .sort((a, b) => new Date(b.created) - new Date(a.created))[0] || null;

      const achievements = new Set();
      const completedWorkIds = new Set();
      studentAttempts.forEach((a) => {
        if (a.achievement) achievements.add(a.achievement);
        normalizeUnlockedIds(a.unlocked_achievements).forEach((id) => achievements.add(id));
        if (a.status !== 'started') {
          const workId = a.expand?.session?.work || a.expand?.session?.mc_test;
          if (workId) completedWorkIds.add(workId);
        }
      });

      return {
        key: student.id,
        id: student.id,
        name: student.name || '—',
        username: student.username || '—',
        studentClass: student.student_class || '',
        registeredAt: student.created || null,
        attemptsCount: studentAttempts.length,
        finishedCount: finishedAttempts.length,
        avgPercent,
        bestPercent,
        totalScore,
        totalTasks,
        achievementsCount: achievements.size,
        achievementIds: Array.from(achievements),
        completedWorksCount: completedWorkIds.size,
        lastAttemptAt,
        latestTestTitle: getAttemptTestTitle(latestAttempt, worksById),
      };
    });
  }, [students, attemptsByStudentId, worksById]);

  // Группировка по классам для Collapse
  const groupedByClass = useMemo(() => {
    const groups = new Map();

    tableData.forEach((student) => {
      const cls = student.studentClass || '__none__';
      if (!groups.has(cls)) groups.set(cls, []);
      groups.get(cls).push(student);
    });

    // Сортируем классы: сначала по числу, потом буквы, "Без класса" в конец
    const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
      if (a === '__none__') return 1;
      if (b === '__none__') return -1;
      return a.localeCompare(b, 'ru', { numeric: true, sensitivity: 'base' });
    });

    return sortedKeys.map((key) => {
      const students = groups.get(key);
      const avgPercent = students.length > 0
        ? Math.round(students.reduce((sum, s) => sum + s.avgPercent, 0) / students.length)
        : 0;
      const totalAttempts = students.reduce((sum, s) => sum + s.attemptsCount, 0);
      return {
        key,
        label: key === '__none__' ? 'Без класса' : key,
        students,
        avgPercent,
        totalAttempts,
      };
    });
  }, [tableData]);

  const dashboardStats = useMemo(() => {
    const totalStudents = tableData.length;
    const classCount = groupedByClass.filter((group) => group.key !== '__none__').length;
    const finishedAttempts = tableData.reduce((sum, row) => sum + row.finishedCount, 0);
    const totalAttempts = tableData.reduce((sum, row) => sum + row.attemptsCount, 0);
    const avgResult = totalStudents > 0
      ? Math.round(tableData.reduce((sum, row) => sum + row.avgPercent, 0) / totalStudents)
      : 0;
    const achievements = tableData.reduce((sum, row) => sum + row.achievementsCount, 0);

    return {
      totalStudents,
      classCount,
      finishedAttempts,
      totalAttempts,
      avgResult,
      achievements,
    };
  }, [tableData, groupedByClass]);

  const columns = [
    {
      title: 'Ученик',
      key: 'student',
      width: 240,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.name}</Text>
          <Text type="secondary">@{record.username}</Text>
        </Space>
      ),
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'Класс',
      key: 'studentClass',
      width: 120,
      render: (_, record) => (
        record.studentClass
          ? <Tag color="geekblue">{record.studentClass}</Tag>
          : <Text type="secondary">—</Text>
      ),
      sorter: (a, b) => (a.studentClass || '').localeCompare(b.studentClass || '', 'ru'),
    },
    {
      title: 'Попытки',
      key: 'attempts',
      width: 120,
      render: (_, record) => (
        <Text>{record.finishedCount}/{record.attemptsCount}</Text>
      ),
      sorter: (a, b) => a.attemptsCount - b.attemptsCount,
    },
    {
      title: 'Последний тест',
      key: 'latestTestTitle',
      width: 220,
      render: (_, record) => (
        <Text
          ellipsis={{ tooltip: record.latestTestTitle }}
          type={record.latestTestTitle === '—' ? 'secondary' : undefined}
        >
          {record.latestTestTitle}
        </Text>
      ),
      sorter: (a, b) => (a.latestTestTitle || '').localeCompare(b.latestTestTitle || '', 'ru'),
    },
    {
      title: 'Средний результат',
      key: 'avg',
      width: 190,
      render: (_, record) => (
        <Progress
          percent={record.avgPercent}
          size="small"
          status="active"
          format={(p) => `${p}%`}
        />
      ),
      sorter: (a, b) => a.avgPercent - b.avgPercent,
    },
    {
      title: 'Ачивки',
      dataIndex: 'achievementsCount',
      key: 'achievementsCount',
      width: 140,
      render: (_, record) => {
        if (!record.achievementsCount) return '—';
        return (
          <Popover
            trigger="click"
            title="Полученные ачивки"
            content={
              <Space wrap style={{ maxWidth: 340 }}>
                {record.achievementIds.map((achievementId) => {
                  const title = achievementsById.get(achievementId)?.title || `ID: ${achievementId}`;
                  return <Tag key={achievementId} color="gold">{title}</Tag>;
                })}
              </Space>
            }
          >
            <Button size="small" type="link">{record.achievementsCount}</Button>
          </Popover>
        );
      },
      sorter: (a, b) => a.achievementsCount - b.achievementsCount,
    },
    {
      title: 'Работы',
      dataIndex: 'completedWorksCount',
      key: 'completedWorksCount',
      width: 90,
      sorter: (a, b) => a.completedWorksCount - b.completedWorksCount,
    },
    {
      title: 'Последняя активность',
      key: 'lastAttemptAt',
      width: 190,
      render: (_, record) => (
        <Text type={record.lastAttemptAt ? undefined : 'secondary'}>
          {formatDateTime(record.lastAttemptAt)}
        </Text>
      ),
      sorter: (a, b) => new Date(a.lastAttemptAt || 0) - new Date(b.lastAttemptAt || 0),
    },
    {
      title: '',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Button size="small" onClick={() => onOpenStudent?.(record.id)}>
          Детали
        </Button>
      ),
    },
  ];

  // Колонки без колонки "Класс" для таблиц внутри Collapse
  const columnsWithoutClass = useMemo(() =>
    columns.filter((c) => c.key !== 'studentClass'),
    [columns]
  );

  if (loading && tableData.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
        <Spin />
      </div>
    );
  }

  return (
    <div style={{ padding: '4px 0' }}>
      <PageHeader
        title="Прогресс учеников"
        lede="Зарегистрированные ученики, их попытки и достижения"
        actions={
          <Space>
            <Button
              icon={<MergeCellsOutlined />}
              onClick={() => setMergeOpen(true)}
              disabled={students.length < 2}
            >
              Объединить аккаунты
            </Button>
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
              Обновить
            </Button>
          </Space>
        }
      />

      <Modal
        title={<Space><MergeCellsOutlined />Объединить аккаунты учеников</Space>}
        open={mergeOpen}
        onCancel={() => { setMergeOpen(false); setMergeSource(null); setMergeTarget(null); }}
        onOk={handleMerge}
        okText="Продолжить"
        cancelText="Отмена"
        okButtonProps={{ disabled: !mergeSource || !mergeTarget || mergeSource === mergeTarget, loading: merging }}
        destroyOnHidden
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Используйте, когда ученик случайно зарегистрировал два аккаунта. Все попытки будут перенесены на основной аккаунт, дублирующий — удалён."
        />
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 4, fontWeight: 500 }}>Старый / дублирующий аккаунт <span style={{ color: 'var(--lvl-3)' }}>(удалить)</span></div>
          <Select
            style={{ width: '100%' }}
            placeholder="Выберите аккаунт для удаления"
            value={mergeSource}
            onChange={setMergeSource}
            showSearch
            optionFilterProp="label"
            options={students
              .filter(s => s.id !== mergeTarget)
              .map(s => ({
                value: s.id,
                label: `${s.name || '—'} (@${s.username}) ${s.student_class ? `· ${s.student_class}` : ''}`,
              }))}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 4, fontWeight: 500 }}>Основной аккаунт <span style={{ color: 'var(--lvl-1)' }}>(сохранить)</span></div>
          <Select
            style={{ width: '100%' }}
            placeholder="Выберите основной аккаунт"
            value={mergeTarget}
            onChange={setMergeTarget}
            showSearch
            optionFilterProp="label"
            options={students
              .filter(s => s.id !== mergeSource)
              .map(s => ({
                value: s.id,
                label: `${s.name || '—'} (@${s.username}) ${s.student_class ? `· ${s.student_class}` : ''}`,
              }))}
          />
        </div>
        {mergeSource && mergeTarget && mergeSource !== mergeTarget && (() => {
          const src = students.find(s => s.id === mergeSource);
          const tgt = students.find(s => s.id === mergeTarget);
          const srcAttempts = attempts.filter(a => a.student === mergeSource).length;
          return (
            <Alert
              type="info"
              showIcon
              message={`${srcAttempts} попыток @${src?.username} → @${tgt?.username}. Аккаунт @${src?.username} будет удалён.`}
            />
          );
        })()}
      </Modal>

      <StatRow cols={4} style={{ marginBottom: 16 }}>
        <Stat label="Ученики" value={dashboardStats.totalStudents} sub={`${dashboardStats.classCount} классов`} />
        <Stat label="Завершено попыток" value={dashboardStats.finishedAttempts} sub={`из ${dashboardStats.totalAttempts}`} />
        <Stat
          label="Средний результат"
          value={`${dashboardStats.avgResult}%`}
          sub="по завершённым работам"
          accent={dashboardStats.avgResult >= 70 ? 'var(--lvl-1)' : dashboardStats.avgResult >= 40 ? 'var(--lvl-2)' : 'var(--lvl-3)'}
        />
        <Stat label="Достижения" value={dashboardStats.achievements} sub="разблокировано всего" />
      </StatRow>

      {tableData.length === 0 ? (
        <Empty description="Нет зарегистрированных учеников" style={{ padding: '48px 0' }} />
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <TeamOutlined style={{ color: 'var(--ink-3)' }} />
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>Классы и ученики</span>
          </div>
          <Collapse
            defaultActiveKey={groupedByClass.length <= 4 ? groupedByClass.map((g) => g.key) : []}
            className="spd-collapse"
            items={groupedByClass.map((group) => ({
              key: group.key,
              label: (
                <Space size={12} wrap>
                  <TeamOutlined />
                  <Text strong>{group.label}</Text>
                  <Tag>{group.students.length} уч.</Tag>
                  <Tag color={group.avgPercent >= 70 ? 'green' : group.avgPercent >= 40 ? 'blue' : 'default'}>
                    Средний: {group.avgPercent}%
                  </Tag>
                  <Text type="secondary">
                    Попыток: {group.totalAttempts}
                  </Text>
                </Space>
              ),
              children: (
                <Table
                  columns={columnsWithoutClass}
                  dataSource={group.students}
                  size="small"
                  pagination={group.students.length > 20 ? { pageSize: 20 } : false}
                  scroll={{ x: 920 }}
                />
              ),
            }))}
          />
        </div>
      )}

    </div>
  );
};

export default StudentProgressDashboard;
