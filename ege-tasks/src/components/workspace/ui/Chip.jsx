/**
 * Чипы раздела «Моё пространство» — поверх класса .lemma-chip из tokens.css.
 * Единый визуальный язык статусов/групп вместо разрозненных <Tag color="…">.
 */
import { groupTone } from './groupColor';

/** Базовый чип. tone: blue|teal|violet|amber|rose|neutral. */
export function Chip({ tone = 'neutral', dot = true, children, style, title }) {
  const cls = `lemma-chip lemma-chip-${tone}${dot ? '' : ' lemma-chip--nodot'}`;
  return (
    <span className={cls} style={style} title={title}>
      {children}
    </span>
  );
}

/** Чип группы — цвет детерминирован по id/имени, единый во всём разделе. */
export function GroupChip({ id, name, dot = true, style }) {
  if (!name) return null;
  return (
    <Chip tone={groupTone(id || name)} dot={dot} style={style}>
      {name}
    </Chip>
  );
}

/* ── Статус урока ── */
const LESSON_TONE = { planned: 'blue', done: 'teal', cancelled: 'neutral' };
const LESSON_LABEL = { planned: 'запланирован', done: 'проведён', cancelled: 'отменён' };

export function LessonStatusChip({ status = 'planned', dot = true }) {
  return (
    <Chip tone={LESSON_TONE[status] || 'blue'} dot={dot}>
      {LESSON_LABEL[status] || status}
    </Chip>
  );
}

/* ── Статус сдачи (журнал: ученик × выдача) ── */
// kind: passed | late | failed | overdue | in_progress | none
const SUBMIT_TONE = {
  passed: 'teal',
  late: 'amber',
  failed: 'rose',
  overdue: 'rose',
  in_progress: 'blue',
  none: 'neutral',
};

export function SubmitChip({ kind = 'none', children, title, dot = true }) {
  return (
    <Chip tone={SUBMIT_TONE[kind] || 'neutral'} dot={dot} title={title}>
      {children}
    </Chip>
  );
}
