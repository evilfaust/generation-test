import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/pocketbase';
import { shuffleArray } from '../utils/shuffle';
import { shuffleOptionsWithSeed, hashStringToSeed } from '../utils/distractorGenerator';

// Загрузка задач варианта MC-теста: getTasksByIds + прикрепляем mc_options
async function loadMCVariantTasks(mcTest, variantNumber, attemptId, deviceId, authStudentId) {
  const variantData = mcTest.variants.find(v => String(v.number) === String(variantNumber));
  if (!variantData) return { variant: null, tasks: [] };

  const taskIds = variantData.tasks.map(t => t.task_id);
  const taskRecords = await api.getTasksByIds(taskIds);
  const recById = new Map(taskRecords.map(t => [t.id, t]));

  const seedBase = mcTest.shuffle_mode === 'per_student'
    ? `${attemptId || authStudentId || deviceId || 'anon'}`
    : (mcTest.id || 'fixed');

  const tasks = variantData.tasks
    .map((t, ti) => {
      const rec = recById.get(t.task_id);
      if (!rec) return null;
      const seed = hashStringToSeed(`${seedBase}-${variantNumber}-${ti}-${t.task_id}`);
      const orderedOptions = mcTest.shuffle_mode === 'fixed'
        ? t.options
        : shuffleOptionsWithSeed(t.options, seed);
      return { ...rec, mc_options: orderedOptions };
    })
    .filter(Boolean);

  const syntheticVariant = {
    id: `mc-${variantNumber}`,
    number: variantNumber,
    isMC: true,
  };
  return { variant: syntheticVariant, tasks };
}

/**
 * Хук для управления сессией ученика.
 * Загружает сессию, проверяет существующую попытку, назначает вариант.
 */
export function useStudentSession(sessionId, deviceId, authStudentId = null) {
  const [session, setSession] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [variant, setVariant] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const getIssueNumber = useCallback((attemptRecord, attempts = []) => {
    if (!attemptRecord?.id) return 1;

    const sameDeviceAttempts = attempts
      .filter(a => a.device_id === attemptRecord.device_id)
      .sort((a, b) => new Date(a.created) - new Date(b.created));

    const index = sameDeviceAttempts.findIndex(a => a.id === attemptRecord.id);
    return index >= 0 ? index + 1 : sameDeviceAttempts.length + 1;
  }, []);

  const getAccessibleAttempts = useCallback(async () => {
    if (!sessionId) return [];

    if (authStudentId) {
      const [studentAttempts, deviceAttempts] = await Promise.all([
        api.getAttemptsByStudent(sessionId, authStudentId),
        api.getAttemptsByDevice(sessionId, deviceId),
      ]);

      const byId = new Map();
      [...studentAttempts, ...deviceAttempts].forEach((a) => byId.set(a.id, a));
      return Array.from(byId.values()).sort((a, b) => new Date(b.created) - new Date(a.created));
    }

    return await api.getAttemptsByDevice(sessionId, deviceId);
  }, [sessionId, deviceId, authStudentId]);

  // Загрузка сессии и проверка существующей попытки
  useEffect(() => {
    if (!sessionId || !deviceId) return;

    const init = async () => {
      setLoading(true);
      setError(null);
      try {
        // Загрузить сессию
        const sessionData = await api.getSession(sessionId);
        if (!sessionData) {
          setError('Сессия не найдена');
          setLoading(false);
          return;
        }
        setSession(sessionData);

        // Сбросить состояние перед переопределением попытки (например, после логина)
        setAttempt(null);
        setVariant(null);
        setTasks([]);

        // Проверить существующую попытку для ЭТОЙ сессии.
        // Для авторизованного студента учитываем и student_id, и device_id
        // (чтобы подхватывать попытки, созданные до логина на этом устройстве).
        const existingAttempts = await getAccessibleAttempts();
        let existingAttempt = existingAttempts[0] || null;

        // Если попытка была создана как гостевая, привязываем ее к студенту.
        if (existingAttempt && authStudentId && !existingAttempt.student) {
          try {
            existingAttempt = await api.updateAttempt(existingAttempt.id, {
              student: authStudentId,
              student_name: existingAttempt.student_name,
            });
          } catch (linkErr) {
            // Если привязка не удалась, продолжаем с текущей попыткой без блокировки UX.
          }
        }

        if (existingAttempt) {
          const allAttempts = await api.getAttemptsBySession(sessionId);
          setAttempt({
            ...existingAttempt,
            issueNumber: getIssueNumber(existingAttempt, allAttempts),
          });

          if (sessionData.mc_test) {
            // MC-тест: загрузить mc_test и собрать задачи с опциями
            const mcTest = await api.getMCTest(sessionData.mc_test);
            const { variant: mcVariant, tasks: mcTasks } = await loadMCVariantTasks(
              mcTest,
              existingAttempt.mc_variant ?? existingAttempt.variant,
              existingAttempt.id,
              deviceId,
              authStudentId
            );
            if (mcVariant) {
              setVariant(mcVariant);
              setTasks(mcTasks);
            }
          } else {
            // Обычная работа
            const variantData = await api.getVariant(existingAttempt.variant);
            if (variantData) {
              setVariant(variantData);
              await loadVariantTasks(variantData);
            }
          }
        }
      } catch (err) {
        console.error('Error initializing student session:', err);
        setError('Ошибка загрузки сессии');
      }
      setLoading(false);
    };

    init();
  }, [sessionId, deviceId, authStudentId, getIssueNumber, getAccessibleAttempts]);

  // Загрузка задач варианта в правильном порядке
  const loadVariantTasks = async (variantData) => {
    if (!variantData) return;
    const expand = variantData.expand || {};
    let taskList = expand.tasks || [];

    // Если есть order, сортируем задачи по нему
    if (variantData.order && Array.isArray(variantData.order)) {
      const orderMap = {};
      variantData.order.forEach((taskId, idx) => { orderMap[taskId] = idx; });
      taskList = [...taskList].sort((a, b) => {
        const idxA = orderMap[a.id] !== undefined ? orderMap[a.id] : 999;
        const idxB = orderMap[b.id] !== undefined ? orderMap[b.id] : 999;
        return idxA - idxB;
      });
    }

    setTasks(taskList);
  };

  // Начать новую попытку: назначить вариант и создать attempt
  const startAttempt = useCallback(async (studentName) => {
    if (!session) return null;

    try {
      // Если попытка уже есть (включая гостевую на текущем устройстве), продолжаем её.
      const existingAttempts = await getAccessibleAttempts();
      const existingAttempt = existingAttempts[0] || null;
      if (existingAttempt) {
        let resolvedAttempt = existingAttempt;
        if (authStudentId && !existingAttempt.student) {
          try {
            resolvedAttempt = await api.updateAttempt(existingAttempt.id, {
              student: authStudentId,
              student_name: studentName,
            });
          } catch (linkErr) {
            // Не блокируем старт, если не удалось привязать гостевую попытку.
          }
        }

        const allAttempts = await api.getAttemptsBySession(sessionId);
        setAttempt({
          ...resolvedAttempt,
          issueNumber: getIssueNumber(resolvedAttempt, allAttempts),
        });
        if (session.mc_test) {
          const mcTest = await api.getMCTest(session.mc_test);
          const { variant: mcVariant, tasks: mcTasks } = await loadMCVariantTasks(
            mcTest, resolvedAttempt.mc_variant ?? resolvedAttempt.variant, resolvedAttempt.id, deviceId, authStudentId
          );
          if (mcVariant) { setVariant(mcVariant); setTasks(mcTasks); }
        } else {
          const existingVariant = await api.getVariant(resolvedAttempt.variant);
          if (existingVariant) {
            setVariant(existingVariant);
            await loadVariantTasks(existingVariant);
          }
        }
        return resolvedAttempt;
      }

      // === MC-тест: round-robin по mc_test.variants ===
      if (session.mc_test) {
        const mcTest = await api.getMCTest(session.mc_test);
        const mcVariants = mcTest.variants || [];
        if (!mcVariants.length) {
          setError('В тесте нет вариантов');
          return null;
        }
        const allAttemptsAll = await api.getAttemptsBySession(sessionId);
        const counts = {};
        mcVariants.forEach(v => { counts[String(v.number)] = 0; });
        allAttemptsAll.forEach(a => {
          const key = String(a.mc_variant ?? a.variant ?? '');
          if (counts[key] !== undefined) counts[key]++;
        });
        const min = Math.min(...Object.values(counts));
        const candidates = Object.keys(counts).filter(k => counts[k] === min);
        const chosenNumber = shuffleArray([...candidates])[0];
        const chosenVariant = mcVariants.find(v => String(v.number) === chosenNumber);

        const newAttempt = await api.createAttempt({
          session: sessionId,
          student_name: studentName,
          device_id: deviceId,
          ...(authStudentId ? { student: authStudentId } : {}),
          mc_variant: Number(chosenNumber),
          status: 'started',
          score: 0,
          total: chosenVariant.tasks.length,
        });
        const { variant: mcVariant, tasks: mcTasks } = await loadMCVariantTasks(
          mcTest, chosenNumber, newAttempt.id, deviceId, authStudentId
        );
        setAttempt({
          ...newAttempt,
          issueNumber: getIssueNumber(newAttempt, [...allAttemptsAll, newAttempt]),
        });
        if (mcVariant) { setVariant(mcVariant); setTasks(mcTasks); }
        return newAttempt;
      }

      // Получить все варианты работы
      const allVariants = await api.getVariantsByWork(session.work);
      if (allVariants.length === 0) {
        setError('В работе нет вариантов');
        return null;
      }

      // Получить все попытки этой сессии для подсчёта назначений
      const allAttempts = await api.getAttemptsBySession(sessionId);

      // Подсчитать, сколько раз каждый вариант назначен
      const assignmentCount = {};
      allVariants.forEach(v => { assignmentCount[v.id] = 0; });
      allAttempts.forEach(a => {
        if (assignmentCount[a.variant] !== undefined) {
          assignmentCount[a.variant]++;
        }
      });

      // Выбрать варианты с минимальным количеством назначений
      const minCount = Math.min(...Object.values(assignmentCount));
      const candidateIds = Object.keys(assignmentCount).filter(
        id => assignmentCount[id] === minCount
      );

      // Случайный из кандидатов
      const shuffled = shuffleArray([...candidateIds]);
      const chosenVariantId = shuffled[0];
      const chosenVariant = allVariants.find(v => v.id === chosenVariantId);

      // Создать attempt
      const taskList = chosenVariant.expand?.tasks || [];
      const newAttempt = await api.createAttempt({
        session: sessionId,
        student_name: studentName,
        device_id: deviceId,
        ...(authStudentId ? { student: authStudentId } : {}),
        variant: chosenVariantId,
        status: 'started',
        score: 0,
        total: taskList.length,
      });

      setAttempt({
        ...newAttempt,
        issueNumber: getIssueNumber(newAttempt, [...allAttempts, newAttempt]),
      });
      setVariant(chosenVariant);
      await loadVariantTasks(chosenVariant);

      return newAttempt;
    } catch (err) {
      console.error('Error starting attempt:', err);
      setError('Ошибка при начале теста');
      return null;
    }
  }, [session, sessionId, deviceId, authStudentId, getIssueNumber, getAccessibleAttempts]);

  // Периодическое обновление attempt (для ручной выдачи ачивок учителем)
  useEffect(() => {
    if (!attempt || !attempt.id || attempt.status === 'started') return;

    const refreshAttempt = async () => {
      try {
        const attempts = await getAccessibleAttempts();
        const fresh = attempts.find(a => a.id === attempt.id) || null;
        if (fresh) {
          // Обновляем только если изменились поля ачивок или статус
          const achChanged = fresh.achievement !== attempt.achievement
            || JSON.stringify(fresh.unlocked_achievements) !== JSON.stringify(attempt.unlocked_achievements)
            || fresh.status !== attempt.status
            || fresh.score !== attempt.score;
          if (achChanged) {
            setAttempt(prev => ({ ...prev, ...fresh, issueNumber: prev?.issueNumber }));
          }
        }
      } catch (err) {
        // Игнорируем ошибки polling
      }
    };

    const interval = setInterval(refreshAttempt, 10000); // каждые 10 секунд
    return () => clearInterval(interval);
  }, [attempt?.id, attempt?.status, attempt?.achievement, attempt?.unlocked_achievements, getAccessibleAttempts]);

  return {
    session,
    attempt,
    setAttempt,
    variant,
    tasks,
    loading,
    error,
    startAttempt,
  };
}
