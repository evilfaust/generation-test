/* Абзацы с врезной меткой («ИНСТРУКЦИЯ. текст…») */
function NoteSection({ label, text }) {
  const paras = String(text).split('\n').map(s => s.trim()).filter(Boolean);
  if (!paras.length) return null;
  return (
    <>
      {paras.map((p, i) => (
        <p key={i} className="ps-note-text">
          {i === 0 && label && <span className="ps-note-label">{label}. </span>}
          {p}
        </p>
      ))}
    </>
  );
}

const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
};

/**
 * Шапка первой страницы.
 *
 * mode='full' — контрольная работа: надзаголовок, название, метаданные, поля
 * ученика, блок инструкции (40–50 мм листа).
 * mode='compact' — лист задач: название и вариант одной строкой, поля ФИО и
 * даты — второй. Экономит ~30 мм, то есть 2–4 задачи на первой странице.
 */
export default function SheetHeader({
  meta, variantLabel, variantNumber, tasksCount, showVariant, mode = 'full',
}) {
  const compact = mode === 'compact';

  // Число заданий в метастроке отключается отдельно: на листе с длинными
  // условиями оно бессмысленно (задания и так пронумерованы), а место занимает.
  const showCount = meta.showTasksCount !== false;

  const metaParts = [
    meta.classLabel,
    meta.duration ? `${meta.duration} мин` : null,
    showCount && tasksCount
      ? `${tasksCount} ${plural(tasksCount, 'задание', 'задания', 'заданий')}`
      : null,
    meta.dateLabel,
  ].filter(Boolean);

  const fields = meta.showStudentFields && (
    <div className="ps-fields">
      <div className="ps-field ps-field--wide">
        <span className="ps-field-label">Фамилия, имя</span>
        <span className="ps-field-rule" />
      </div>
      {meta.showClassField !== false && (
        <div className="ps-field">
          <span className="ps-field-label">Класс</span>
          <span className="ps-field-rule" />
        </div>
      )}
      <div className="ps-field">
        <span className="ps-field-label">Дата</span>
        <span className="ps-field-rule" />
      </div>
    </div>
  );

  if (compact) {
    return (
      <header className="ps-head ps-head--compact">
        <div className="ps-head-row">
          <h1 className="ps-title">{meta.title}</h1>
          {showVariant && <div className="ps-variant">{variantLabel} {variantNumber}</div>}
        </div>
        {meta.subtitle && <div className="ps-subtitle">{meta.subtitle}</div>}
        {metaParts.length > 0 && (
          <div className="ps-meta">
            {metaParts.map((part, i) => (
              <span key={part}>
                {i > 0 && <span className="ps-meta-sep">·</span>}
                {part}
              </span>
            ))}
          </div>
        )}
        {fields}
      </header>
    );
  }

  return (
    <header className="ps-head">
      <div className="ps-head-row">
        <div className="ps-eyebrow">{meta.eyebrow}</div>
        {showVariant && (
          <div className="ps-variant">{variantLabel} {variantNumber}</div>
        )}
      </div>

      <h1 className="ps-title">{meta.title}</h1>
      {meta.subtitle && <div className="ps-subtitle">{meta.subtitle}</div>}

      {metaParts.length > 0 && (
        <div className="ps-meta">
          {metaParts.map((part, i) => (
            <span key={part}>
              {i > 0 && <span className="ps-meta-sep">·</span>}
              {part}
            </span>
          ))}
        </div>
      )}

      {fields}

      {(meta.instruction || meta.notes) && (
        <section className="ps-note">
          <NoteSection label="Инструкция" text={meta.instruction || ''} />
          {meta.instruction && meta.notes && <div className="ps-note-sep" />}
          <NoteSection label={meta.notesTitle} text={meta.notes || ''} />
        </section>
      )}
    </header>
  );
}
