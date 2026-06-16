import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../shared/services/pocketbase';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import { buildWeaknessProfile } from '../shared/utils/weaknessProfile';

// Профиль слабостей одного ученика: сводит внутренние прохождения Lemma и внешние
// результаты решу.ЕГЭ в тематическую модель (см. shared/utils/weaknessProfile.js).
//
// external (опц.) — { taskResults, exams } можно прокинуть снаружи, чтобы не грузить
// классные ext_journal-данные на каждого ученика (редактор грузит один раз и раздаёт).
export function useStudentWeaknessProfile(student, { external } = {}) {
  const { egeBaseTopics } = useReferenceData();
  const [internalAnswers, setInternalAnswers] = useState([]);
  const [attemptDateById, setAttemptDateById] = useState(() => new Map());
  const [extData, setExtData] = useState(external || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ege_number → тема ege_base (мост «решу→тема», как в ExternalThematic).
  const topicByNum = useMemo(() => {
    const m = new Map();
    for (const t of egeBaseTopics || []) if (t.ege_number) m.set(t.ege_number, t);
    return m;
  }, [egeBaseTopics]);

  const load = useCallback(async () => {
    if (!student?.id) { setInternalAnswers([]); setAttemptDateById(new Map()); return; }
    setLoading(true);
    setError(null);
    try {
      // Внутренние: попытки ученика → их даты → ответы по задачам (expand task.topic).
      const attempts = await api.getAttemptsByStudentAll(student.id);
      const dateMap = new Map(attempts.map((a) => [a.id, a.created]));
      const answers = attempts.length
        ? await api.getAttemptAnswersByAttempts(attempts.map((a) => a.id))
        : [];
      setAttemptDateById(dateMap);
      setInternalAnswers(answers);

      // Внешние: грузим один раз, если не переданы снаружи.
      if (!extData) {
        const [taskResults, exams] = await Promise.all([
          api.getExtTaskResultsAll(),
          api.getExtExams(),
        ]);
        setExtData({ taskResults, exams });
      }
    } catch (e) {
      console.error('useStudentWeaknessProfile load error:', e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [student?.id, extData]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (external) setExtData(external); }, [external]);

  const profile = useMemo(() => {
    const examDateById = new Map((extData?.exams || []).map((e) => [e.exam_id, e.date]));
    return buildWeaknessProfile({
      student,
      internalAnswers,
      attemptDateById,
      externalTaskResults: extData?.taskResults || [],
      topicByNum,
      examDateById,
    });
  }, [student, internalAnswers, attemptDateById, extData, topicByNum]);

  return { profile, loading, error, reload: load };
}
