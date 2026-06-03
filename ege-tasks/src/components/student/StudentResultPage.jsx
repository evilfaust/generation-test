import { useState, useEffect } from 'react';
import { Typography, Spin, Button } from 'antd';
import { CheckCircleOutlined, TrophyOutlined } from '@ant-design/icons';
import MathRenderer from '../MathRenderer';
import { api } from '../../services/pocketbase';
import { PB_BASE_URL } from '../../services/pocketbaseUrl';
import AchievementBadge from './AchievementBadge';

const { Title, Text } = Typography;

const PB_URL = PB_BASE_URL;

/**
 * Страница результатов ученика.
 */
const StudentResultPage = ({ studentSession, onNavigateToGallery }) => {
  const {
    attempt, tasks, session,
    passingScore = 0, retryEnabled = false, maxAttempts = 0,
    attemptsUsed = 0, attemptsLeft = 0, bestAttempt = null,
    canRetry = false, startRetry,
  } = studentSession;
  const [attemptAnswers, setAttemptAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [resolvedAchievement, setResolvedAchievement] = useState(null);
  const [resolvedUnlocked, setResolvedUnlocked] = useState([]);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await startRetry();
    } finally {
      setRetrying(false);
    }
  };

  useEffect(() => {
    if (!attempt) return;
    const load = async () => {
      setLoading(true);
      const answers = await api.getAttemptAnswers(attempt.id);
      setAttemptAnswers(answers);
      setLoading(false);
    };
    load();
  }, [attempt?.id, attempt?.status]);

  const wrongAnswers = attemptAnswers.filter(a => !a.is_correct);
  const score = attempt?.score || 0;
  const total = attempt?.total || tasks.length;
  const percentage = total > 0 ? (score / total) * 100 : 0;
  const scoreClass = percentage >= 70 ? 'good' : percentage >= 40 ? 'ok' : 'bad';
  const achievementsEnabled = session?.achievements_enabled || false;
  const testTitle = session?.expand?.work?.title?.trim() || 'Тест';

  useEffect(() => {
    let cancelled = false;
    const loadAchievements = async () => {
      if (!achievementsEnabled || !attempt) {
        setResolvedAchievement(null);
        setResolvedUnlocked([]);
        return;
      }

      // Если expand уже есть — используем его (данные с сервера после отправки теста)
      const expandedAchievement = attempt?.expand?.achievement;
      const expandedUnlocked = attempt?.expand?.unlocked_achievements;

      if (expandedAchievement && Array.isArray(expandedUnlocked)) {
        setResolvedAchievement(expandedAchievement);
        setResolvedUnlocked(expandedUnlocked);
        return;
      }

      // Иначе загружаем по ID (если данные обновились от учителя или через polling)
      const achievementId = typeof attempt?.achievement === 'string'
        ? attempt.achievement : attempt?.achievement?.id;
      const unlockedIds = Array.isArray(attempt?.unlocked_achievements)
        ? attempt.unlocked_achievements : [];

      const idsToLoad = [];
      if (achievementId) idsToLoad.push(achievementId);
      if (unlockedIds.length > 0) idsToLoad.push(...unlockedIds);

      if (idsToLoad.length === 0) {
        setResolvedAchievement(null);
        setResolvedUnlocked([]);
        return;
      }

      const loaded = await api.getAchievementsByIds(idsToLoad);
      if (cancelled) return;

      const byId = new Map(loaded.map((a) => [a.id, a]));
      setResolvedAchievement(achievementId ? byId.get(achievementId) || null : null);
      setResolvedUnlocked(unlockedIds.map((id) => byId.get(id)).filter(Boolean));
    };

    loadAchievements();
    return () => { cancelled = true; };
  }, [achievementsEnabled, attempt?.id, attempt?.achievement, attempt?.unlocked_achievements, attempt?.expand]);

  const hasAchievement = achievementsEnabled && !!resolvedAchievement;
  const hasUnlockedAchievements = achievementsEnabled && resolvedUnlocked.length > 0;

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="student-result">
      <div className="student-result-header">
        <Title level={4} className="student-result-title">Результат</Title>
        <Text className="student-result-test-title">{testTitle}</Text>
        <Text className="student-result-meta">
          {attempt?.student_name}
          {attempt?.issueNumber ? ` · Выдача №${attempt.issueNumber}` : ''}
        </Text>
      </div>

      {/* Score card */}
      <div className="student-result-score-card">
        <div className={`student-result-score-value ${scoreClass}`}>
          {score} из {total}
        </div>
        <div className="student-result-score-label">
          {Math.round(percentage)}% правильных ответов
        </div>
        <div className="student-result-score-bar">
          <div className={`student-result-score-bar-fill ${scoreClass}`} style={{ width: `${percentage}%` }} />
        </div>
      </div>

      {/* Зачёт / попытки */}
      {(passingScore > 0 || retryEnabled) && (() => {
        const bestScore = bestAttempt?.score ?? score;
        const bestTotal = bestAttempt?.total ?? total;
        const passed = passingScore > 0 && bestScore >= passingScore;
        const shortfall = Math.max(0, passingScore - bestScore);
        const mod = passingScore > 0 ? (passed ? 'pass' : 'fail') : 'neutral';
        const bestPct = bestTotal > 0 ? Math.min(100, (bestScore / bestTotal) * 100) : 0;
        const thresholdPct = bestTotal > 0 ? Math.min(100, (passingScore / bestTotal) * 100) : 0;
        return (
          <div className={`srp-status srp-status--${mod}`}>
            {/* Статус зачёта */}
            {passingScore > 0 && (
              <div className="srp-status-head">
                <div className="srp-status-icon">{passed ? '✓' : '✕'}</div>
                <div className="srp-status-texts">
                  <div className="srp-status-title">{passed ? 'Зачёт' : 'Не зачёт'}</div>
                  <div className="srp-status-sub">
                    {passed
                      ? `Лучший результат ${bestScore} из ${bestTotal} — порог пройден`
                      : `Лучший результат ${bestScore} из ${bestTotal}. До зачёта не хватает ${shortfall}`}
                  </div>
                </div>
              </div>
            )}

            {/* Прогресс с отметкой проходного балла */}
            {passingScore > 0 && (
              <div className="srp-bar-wrap">
                <div className="srp-bar">
                  <div className={`srp-bar-fill srp-bar-fill--${mod}`} style={{ width: `${bestPct}%` }} />
                  <div className="srp-bar-threshold" style={{ left: `${thresholdPct}%` }}>
                    <span className="srp-bar-threshold-flag">Порог {passingScore}</span>
                  </div>
                </div>
                <div className="srp-bar-caption">
                  <span>Лучший: <b>{bestScore}</b></span>
                  <span>Всего: {bestTotal}</span>
                </div>
              </div>
            )}

            {/* Попытки */}
            {retryEnabled && (
              <div className="srp-attempts">
                <div className="srp-attempts-row">
                  <span className="srp-attempts-label">
                    Попытка <b>{attemptsUsed}</b> из {maxAttempts}
                  </span>
                  <span className={`srp-attempts-left ${attemptsLeft > 0 ? '' : 'srp-attempts-left--empty'}`}>
                    {attemptsLeft > 0 ? `осталось ${attemptsLeft}` : 'попытки закончились'}
                  </span>
                </div>
                <div className="srp-dots">
                  {Array.from({ length: maxAttempts }, (_, i) => (
                    <span
                      key={i}
                      className={`srp-dot ${i < attemptsUsed ? 'srp-dot--used' : 'srp-dot--free'}`}
                    />
                  ))}
                </div>
              </div>
            )}

            {canRetry && (
              <Button
                type="primary"
                size="large"
                block
                loading={retrying}
                onClick={handleRetry}
                className="srp-retry-btn"
              >
                Пройти ещё раз
              </Button>
            )}
          </div>
        );
      })()}

      {/* Summary */}
      <div className={`student-result-summary ${wrongAnswers.length === 0 ? 'student-result-summary--perfect' : ''}`}>
        {wrongAnswers.length === 0 ? (
          <><CheckCircleOutlined /> Все ответы верны!</>
        ) : (
          <Text type="secondary" style={{ fontSize: 16 }}>Ошибок: {wrongAnswers.length}</Text>
        )}
      </div>

      {/* Блок достижений */}
      {achievementsEnabled && (
        <>
          {/* Полученный случайный значок */}
          {hasAchievement && (
            <div className="achievement-section achievement-reveal">
              <div className="achievement-header">
                <Title level={3} className="achievement-section-title">Получен значок!</Title>
              </div>
              <AchievementBadge achievement={resolvedAchievement} size="large" showDetails animated animationDelay={300} />
            </div>
          )}

          {/* Разблокированные достижения */}
          {hasUnlockedAchievements && (
            <div className="unlocked-section achievement-reveal">
              <div className="achievement-header">
                <Title level={3} className="achievement-section-title">Новые достижения!</Title>
              </div>
              <div className="unlocked-achievements-grid">
                {resolvedUnlocked.map((ach, index) => (
                  <AchievementBadge key={ach.id} achievement={ach} size="medium" showDetails animated animationDelay={800 + index * 200} />
                ))}
              </div>
            </div>
          )}

          {/* Сообщение если значок не выдан (но результат >= 40%) */}
          {!hasAchievement && !hasUnlockedAchievements && percentage >= 40 && (
            <div className="achievement-section" style={{ textAlign: 'center', padding: '20px', background: '#f5f5f5', borderRadius: '12px', marginTop: '16px' }}>
              <Text type="secondary" style={{ fontSize: '14px' }}>
                {percentage >= 90
                  ? 'Все легендарные значки уже получены! Попробуйте разблокировать достижения за специальные условия.'
                  : percentage >= 70
                  ? 'Все редкие значки этого уровня уже получены! Стремитесь к результату 90%+ для легендарных значков.'
                  : 'Все обычные значки уже получены! Набирайте 70%+ для получения редких значков.'
                }
              </Text>
            </div>
          )}

          {/* Кнопка "Мои достижения" */}
          {onNavigateToGallery && (
            <div className="student-result-gallery-btn">
              <Button type="dashed" icon={<TrophyOutlined />} size="large" onClick={onNavigateToGallery}>
                Посмотреть мои достижения
              </Button>
            </div>
          )}
        </>
      )}

      {/* Список ошибочных задач */}
      {wrongAnswers.length > 0 && (
        <>
          <div className="student-result-errors-title">Ошибочные задачи</div>
          {wrongAnswers.map((answer, i) => {
            const task = tasks.find(t => t.id === answer.task) || answer.expand?.task;
            if (!task) return null;
            const taskIndex = tasks.findIndex(t => t.id === answer.task);
            const taskNumber = taskIndex >= 0 ? taskIndex + 1 : i + 1;
            const mcOptions = task.mc_options;
            const selectedIndex = mcOptions ? parseInt(answer.answer_raw, 10) : NaN;
            const mcOptionText = mcOptions && !isNaN(selectedIndex) && mcOptions[selectedIndex]
              ? mcOptions[selectedIndex].text
              : null;
            const displayAnswer = mcOptionText ?? (answer.answer_raw || '(пусто)');
            const isMcAnswer = mcOptionText !== null;
            return (
              <div key={answer.id} className="error-task" style={{ animationDelay: `${0.08 * i}s` }}>
                <div className="task-number">Задача {taskNumber}</div>
                <div className="task-statement">
                  <MathRenderer text={task.statement_md} />
                  {(task.image_url || task.image) && (
                    <img src={task.image_url || `${PB_URL}/api/files/tasks/${task.id}/${task.image}`} alt="" style={{ maxWidth: '100%', marginTop: 8, borderRadius: 12 }} />
                  )}
                </div>
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Text type="secondary">Ваш ответ: </Text>
                  <span className="wrong-badge">
                    {isMcAnswer ? <MathRenderer text={`$${displayAnswer}$`} /> : displayAnswer}
                  </span>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
};

export default StudentResultPage;
