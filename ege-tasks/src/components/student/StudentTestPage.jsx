import { useEffect, useMemo, useState } from 'react';
import { Input, Button, Typography, Modal, App } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import MathRenderer from '../MathRenderer';
import { api } from '../../services/pocketbase';
import { PB_BASE_URL } from '../../services/pocketbaseUrl';
import { checkAnswer } from '../../utils/answerChecker';
import { getRandomAchievement, checkUnlockedAchievements, getPreviouslyUnlockedIds, getPreviouslyEarnedBadgeIds } from '../../utils/achievementEngine';

const { Title, Text } = Typography;

const PB_URL = PB_BASE_URL;

/**
 * Страница прохождения теста.
 * Показывает задачи варианта с полями для ответов.
 */
const StudentTestPage = ({ studentSession }) => {
  const { message } = App.useApp();
  const { attempt, setAttempt, variant, tasks, session } = studentSession;
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [startTime] = useState(Date.now());
  const storageKey = useMemo(
    () => (attempt?.id ? `ege_student_answers_${attempt.id}` : null),
    [attempt?.id]
  );

  useEffect(() => {
    if (!storageKey || !tasks.length) return;

    try {
      const savedRaw = localStorage.getItem(storageKey);
      if (!savedRaw) return;

      const saved = JSON.parse(savedRaw);
      if (!saved || typeof saved !== 'object') return;

      const validTaskIds = new Set(tasks.map(t => t.id));
      const restored = Object.entries(saved).reduce((acc, [taskId, value]) => {
        if (validTaskIds.has(taskId)) {
          acc[taskId] = typeof value === 'string' ? value : String(value ?? '');
        }
        return acc;
      }, {});

      setAnswers(restored);
    } catch (err) {
      console.error('Error restoring saved student answers:', err);
    }
  }, [storageKey, tasks]);

  useEffect(() => {
    if (!storageKey || !tasks.length) return;

    try {
      const hasAnyAnswer = Object.values(answers).some(v => (v || '').trim().length > 0);
      if (!hasAnyAnswer) {
        localStorage.removeItem(storageKey);
        return;
      }
      localStorage.setItem(storageKey, JSON.stringify(answers));
    } catch (err) {
      console.error('Error saving student answers draft:', err);
    }
  }, [answers, storageKey, tasks.length]);

  const updateAnswer = (taskId, value) => {
    setAnswers(prev => ({ ...prev, [taskId]: value }));
  };

  const answeredCount = Object.values(answers).filter(a => a?.trim()).length;
  const progressPercent = tasks.length > 0 ? (answeredCount / tasks.length) * 100 : 0;
  const testTitle = session?.expand?.work?.title?.trim() || 'Тест';

  const handleSubmit = () => {
    Modal.confirm({
      title: 'Отправить ответы?',
      content: `Вы ответили на ${answeredCount} из ${tasks.length} вопросов. После отправки изменить ответы нельзя.`,
      okText: 'Отправить',
      cancelText: 'Вернуться',
      onOk: doSubmit,
    });
  };

  const doSubmit = async () => {
    setSubmitting(true);
    try {
      const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
      const durationMinutes = durationSeconds / 60;

      let score = 0;
      const answerRecords = [];

      for (const task of tasks) {
        const raw = answers[task.id] || '';
        const { isCorrect, normalized } = checkAnswer(raw, task.answer);
        if (isCorrect) score++;

        answerRecords.push({
          attempt: attempt.id,
          task: task.id,
          answer_raw: raw,
          answer_normalized: isNaN(normalized) ? 0 : normalized,
          is_correct: isCorrect,
        });
      }

      const percentage = tasks.length > 0 ? (score / tasks.length) * 100 : 0;

      console.log('[StudentTest] Результаты теста:', {
        score,
        total: tasks.length,
        percentage: percentage.toFixed(2),
        durationSeconds,
        answersCount: answerRecords.length,
      });

      let randomBadge = null;
      let unlocked = [];

      if (session.achievements_enabled) {
        console.log('[StudentTest] Обработка достижений включена');
        const achievements = await api.getAchievements();

        // Получить ВСЕ попытки студента (из всех сессий), чтобы не выдавать уже полученные ачивки
        const authStudent = api.getAuthStudent();
        let allAttempts = [];
        if (authStudent?.id) {
          const deviceId = localStorage.getItem('ege_device_id');
          const [studentAttempts, deviceAttempts] = await Promise.all([
            api.getAttemptsByStudentAll(authStudent.id),
            deviceId ? api.getAttemptsByDeviceAll(deviceId) : Promise.resolve([]),
          ]);
          const byId = new Map();
          [...studentAttempts, ...deviceAttempts].forEach((a) => byId.set(a.id, a));
          allAttempts = Array.from(byId.values());
        } else {
          const deviceId = localStorage.getItem('ege_device_id');
          if (deviceId) {
            allAttempts = await api.getAttemptsByDeviceAll(deviceId);
          }
        }

        // СЛУЧАЙНЫЙ ЗНАЧОК (badge) - выдается один за попытку на основе результата
        const previouslyEarnedBadgeIds = getPreviouslyEarnedBadgeIds(allAttempts);
        randomBadge = getRandomAchievement(achievements, percentage, previouslyEarnedBadgeIds);

        // УСЛОВНЫЕ ДОСТИЖЕНИЯ - разблокируются при выполнении условий
        const previouslyUnlockedIds = getPreviouslyUnlockedIds(allAttempts);
        const attemptsIncludingCurrent = allAttempts.some((a) => a.id === attempt.id)
          ? allAttempts
          : [...allAttempts, { id: attempt.id }];
        unlocked = checkUnlockedAchievements(
          achievements,
          {
            percentage,
            durationMinutes,
            submittedAt: new Date().toISOString(),
          },
          attemptsIncludingCurrent,
          previouslyUnlockedIds
        );

        console.log('[StudentTest] Обработка достижений завершена:', {
          randomBadge: randomBadge?.code || null,
          unlockedCount: unlocked.length,
        });
      }

      const existingAnswers = await api.getAttemptAnswers(attempt.id);
      console.log('[StudentTest] Существующих ответов:', existingAnswers.length);

      const existingByTaskId = new Map(existingAnswers.map((a) => [a.task, a]));
      const toCreate = [];
      const toUpdate = [];

      for (const record of answerRecords) {
        const existing = existingByTaskId.get(record.task);
        if (existing?.id) {
          toUpdate.push({ id: existing.id, ...record });
        } else {
          toCreate.push(record);
        }
      }

      console.log('[StudentTest] Сохранение ответов:', {
        toCreate: toCreate.length,
        toUpdate: toUpdate.length,
      });

      if (toCreate.length > 0) {
        const created = await api.batchCreateAttemptAnswers(toCreate);
        console.log('[StudentTest] Создано ответов:', created.length);
      }
      if (toUpdate.length > 0) {
        const updated = await api.batchUpdateAttemptAnswers(toUpdate);
        console.log('[StudentTest] Обновлено ответов:', updated.length);
      }

      console.log('[StudentTest] Обновление попытки:', {
        attemptId: attempt.id,
        status: 'submitted',
        score,
        total: tasks.length,
        achievement: randomBadge?.id || null,
        unlocked: unlocked.map(a => a.id),
      });

      const updated = await api.updateAttempt(attempt.id, {
        status: 'submitted',
        score,
        total: tasks.length,
        submitted_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
        achievement: randomBadge?.id || null,
        unlocked_achievements: unlocked.map(a => a.id),
      });

      console.log('[StudentTest] Попытка обновлена:', updated);

      if (storageKey) {
        localStorage.removeItem(storageKey);
      }

      const updatedWithExpand = {
        ...updated,
        expand: {
          achievement: randomBadge,
          unlocked_achievements: unlocked,
        },
      };

      setAttempt({ ...attempt, ...updatedWithExpand });
      console.log('[StudentTest] Состояние попытки обновлено, переход к результатам');
      message.success('Ответы отправлены');
    } catch (err) {
      console.error('[StudentTest] ОШИБКА при отправке ответов:', err);
      message.error('Ошибка при отправке ответов: ' + (err.message || 'неизвестная ошибка'));
    }
    setSubmitting(false);
  };

  if (!variant || !tasks.length) {
    return (
      <div className="student-skeleton">
        <div className="student-skeleton-line" style={{ width: '50%' }} />
        <div className="student-skeleton-line" style={{ width: '30%' }} />
        {[1, 2, 3].map(i => (
          <div key={i} className="student-skeleton-btn" style={{ height: 100, marginTop: 16 }} />
        ))}
      </div>
    );
  }

  return (
    <div className="student-test">
      <div className="student-test-header">
        <Title level={4} className="student-test-variant-title">
          Вариант {variant.number}
        </Title>
        <Text className="student-test-title">{testTitle}</Text>
        <Text className="student-test-meta">
          {attempt.student_name}
          {attempt?.issueNumber ? ` · Выдача №${attempt.issueNumber}` : ''}
        </Text>
      </div>

      {/* Progress bar */}
      <div className="student-test-progress">
        <div className="student-test-progress-bar">
          <div
            className="student-test-progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="student-test-progress-text">
          <span>Отвечено: {answeredCount} из {tasks.length}</span>
          <span>{Math.round(progressPercent)}%</span>
        </div>
      </div>

      {tasks.map((task, idx) => {
        const isFilled = (answers[task.id] || '').trim().length > 0;
        return (
          <div
            key={task.id}
            className={`task-item ${isFilled ? 'task-item--filled' : ''}`}
            style={{ animationDelay: `${0.05 * idx}s` }}
          >
            <div className="task-number">Задача {idx + 1}</div>
            <div className="task-statement">
              <MathRenderer text={task.statement_md} answerBoxes />
              {(task.image_url || task.image) && (
                <img
                  src={task.image_url || `${PB_URL}/api/files/tasks/${task.id}/${task.image}`}
                  alt=""
                  style={{ maxWidth: '100%', marginTop: 8, borderRadius: 12 }}
                />
              )}
            </div>
            <Input
              className="task-answer-input"
              placeholder="Ответ"
              inputMode="text"
              type="text"
              value={answers[task.id] || ''}
              onChange={e => updateAnswer(task.id, e.target.value)}
            />
          </div>
        );
      })}

      <div className="submit-bar">
        <Button
          type="primary"
          size="large"
          block
          icon={<SendOutlined />}
          onClick={handleSubmit}
          loading={submitting}
        >
          Отправить ответы
        </Button>
      </div>
    </div>
  );
};

export default StudentTestPage;
