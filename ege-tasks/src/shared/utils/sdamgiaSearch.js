/**
 * Разбор строки поиска на предмет номера задачи с «Решу ЕГЭ/ОГЭ».
 *
 * Номер задачи хранится отдельным полем `tasks.sdamgia_id` (text) и в тексте
 * условия не встречается — обычный LIKE-поиск по statement_md его не найдёт.
 * Поэтому строку поиска смотрим отдельно: учитель копирует со страницы решу
 * либо голый номер (311151), либо подпись целиком («Задание 6 № 311151»),
 * либо ссылку (https://math-oge.sdamgia.ru/problem?id=311151).
 *
 * Возвращает { id, exact }:
 *   exact = true  — в строке явно указан номер (ссылка или «№ …»), искать
 *                   только по sdamgia_id: по тексту такое искать бессмысленно;
 *   exact = false — было просто число, к обычному поиску добавляем совпадение
 *                   по sdamgia_id как ещё один вариант (число могло быть и
 *                   куском условия).
 */

// Номера решу — минимум три цифры. Короткие числа («10», «5») это скорее
// номер задания в варианте, точный поиск по ним только мешал бы.
const MIN_ID_LENGTH = 3;

const RE_URL   = /[?&]id=(\d+)/;                 // …/problem?id=311151
const RE_LABEL = /(?:№|#)\s*(\d+)/;              // «Задание 6 № 311151»
const RE_BARE  = /^(\d+)$/;                      // 311151

export function parseSdamgiaSearch(query = '') {
  const q = String(query).trim();
  const none = { id: '', exact: false };
  if (!q) return none;

  for (const re of [RE_URL, RE_LABEL]) {
    const m = q.match(re);
    if (m && m[1].length >= MIN_ID_LENGTH) return { id: m[1], exact: true };
  }

  const bare = q.match(RE_BARE);
  if (bare && bare[1].length >= MIN_ID_LENGTH) return { id: bare[1], exact: false };

  return none;
}
