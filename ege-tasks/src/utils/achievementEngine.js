import { shuffleArray } from './shuffle';

/**
 * Выбрать случайный значок по редкости на основе процента правильных ответов
 *
 * ЛОГИКА ВЫДАЧИ:
 * - 90%+ → legendary (8 значков)
 * - 70-89% → rare (12 значков)
 * - 40-69% → common (16 значков)
 * - <40% → не выдается
 *
 * УНИКАЛЬНОСТЬ:
 * - Сначала пытаемся выдать неполученный значок той же редкости
 * - Если все значки редкости уже получены → возвращаем null (не дублируем)
 *
 * @param {Array} achievements - массив всех достижений
 * @param {number} percentage - процент правильных ответов (0-100)
 * @param {Array} excludedIds - ID уже полученных случайных значков (badge.achievement)
 * @returns {object|null} - выбранный значок или null если нечего выдавать
 */
export function getRandomAchievement(achievements, percentage, excludedIds = []) {
  // Определить редкость и fallback-цепочку на основе результата
  // ≥90%: legendary → rare → common
  // 70-89%: rare → common
  // 40-69%: common
  // <40%: не выдаётся
  let rarityChain;
  if (percentage >= 90) {
    rarityChain = ['legendary', 'rare', 'common'];
  } else if (percentage >= 70) {
    rarityChain = ['rare', 'common'];
  } else if (percentage >= 40) {
    rarityChain = ['common'];
  } else {
    console.log('[AchievementEngine] Результат слишком низкий для значка:', percentage);
    return null;
  }

  const excluded = new Set(excludedIds);

  for (const rarity of rarityChain) {
    const pool = achievements.filter(
      (a) => a.type === 'random' && a.rarity === rarity && !excluded.has(a.id)
    );

    if (pool.length > 0) {
      const chosen = shuffleArray([...pool])[0];
      console.log('[AchievementEngine] Выдан значок:', chosen.code, `(${rarity}, осталось ${pool.length - 1})`);
      return chosen;
    }

    console.log('[AchievementEngine] Все значки редкости получены, fallback:', rarity);
  }

  // Все значки цепочки собраны
  console.log('[AchievementEngine] Все возможные значки уже получены для результата:', percentage);
  return null;
}

/**
 * Проверить и вернуть разблокированные достижения за условия
 *
 * ЛОГИКА ПРОВЕРКИ:
 * - Проверяются только достижения типа 'condition'
 * - Пропускаются уже разблокированные (из previouslyUnlocked)
 * - Проверяется выполнение условия (score/speed/count/special)
 * - Возвращается массив НОВЫХ разблокировок для этой попытки
 *
 * @param {Array} achievements - массив всех достижений
 * @param {object} attemptData - данные текущей попытки {percentage, durationMinutes, submittedAt}
 * @param {Array} allAttempts - все попытки студента (для подсчета количества)
 * @param {Array} previouslyUnlocked - ID уже разблокированных достижений (из unlocked_achievements)
 * @returns {Array} - массив новых разблокированных достижений
 */
export function checkUnlockedAchievements(
  achievements,
  attemptData,
  allAttempts,
  previouslyUnlocked = []
) {
  const unlocked = [];

  // Фильтровать только достижения за условия
  const conditionAchievements = achievements.filter((a) => a.type === 'condition');

  console.log('[AchievementEngine] Проверка условных достижений:', {
    totalConditions: conditionAchievements.length,
    alreadyUnlocked: previouslyUnlocked.length,
    attemptData,
    attemptsCount: allAttempts.length,
  });

  for (const achievement of conditionAchievements) {
    // Пропустить уже разблокированные
    if (previouslyUnlocked.includes(achievement.id)) {
      continue;
    }

    // Проверить условие
    if (isAchievementUnlocked(achievement, attemptData, allAttempts)) {
      unlocked.push(achievement);
      console.log('[AchievementEngine] Разблокировано достижение:', achievement.code, achievement.condition_type);
    }
  }

  console.log('[AchievementEngine] Новых разблокировок:', unlocked.length);
  return unlocked;
}

/**
 * Проверить, разблокировано ли конкретное достижение
 * @param {object} achievement - достижение для проверки
 * @param {object} attemptData - данные текущей попытки
 * @param {Array} allAttempts - все попытки студента
 * @returns {boolean} - true если условие выполнено
 */
function isAchievementUnlocked(achievement, attemptData, allAttempts) {
  const { condition_type, condition_value } = achievement;

  if (!condition_type || condition_value == null) {
    return false;
  }

  switch (condition_type) {
    case 'score': {
      // min — нижняя граница (включительно), max — верхняя граница (включительно)
      const pct = attemptData.percentage;
      if (condition_value.min !== undefined && pct < condition_value.min) return false;
      if (condition_value.max !== undefined && pct > condition_value.max) return false;
      return true;
    }

    case 'speed':
      // Время выполнения <= condition_value.max_minutes
      return attemptData.durationMinutes <= (condition_value.max_minutes || Infinity);

    case 'count':
      // Количество попыток >= condition_value.attempts
      // allAttempts уже включает текущую попытку
      return allAttempts.length >= (condition_value.attempts || 1);

    case 'streak': {
      // N попыток подряд с результатом >= min_score
      const minScore = condition_value.min_score ?? 100;
      const streakLen = condition_value.count ?? 3;
      if (attemptData.percentage < minScore) return false;
      // Предыдущие попытки с сохранённым процентом, отсортированные по дате
      const prev = allAttempts
        .filter((a) => typeof a.percentage === 'number')
        .sort((a, b) => new Date(a.created || 0) - new Date(b.created || 0));
      if (prev.length < streakLen - 1) return false;
      return prev.slice(-(streakLen - 1)).every((a) => a.percentage >= minScore);
    }

    case 'special':
      // Специальные условия (время суток, день недели и т.д.)
      return checkSpecialCondition(condition_value, attemptData);

    default:
      return false;
  }
}

/**
 * Проверить специальное условие (время суток, день недели)
 * @param {object} conditionValue - параметры условия
 * @param {object} attemptData - данные попытки
 * @returns {boolean}
 */
function checkSpecialCondition(conditionValue, attemptData) {
  const { submittedAt } = attemptData;

  if (!submittedAt) {
    return false;
  }

  const date = new Date(submittedAt);
  const toMinutes = (timeString) => {
    if (typeof timeString !== 'string') return null;
    const [hRaw, mRaw] = timeString.split(':');
    const h = Number(hRaw);
    const m = Number(mRaw);
    if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return h * 60 + m;
  };

  // Проверка времени суток
  if (conditionValue.time_after || conditionValue.time_before) {
    const currentMinutes = date.getHours() * 60 + date.getMinutes();
    const after = toMinutes(conditionValue.time_after);
    const before = toMinutes(conditionValue.time_before);

    if (after !== null && before !== null) {
      // Окно может пересекать полночь: например, 22:00-06:00
      const inWindow = after <= before
        ? currentMinutes >= after && currentMinutes <= before
        : currentMinutes >= after || currentMinutes <= before;
      if (!inWindow) return false;
    } else if (after !== null && currentMinutes < after) {
      return false;
    } else if (before !== null && currentMinutes > before) {
      return false;
    }
  }

  // Проверка дня недели (0 = воскресенье, 6 = суббота).
  // Если передан массив, достаточно совпадения с одним из дней.
  if (conditionValue.day_of_week !== undefined) {
    const day = date.getDay();
    if (Array.isArray(conditionValue.day_of_week)) {
      return conditionValue.day_of_week.includes(day);
    }
    return day === conditionValue.day_of_week;
  }

  return true;
}

/**
 * Собрать все ID уже разблокированных условных достижений из всех попыток студента
 *
 * ВАЖНО: Эта функция собирает только УСЛОВНЫЕ достижения (unlocked_achievements).
 * Случайные значки (achievement) обрабатываются отдельно в getRandomAchievement().
 *
 * @param {Array} attempts - все попытки студента
 * @returns {Array} - массив ID разблокированных условных достижений
 */
export function getPreviouslyUnlockedIds(attempts) {
  const ids = new Set();

  for (const attempt of attempts) {
    // unlocked_achievements - массив ID условных достижений
    if (attempt.unlocked_achievements && Array.isArray(attempt.unlocked_achievements)) {
      for (const id of attempt.unlocked_achievements) {
        ids.add(id);
      }
    }
  }

  const result = Array.from(ids);
  console.log('[AchievementEngine] Ранее разблокированных достижений:', result.length);
  return result;
}

/**
 * Собрать все ID ранее полученных случайных значков
 *
 * @param {Array} attempts - все попытки студента
 * @returns {Array} - массив ID полученных случайных значков
 */
export function getPreviouslyEarnedBadgeIds(attempts) {
  const ids = [];

  for (const attempt of attempts) {
    // achievement - единственный случайный значок за попытку
    if (attempt.achievement) {
      ids.push(attempt.achievement);
    }
  }

  console.log('[AchievementEngine] Ранее полученных значков:', ids.length);
  return ids;
}
