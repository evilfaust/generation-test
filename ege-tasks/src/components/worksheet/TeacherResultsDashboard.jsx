import { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, Tag, Button, Space, Typography, Spin, Empty, Modal, Popconfirm, App, Popover, Select } from 'antd';
import { ReloadOutlined, SwapOutlined, CheckCircleOutlined, CloseCircleOutlined, CheckOutlined, DeleteOutlined, EyeOutlined, TrophyOutlined } from '@ant-design/icons';
import { api } from '../../services/pocketbase';
import { shuffleArray } from '../../utils/shuffle';
import MathRenderer from '../MathRenderer';
import ClassRemediationModal from './ClassRemediationModal';
import { PB_BASE_URL } from '../../services/pocketbaseUrl';

const { Text } = Typography;
const PB_URL = PB_BASE_URL;

/**
 * Панель результатов учителя.
 * Таблица попыток учеников с возможностью просмотра ответов, ручного зачёта и выдачи нового варианта.
 *
 * sessionId — id одной выдачи ИЛИ массив id (режим «все выдачи»). Массив нужен
 * потому, что у одной работы легко десяток выдач: летняя/каникулярная программа
 * создаёт персональную ссылку каждому ученику, и результаты по работе оказываются
 * размазаны по сессиям — в разрезе одной выдачи учитель видит пусто.
 * sessionLabels — подписи выдач (id → строка) для колонки «Из выдачи».
 */
const TeacherResultsDashboard = ({ sessionId, sessionLabels = null }) => {
  const { message } = App.useApp();
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedAnswers, setExpandedAnswers] = useState({});
  const [achievements, setAchievements] = useState([]);
  const [achievementsLoading, setAchievementsLoading] = useState(false);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualAttempt, setManualAttempt] = useState(null);
  const [manualRandomAchievementId, setManualRandomAchievementId] = useState(undefined);
  const [manualUnlockedAchievementIds, setManualUnlockedAchievementIds] = useState([]);
  const [mcTestData, setMcTestData] = useState(null); // данные MC-теста для отображения текста опций
  const [classRemOpen, setClassRemOpen] = useState(false);

  const sessionIds = useMemo(
    () => (Array.isArray(sessionId) ? sessionId.filter(Boolean) : sessionId ? [sessionId] : []),
    [sessionId]
  );
  const primarySessionId = sessionIds[0] || null;
  const multiSession = sessionIds.length > 1;

  const normalizeAchievementId = useCallback((value) => {
    if (!value) return undefined;
    if (typeof value === 'string') return value || undefined;
    if (typeof value === 'object' && typeof value.id === 'string') return value.id;
    return undefined;
  }, []);

  const normalizeAchievementIds = useCallback((value) => {
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
        if (value.trim()) return [value.trim()];
      }
    }

    return [];
  }, []);

  const loadAttempts = useCallback(async () => {
    if (sessionIds.length === 0) return;
    setLoading(true);
    try {
      const data = multiSession
        ? await api.getAttemptsBySessionsFull(sessionIds)
        : await api.getAttemptsBySession(primarySessionId);
      setAttempts(data);
    } catch (err) {
      console.error('Error loading attempts:', err);
    }
    setLoading(false);
  }, [sessionIds, multiSession, primarySessionId]);

  useEffect(() => {
    loadAttempts();
    const interval = setInterval(loadAttempts, 15000);
    return () => clearInterval(interval);
  }, [loadAttempts]);

  // Загружаем MC-тест для сессии (если есть), чтобы отображать текст опций вместо индексов
  useEffect(() => {
    if (!primarySessionId) return;
    let cancelled = false;
    const loadMCTest = async () => {
      try {
        const session = await api.getSession(primarySessionId);
        if (cancelled) return;
        const mcTestId = session?.mc_test;
        if (!mcTestId) { setMcTestData(null); return; }
        const mcTest = await api.getMCTest(mcTestId);
        if (!cancelled) setMcTestData(mcTest);
      } catch (_) { /* не критично */ }
    };
    loadMCTest();
    return () => { cancelled = true; };
  }, [primarySessionId]);

  const loadAchievements = useCallback(async () => {
    setAchievementsLoading(true);
    try {
      const data = await api.getAchievements();
      setAchievements(data);
    } catch (err) {
      console.error('Error loading achievements:', err);
      message.error('Ошибка загрузки достижений');
    }
    setAchievementsLoading(false);
  }, [message]);

  useEffect(() => {
    loadAchievements();
  }, [loadAchievements]);

  const loadAnswers = async (attemptId) => {
    if (expandedAnswers[attemptId]) return;
    try {
      const answers = await api.getAttemptAnswers(attemptId);
      setExpandedAnswers(prev => ({ ...prev, [attemptId]: answers }));
    } catch (err) {
      console.error('Error loading answers:', err);
    }
  };

  // Перезагрузить ответы для конкретной попытки (после зачёта)
  const reloadAnswers = async (attemptId) => {
    try {
      const answers = await api.getAttemptAnswers(attemptId);
      setExpandedAnswers(prev => ({ ...prev, [attemptId]: answers }));
    } catch (err) {
      console.error('Error reloading answers:', err);
    }
  };

  // Засчитать ответ вручную
  const handleAcceptAnswer = async (answer, attemptId) => {
    try {
      await api.updateAttemptAnswer(answer.id, { is_correct: true });

      // Пересчитать score
      const attempt = attempts.find(a => a.id === attemptId);
      if (attempt) {
        const newScore = (attempt.score || 0) + 1;
        await api.updateAttempt(attemptId, { score: newScore });
        setAttempts(prev => prev.map(a =>
          a.id === attemptId ? { ...a, score: newScore } : a
        ));
      }

      // Обновить ответы в развёрнутой строке
      await reloadAnswers(attemptId);
      message.success('Ответ засчитан');
    } catch (err) {
      console.error('Error accepting answer:', err);
      message.error('Ошибка при зачёте ответа');
    }
  };

  // Отменить зачёт (снять галочку)
  const handleRejectAnswer = async (answer, attemptId) => {
    try {
      await api.updateAttemptAnswer(answer.id, { is_correct: false });

      const attempt = attempts.find(a => a.id === attemptId);
      if (attempt) {
        const newScore = Math.max(0, (attempt.score || 0) - 1);
        await api.updateAttempt(attemptId, { score: newScore });
        setAttempts(prev => prev.map(a =>
          a.id === attemptId ? { ...a, score: newScore } : a
        ));
      }

      await reloadAnswers(attemptId);
      message.info('Зачёт отменён');
    } catch (err) {
      console.error('Error rejecting answer:', err);
      message.error('Ошибка при отмене зачёта');
    }
  };

  // Выдать другой вариант
  const handleNewVariant = async (attempt) => {
    Modal.confirm({
      title: 'Выдать другой вариант?',
      content: `Ученику ${attempt.student_name} будет назначен новый вариант. Текущая попытка сохранится.`,
      okText: 'Да, выдать',
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          // Новый вариант выдаём в той же сессии, где ученик писал: в режиме
          // «все выдачи» попытки приходят из разных выдач одной работы.
          const attemptSessionId = attempt.session || primarySessionId;
          const session = await api.getSession(attemptSessionId);
          if (!session) return;

          const allVariants = await api.getVariantsByWork(session.work);
          if (allVariants.length === 0) {
            message.error('В работе нет вариантов');
            return;
          }

          const allAttempts = await api.getAttemptsBySession(attemptSessionId);
          const assignmentCount = {};
          allVariants.forEach(v => { assignmentCount[v.id] = 0; });
          allAttempts.forEach(a => {
            if (assignmentCount[a.variant] !== undefined) {
              assignmentCount[a.variant]++;
            }
          });

          const variantIds = allVariants.map((v) => v.id);
          const usedByStudent = new Set(
            allAttempts
              .filter((a) => {
                if (attempt.student) return a.student === attempt.student;
                if (attempt.device_id) return a.device_id === attempt.device_id;
                return false;
              })
              .map((a) => a.variant)
              .filter(Boolean)
          );

          const selectMinAssigned = (ids) => {
            if (!ids.length) return [];
            const minCount = Math.min(...ids.map((id) => assignmentCount[id] ?? 0));
            return ids.filter((id) => (assignmentCount[id] ?? 0) === minCount);
          };

          // Приоритет:
          // 1) варианты, которых у ученика еще не было;
          // 2) если таких нет — любые варианты;
          // Внутри группы выбираем наименее выданные, затем случайно.
          let candidates = selectMinAssigned(variantIds.filter((id) => !usedByStudent.has(id)));
          if (candidates.length === 0) {
            candidates = selectMinAssigned(variantIds);
          }

          // Не повторяем текущий вариант, если есть альтернатива.
          if (candidates.length > 1) {
            const withoutCurrent = candidates.filter((id) => id !== attempt.variant);
            if (withoutCurrent.length > 0) {
              candidates = withoutCurrent;
            }
          }

          const shuffled = shuffleArray([...candidates]);
          const chosenVariantId = shuffled[0];
          const chosenVariant = allVariants.find(v => v.id === chosenVariantId);

          const taskList = chosenVariant.expand?.tasks || [];
          await api.createAttempt({
            session: attemptSessionId,
            student_name: attempt.student_name,
            device_id: attempt.device_id,
            student: attempt.student || null, // Копируем student из предыдущей попытки
            variant: chosenVariantId,
            status: 'started',
            score: 0,
            total: taskList.length,
          });

          message.success(`Ученику ${attempt.student_name} назначен Вариант ${chosenVariant.number}`);
          loadAttempts();
        } catch (err) {
          console.error('Error assigning new variant:', err);
          message.error('Ошибка при назначении варианта');
        }
      },
    });
  };

  const openManualAchievementsModal = (attempt) => {
    setManualAttempt(attempt);
    setManualRandomAchievementId(normalizeAchievementId(attempt.achievement));
    setManualUnlockedAchievementIds(normalizeAchievementIds(attempt.unlocked_achievements));
    setManualModalOpen(true);
  };

  const handleManualAchievementsSave = async () => {
    if (!manualAttempt) return;
    setManualSaving(true);
    try {
      const updated = await api.updateAttempt(manualAttempt.id, {
        achievement: manualRandomAchievementId || null,
        unlocked_achievements: manualUnlockedAchievementIds,
      });

      setAttempts((prev) => prev.map((a) => (
        a.id === manualAttempt.id
          ? {
            ...a,
            ...updated,
            achievement: manualRandomAchievementId || null,
            unlocked_achievements: manualUnlockedAchievementIds,
          }
          : a
      )));

      message.success('Ачивки обновлены');
      setManualModalOpen(false);
      setManualAttempt(null);
    } catch (err) {
      console.error('Error updating manual achievements:', err);
      message.error('Ошибка при сохранении ачивок');
    }
    setManualSaving(false);
  };

  const randomAchievementOptions = useMemo(() => {
    const base = achievements
      .filter((a) => a.type === 'random')
      .map((a) => ({
        value: a.id,
        label: `${a.title}${a.rarity ? ` (${a.rarity})` : ''}`,
      }));

    if (!manualRandomAchievementId) return base;
    if (base.some((o) => o.value === manualRandomAchievementId)) return base;

    const fallback = achievements.find((a) => a.id === manualRandomAchievementId);
    if (fallback) {
      return [...base, {
        value: fallback.id,
        label: `${fallback.title}${fallback.rarity ? ` (${fallback.rarity})` : ''}`,
      }];
    }

    return [...base, { value: manualRandomAchievementId, label: `${manualRandomAchievementId} (не найдено)` }];
  }, [achievements, manualRandomAchievementId]);

  const conditionAchievementOptions = useMemo(() => {
    const base = achievements
      .filter((a) => a.type === 'condition')
      .map((a) => ({
        value: a.id,
        label: a.title,
      }));

    const missingSelected = manualUnlockedAchievementIds.filter(
      (id) => !base.some((o) => o.value === id)
    );
    if (missingSelected.length === 0) return base;

    const extra = missingSelected.map((id) => {
      const fallback = achievements.find((a) => a.id === id);
      return {
        value: id,
        label: fallback?.title || `${id} (не найдено)`,
      };
    });

    return [...base, ...extra];
  }, [achievements, manualUnlockedAchievementIds]);

  const achievementById = useMemo(() => {
    const map = new Map();
    achievements.forEach((a) => map.set(a.id, a));
    return map;
  }, [achievements]);

  const manualIssuedItems = useMemo(() => {
    const items = [];
    if (manualRandomAchievementId) {
      const ach = achievementById.get(manualRandomAchievementId);
      items.push({
        id: manualRandomAchievementId,
        title: ach?.title || manualRandomAchievementId,
        type: 'random',
      });
    }

    manualUnlockedAchievementIds.forEach((id) => {
      const ach = achievementById.get(id);
      items.push({
        id,
        title: ach?.title || id,
        type: 'condition',
      });
    });

    return items;
  }, [manualRandomAchievementId, manualUnlockedAchievementIds, achievementById]);

  const statusMap = {
    started: { color: 'default', text: 'Начат' },
    submitted: { color: 'blue', text: 'Отправлен' },
    corrected: { color: 'green', text: 'Исправлен' },
  };

  const issueNumberByAttemptId = useMemo(() => {
    const grouped = {};
    attempts.forEach((attempt) => {
      const key = `${attempt.session}:${attempt.device_id}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(attempt);
    });

    const result = {};
    Object.values(grouped).forEach((group) => {
      group
        .sort((a, b) => new Date(a.created) - new Date(b.created))
        .forEach((attempt, index) => {
          result[attempt.id] = index + 1;
        });
    });

    return result;
  }, [attempts]);

  const columns = [
    {
      title: 'Ученик',
      dataIndex: 'student_name',
      key: 'student_name',
      width: 160,
    },
    ...(multiSession ? [{
      title: 'Из выдачи',
      key: 'sessionLabel',
      width: 170,
      render: (_, record) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {sessionLabels?.[record.session] || record.session}
        </Text>
      ),
    }] : []),
    {
      title: 'Вариант',
      key: 'variant',
      width: 80,
      render: (_, record) => record.expand?.variant?.number || '—',
    },
    {
      title: 'Выдача',
      key: 'issueNumber',
      width: 95,
      render: (_, record) => issueNumberByAttemptId[record.id] || 1,
    },
    {
      title: 'Результат',
      key: 'score',
      width: 100,
      render: (_, record) => {
        if (record.status === 'started') return <Text type="secondary">—</Text>;
        return <Text strong>{record.score} / {record.total}</Text>;
      },
    },
    {
      title: 'Статус',
      key: 'status',
      width: 110,
      render: (_, record) => {
        const s = statusMap[record.status] || { color: 'default', text: record.status };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: '',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="text"
            icon={<TrophyOutlined />}
            onClick={() => openManualAchievementsModal(record)}
            title="Выдать ачивки вручную"
            size="small"
          />
          <Button
            type="text"
            icon={<SwapOutlined />}
            onClick={() => handleNewVariant(record)}
            title="Другой вариант"
            size="small"
          />
          <Popconfirm
            title="Удалить попытку?"
            description="Все ответы этой попытки будут удалены."
            okText="Удалить"
            cancelText="Отмена"
            onConfirm={async () => {
              try {
                await api.deleteAttempt(record.id);
                setAttempts(prev => prev.filter(a => a.id !== record.id));
                setExpandedAnswers(prev => {
                  const next = { ...prev };
                  delete next[record.id];
                  return next;
                });
                message.success('Попытка удалена');
              } catch (err) {
                message.error('Ошибка при удалении попытки');
              }
            }}
          >
            <Button
              type="text"
              icon={<DeleteOutlined />}
              danger
              size="small"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Expandable: ответы по задачам с кнопкой «Засчитать»
  const expandedRowRender = (record) => {
    const answers = expandedAnswers[record.id];
    if (!answers) return <Spin size="small" />;

    if (answers.length === 0) {
      return <Text type="secondary">Нет ответов</Text>;
    }

    // Строим карту taskId → options[] из MC-теста (для отображения текста вместо индекса)
    const mcOptionsMap = {};
    if (mcTestData) {
      const variantNumber = record.mc_variant ?? record.variant;
      const variantData = (mcTestData.variants || []).find(
        v => String(v.number) === String(variantNumber)
      );
      if (variantData) {
        (variantData.tasks || []).forEach(t => {
          const tid = t.task_id || t.id;
          if (tid && Array.isArray(t.options)) mcOptionsMap[tid] = t.options;
        });
      }
    }

    // Строим карту taskId → порядковый номер из варианта
    const variant = record.expand?.variant;
    const taskPositionMap = {};
    if (variant) {
      let order = variant.order;
      if (typeof order === 'string') {
        try { order = JSON.parse(order); } catch { order = null; }
      }
      if (Array.isArray(order) && order.length > 0) {
        order.forEach(({ taskId, position }) => {
          if (taskId) taskPositionMap[taskId] = position + 1; // position хранится 0-based
        });
      } else if (Array.isArray(variant.tasks) && variant.tasks.length > 0) {
        // Fallback: порядок из массива tasks
        variant.tasks.forEach((id, idx) => {
          taskPositionMap[id] = idx + 1;
        });
      }
    }

    const answerColumns = [
      {
        title: 'Задача',
        key: 'task',
        width: 200,
        render: (_, a) => {
          const task = a.expand?.task;
          const hasContent = Boolean(task?.statement_md || task?.image || task?.image_url);
          const pos = task ? taskPositionMap[task.id] : undefined;

          return (
            <Space size={6}>
              {pos != null && (
                <Tag style={{ minWidth: 28, textAlign: 'center', fontWeight: 600 }}>{pos}</Tag>
              )}
              <Text>{task?.code || '—'}</Text>
              {hasContent && (
                <Popover
                  trigger="click"
                  placement="rightTop"
                  title={`Условие ${task?.code || ''}`}
                  overlayStyle={{ maxWidth: 560 }}
                  content={(
                    <div style={{ maxWidth: 520, maxHeight: 420, overflow: 'auto' }}>
                      {task?.statement_md ? (
                        <MathRenderer text={task.statement_md} />
                      ) : (
                        <Text type="secondary">Текст условия отсутствует</Text>
                      )}
                      {(task?.image_url || task?.image) && (
                        <img
                          src={task.image_url || `${PB_URL}/api/files/tasks/${task.id}/${task.image}`}
                          alt=""
                          style={{ maxWidth: '100%', marginTop: 8, borderRadius: 8 }}
                        />
                      )}
                    </div>
                  )}
                >
                  <Button type="text" size="small" icon={<EyeOutlined />} style={{ padding: 0 }} />
                </Popover>
              )}
            </Space>
          );
        },
      },
      {
        title: 'Ответ ученика',
        key: 'answer_raw',
        width: 160,
        render: (_, a) => {
          const taskId = a.expand?.task?.id || a.task;
          const options = mcOptionsMap[taskId];
          if (options) {
            const idx = parseInt(a.answer_raw, 10);
            const optionText = !isNaN(idx) && options[idx] ? options[idx].text : null;
            if (optionText) return <MathRenderer text={`$${optionText}$`} />;
          }
          return a.answer_raw || <Text type="secondary">(пусто)</Text>;
        },
      },
      {
        title: 'Правильный',
        key: 'correct',
        width: 120,
        render: (_, a) => a.expand?.task?.answer || '—',
      },
      {
        title: 'Результат',
        key: 'is_correct',
        width: 120,
        render: (_, a) => {
          if (a.is_correct) {
            return (
              <Space size={4}>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                <Button
                  type="text"
                  size="small"
                  danger
                  onClick={() => handleRejectAnswer(a, record.id)}
                  style={{ fontSize: 12, padding: '0 4px' }}
                >
                  Отменить
                </Button>
              </Space>
            );
          }
          return (
            <Space size={4}>
              <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
              <Button
                type="text"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => handleAcceptAnswer(a, record.id)}
                style={{ color: '#52c41a', fontSize: 12, padding: '0 4px' }}
              >
                Засчитать
              </Button>
            </Space>
          );
        },
      },
    ];

    return (
      <Table
        columns={answerColumns}
        dataSource={answers}
        rowKey="id"
        pagination={false}
        size="small"
      />
    );
  };

  if (loading && attempts.length === 0) {
    return <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text strong>Попытки учеников ({attempts.length})</Text>
        <Space size={6}>
          {attempts.length > 0 && !mcTestData && (
            <Button size="small" onClick={() => setClassRemOpen(true)}>
              🩹 Работа над ошибками класса
            </Button>
          )}
          <Button
            icon={<ReloadOutlined />}
            onClick={loadAttempts}
            loading={loading}
            size="small"
          >
            Обновить
          </Button>
        </Space>
      </div>

      <ClassRemediationModal
        open={classRemOpen}
        onClose={() => setClassRemOpen(false)}
        sessionId={primarySessionId}
        attempts={attempts}
      />

      {attempts.length === 0 ? (
        <Empty description="Пока нет ни одной попытки" />
      ) : (
        <Table
          columns={columns}
          dataSource={attempts}
          rowKey="id"
          size="small"
          pagination={false}
          expandable={{
            expandedRowRender,
            onExpand: (expanded, record) => {
              if (expanded) loadAnswers(record.id);
            },
          }}
          scroll={{ x: 600 }}
        />
      )}

      <Modal
        title={manualAttempt ? `Ачивки: ${manualAttempt.student_name}` : 'Ручная выдача ачивок'}
        open={manualModalOpen}
        onCancel={() => setManualModalOpen(false)}
        onOk={handleManualAchievementsSave}
        okText="Сохранить"
        cancelText="Отмена"
        confirmLoading={manualSaving}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Text type="secondary">Уже выдано</Text>
          {manualIssuedItems.length === 0 ? (
            <Text type="secondary">Пока ничего не выдано</Text>
          ) : (
            <Space wrap>
              {manualIssuedItems.map((item) => (
                <Tag key={`${item.type}:${item.id}`} color={item.type === 'random' ? 'gold' : 'blue'}>
                  {item.title}
                </Tag>
              ))}
            </Space>
          )}

          <Text type="secondary">Случайный значок (achievement)</Text>
          <Select
            allowClear
            showSearch
            placeholder="Выберите значок для выдачи"
            style={{ width: '100%' }}
            loading={achievementsLoading}
            options={randomAchievementOptions}
            value={manualRandomAchievementId}
            onChange={(value) => setManualRandomAchievementId(value)}
            optionFilterProp="label"
          />

          <Text type="secondary">Разблокированные достижения (unlocked_achievements)</Text>
          <Select
            mode="multiple"
            showSearch
            placeholder="Выберите достижения для выдачи"
            style={{ width: '100%' }}
            loading={achievementsLoading}
            options={conditionAchievementOptions}
            value={manualUnlockedAchievementIds}
            onChange={(value) => setManualUnlockedAchievementIds(value)}
            optionFilterProp="label"
          />
        </Space>
      </Modal>
    </div>
  );
};

export default TeacherResultsDashboard;
