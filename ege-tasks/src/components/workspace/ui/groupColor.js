/**
 * Детерминированная привязка цвета к сущности (группа, предмет) из 5-палитры Hybrid.
 * Один и тот же ключ всегда даёт один и тот же оттенок — цвет становится «языком»
 * идентичности группы во всех экранах раздела (Сегодня, Календарь, Журнал, КТП…).
 */
export const GROUP_TONES = ['blue', 'teal', 'violet', 'amber', 'rose'];

// HEX-значения оттенков (дублируют CSS-переменные из tokens.css) — для мест,
// где нужен инлайн-цвет (react-big-calendar, бордюры событий и т.п.).
export const TONE_HEX = {
  blue:    { base: '#2B4BFF', soft: '#E7ECFF', ink: '#1A34D1' },
  teal:    { base: '#0D9488', soft: '#D1FAE5', ink: '#0B7A70' },
  violet:  { base: '#7C3AED', soft: '#EDE9FE', ink: '#6D28D9' },
  amber:   { base: '#D97706', soft: '#FEF3C7', ink: '#B45309' },
  rose:    { base: '#E11D48', soft: '#FFE4E6', ink: '#BE123C' },
  neutral: { base: '#646A76', soft: '#F3F4F6', ink: '#2A2F3A' },
};

// Стабильный хеш строки (FNV-подобный) → индекс палитры.
export function groupTone(key) {
  const s = String(key ?? '');
  if (!s) return 'blue';
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return GROUP_TONES[(h >>> 0) % GROUP_TONES.length];
}

// HEX-набор для группы по её id/имени.
export function groupHex(key) {
  return TONE_HEX[groupTone(key)];
}
