import { useState, useRef, useMemo, useLayoutEffect, useEffect } from 'react';
import MathRenderer from '../MathRenderer';
import { api } from '../../services/pocketbase';
import { filterTaskText } from '../../utils/filterTaskText';
import { kimImageBoxStyle, kimImageImgStyle } from '../../utils/kimImageSize';
import { SOLUTION_SPACE_MM } from './presets';
import './EntranceTestPrint.css';

/* ── Геометрия листа A4 (мм) ────────────────────────────────────────────────
   Значения продублированы в EntranceTestPrint.css. Меняешь здесь — меняй там. */
export const PAGE_W_MM = 210;
export const PAGE_H_MM = 297;
const PAD_X_MM   = 14;
const PAD_TOP_MM = 12;
const PAD_BOT_MM = 8;
const HEAD_MM    = 9;    // «живой» колонтитул (стр. 2+): 5mm + 4mm отступа
const FOOT_MM    = 8;    // подвал на каждой странице
const SAFETY_MM  = 3;    // запас на округления печати
const TASK_GAP_MM = 7;   // зазор между задачами (3.5 margin + 3.5 padding)

export const BODY_W_MM = PAGE_W_MM - 2 * PAD_X_MM;          // 182

// Ёмкость страницы зависит от того, печатается ли подвал: без него задачам
// достаётся ещё 8 мм, и пагинация обязана это учесть.
const bodyRestMm  = (withFoot) =>
  PAGE_H_MM - PAD_TOP_MM - PAD_BOT_MM - HEAD_MM - (withFoot ? FOOT_MM : 0) - SAFETY_MM;
const bodyFirstMm = (withFoot) =>
  PAGE_H_MM - PAD_TOP_MM - PAD_BOT_MM - (withFoot ? FOOT_MM : 0) - SAFETY_MM;

const MM = 96 / 25.4;    // px на мм при 96dpi
const TASK_GAP_PX = TASK_GAP_MM * MM;

/* Колонка номера задачи: квадрат 6.5mm + зазор 3.5mm. */
const NUM_COL_MM = 10;

/**
 * Жадная пагинация: складывает задачи в страницы по измеренным высотам.
 * Задача, не влезающая на страницу целиком, начинает новую (а если не влезает
 * и в пустую — остаётся на ней одна).
 */
export function paginateByHeight(tasks, heights, firstCapPx, restCapPx, gapPx = TASK_GAP_PX) {
  if (!tasks.length) return [];
  const pages = [];
  let current = [];
  let used = 0;

  for (const task of tasks) {
    const h = heights.get(task.__key) || 0;
    const cap = pages.length === 0 ? firstCapPx : restCapPx;
    if (current.length > 0 && used + gapPx + h > cap) {
      pages.push(current);
      current = [];
      used = 0;
    }
    if (current.length > 0) used += gapPx;
    current.push(task);
    used += h;
  }
  if (current.length) pages.push(current);
  return pages;
}

/* ── Клетка / линейка в зоне решения ────────────────────────────────────────
   Число линий считаем ТОЧНО под размер блока (запас максимум +1): лишние
   абсолютные линии Chrome включает в расчёт печатной области и ужимает лист. */
function SolutionFill({ fill, heightMm, widthMm }) {
  if (fill === 'blank') return null;

  if (fill === 'lines') {
    const step = 8;
    const n = Math.max(0, Math.ceil(heightMm / step) - 1);
    return (
      <div className="et-fill" aria-hidden="true">
        {Array.from({ length: n }, (_, i) => (
          <div key={`l-${i}`} className="et-fill-h" style={{ top: `${(i + 1) * step}mm` }} />
        ))}
      </div>
    );
  }

  const h = Math.max(0, Math.ceil(heightMm / 5) - 1);
  const v = Math.max(0, Math.ceil(widthMm / 5) - 1);
  return (
    <div className="et-fill" aria-hidden="true">
      {Array.from({ length: h }, (_, i) => (
        <div key={`h-${i}`} className="et-fill-h" style={{ top: `${(i + 1) * 5}mm` }} />
      ))}
      {Array.from({ length: v }, (_, i) => (
        <div key={`v-${i}`} className="et-fill-v" style={{ left: `${(i + 1) * 5}mm` }} />
      ))}
    </div>
  );
}

/* ── Одна задача ────────────────────────────────────────────────────────────*/
function EntranceTask({ task, number, layout, options }) {
  const {
    answerLine = true,
    solutionSpace = 'm',
    solutionFill = 'grid',
    hideTaskPrefixes = false,
    showTaskCode = false,
  } = options;

  const raw = task.statement_md || '';
  const text = hideTaskPrefixes ? filterTaskText(raw) : raw;
  const imageUrl = task.has_image ? api.getTaskImageUrl(task) : null;

  const workbook = layout === 'workbook';
  const spaceMm = workbook ? (SOLUTION_SPACE_MM[solutionSpace] ?? SOLUTION_SPACE_MM.m) : 0;

  return (
    <article className="et-task">
      <div className="et-task-num">{number}</div>

      <div className="et-task-main">
        <div className="et-task-text">
          <MathRenderer text={text} />
          {imageUrl && (
            <div className="et-task-image" style={kimImageBoxStyle(task.kimImageSize)}>
              <img src={imageUrl} alt="" style={kimImageImgStyle(task.kimImageSize)} />
            </div>
          )}
          {showTaskCode && task.code && <div className="et-task-code">{task.code}</div>}
        </div>

        {workbook && spaceMm > 0 && (
          <div className="et-solution" style={{ height: `${spaceMm}mm` }}>
            <span className="et-solution-label">Решение</span>
            <SolutionFill
              fill={solutionFill}
              heightMm={spaceMm}
              widthMm={BODY_W_MM - NUM_COL_MM}
            />
          </div>
        )}

        {answerLine && (
          <div className="et-answer">
            <span className="et-answer-label">Ответ:</span>
            <span className="et-answer-rule" />
          </div>
        )}
      </div>
    </article>
  );
}

/* ── Абзацы с врезной меткой («ИНСТРУКЦИЯ. текст…») ─────────────────────────*/
function NoteSection({ label, text }) {
  const paras = String(text).split('\n').map(s => s.trim()).filter(Boolean);
  if (!paras.length) return null;
  return (
    <>
      {paras.map((p, i) => (
        <p key={i} className="et-note-text">
          {i === 0 && label && <span className="et-note-label">{label}. </span>}
          {p}
        </p>
      ))}
    </>
  );
}

/* ── Шапка первой страницы ──────────────────────────────────────────────────*/
const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
};

function SheetHeader({ meta, variantLabel, variantNumber, tasksCount, showVariant }) {
  const metaParts = [
    meta.classLabel,
    meta.duration ? `${meta.duration} мин` : null,
    tasksCount ? `${tasksCount} ${plural(tasksCount, 'задание', 'задания', 'заданий')}` : null,
    meta.dateLabel,
  ].filter(Boolean);

  return (
    <header className="et-head">
      <div className="et-head-row">
        <div className="et-eyebrow">{meta.eyebrow}</div>
        {showVariant && (
          <div className="et-variant">{variantLabel} {variantNumber}</div>
        )}
      </div>

      <h1 className="et-title">{meta.title}</h1>
      {meta.subtitle && <div className="et-subtitle">{meta.subtitle}</div>}

      {metaParts.length > 0 && (
        <div className="et-meta">
          {metaParts.map((part, i) => (
            <span key={part}>
              {i > 0 && <span className="et-meta-sep">·</span>}
              {part}
            </span>
          ))}
        </div>
      )}

      {meta.showStudentFields && (
        <div className="et-fields">
          <div className="et-field et-field--wide">
            <span className="et-field-label">Фамилия, имя</span>
            <span className="et-field-rule" />
          </div>
          <div className="et-field">
            <span className="et-field-label">Класс</span>
            <span className="et-field-rule" />
          </div>
          <div className="et-field">
            <span className="et-field-label">Дата</span>
            <span className="et-field-rule" />
          </div>
        </div>
      )}

      {(meta.instruction || meta.notes) && (
        <section className="et-note">
          <NoteSection label="Инструкция" text={meta.instruction || ''} />
          {meta.instruction && meta.notes && <div className="et-note-sep" />}
          <NoteSection label={meta.notesTitle} text={meta.notes || ''} />
        </section>
      )}
    </header>
  );
}

/* ── Страницы одного варианта ───────────────────────────────────────────────*/
function VariantPages({
  variant, meta, layout, options, variantLabel, showVariant, brand, pageOffset, onPageCount,
}) {
  const tasks = useMemo(
    () => (variant.tasks || []).map((t, i) => ({ ...t, __key: `${variant.number}-${i}-${t.id}`, __no: i + 1 })),
    [variant.tasks, variant.number]
  );

  const [pages, setPages] = useState(null);
  const [tick, setTick] = useState(0);
  const taskRefs = useRef({});
  const headRef = useRef(null);

  // Перемер при смене содержимого/настроек — в ключ входит ТЕКСТ, а не только id
  // (правка задачи не меняет id, но меняет высоту).
  const measureKey = useMemo(() => [
    layout, options.answerLine, options.solutionSpace, options.solutionFill,
    options.hideTaskPrefixes, options.showTaskCode, options.fontScale, options.fontFamily,
    options.showFooter,
    meta.instruction, meta.notes, meta.notesTitle, meta.title, meta.subtitle,
    meta.eyebrow, meta.classLabel, meta.dateLabel, meta.duration, meta.showStudentFields,
    tasks.map(t => `${t.__key}|${t.statement_md || ''}|${t.has_image ? 1 : 0}|${t.kimImageSize || 'm'}`).join('§'),
  ].join('¦'), [tasks, layout, options, meta]);

  // Шрифты KaTeX догружаются асинхронно — после готовности меряем заново.
  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts?.ready) return;
    let alive = true;
    document.fonts.ready.then(() => { if (alive) setTick(t => t + 1); });
    return () => { alive = false; };
  }, []);

  useLayoutEffect(() => {
    if (!tasks.length) { setPages([]); return; }
    const heights = new Map();
    tasks.forEach((t) => {
      const el = taskRefs.current[t.__key];
      if (el) heights.set(t.__key, el.offsetHeight);
    });
    const headPx = headRef.current?.offsetHeight || 0;
    const withFoot = options.showFooter !== false;
    const firstCap = Math.max(bodyFirstMm(withFoot) * MM - headPx, 40 * MM);
    setPages(paginateByHeight(tasks, heights, firstCap, bodyRestMm(withFoot) * MM));
  }, [measureKey, tick]);

  const list = pages || [];

  useEffect(() => { onPageCount?.(variant.number, list.length); }, [list.length, variant.number]);

  const header = (
    <SheetHeader
      meta={meta}
      variantLabel={variantLabel}
      variantNumber={variant.number}
      tasksCount={tasks.length}
      showVariant={showVariant}
    />
  );

  return (
    <>
      {/* Фаза измерения — вне экрана, ширина = ширине контентной зоны листа */}
      <div className="et-measure" aria-hidden="true">
        <div ref={headRef}>{header}</div>
        {tasks.map(t => (
          <div key={t.__key} ref={(el) => { taskRefs.current[t.__key] = el; }}>
            <EntranceTask task={t} number={t.__no} layout={layout} options={options} />
          </div>
        ))}
      </div>

      {list.map((pageTasks, i) => (
        <section className="et-page" key={`${variant.number}-p${i}`}>
          {i === 0 ? header : (
            <div className="et-runhead">
              <span>{meta.title}{meta.classLabel ? ` · ${meta.classLabel}` : ''}</span>
              {showVariant && <span>{variantLabel} {variant.number}</span>}
            </div>
          )}

          <div className="et-body">
            {pageTasks.map(t => (
              <EntranceTask
                key={t.__key}
                task={t}
                number={t.__no}
                layout={layout}
                options={options}
              />
            ))}
          </div>

          {options.showFooter !== false && (
            <div className="et-foot">
              <span>{meta.footerNote || brand}</span>
              <span>{pageOffset + i + 1}</span>
            </div>
          )}
        </section>
      ))}
    </>
  );
}

/* ── Лист ответов (для учителя) ─────────────────────────────────────────────*/
function AnswerKeyPage({ variants, variantLabel, meta, brand, pageNumber, showFooter }) {
  return (
    <section className="et-page et-page--key">
      <div className="et-runhead">
        <span>{meta.title}{meta.classLabel ? ` · ${meta.classLabel}` : ''}</span>
        <span>Для учителя</span>
      </div>

      <div className="et-body">
        <h2 className="et-key-title">Ответы</h2>
        {variants.map(v => (
          <div className="et-key-block" key={v.number}>
            <div className="et-key-variant">{variantLabel} {v.number}</div>
            <div className="et-key-grid">
              {(v.tasks || []).map((t, i) => (
                <div className="et-key-cell" key={t.id || i}>
                  <span className="et-key-num">{i + 1}</span>
                  <span className="et-key-answer">
                    {t.answer ? <MathRenderer text={t.answer} /> : <span className="et-key-dash">—</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showFooter && (
        <div className="et-foot">
          <span>{meta.footerNote || brand}</span>
          <span>{pageNumber}</span>
        </div>
      )}
    </section>
  );
}

/**
 * Печатный лист входной контрольной работы. Монохром — цвета нет намеренно
 * (лист живёт на ч/б принтере), иерархия держится кеглем и толщиной линеек.
 *
 * layout: 'sheet' — набор задач; 'workbook' — рабочая тетрадь (зона решения).
 */
export default function EntranceTestPrint({
  variants = [],
  meta = {},
  layout = 'sheet',
  options = {},
  variantLabel = 'Вариант',
  brand = 'Lemma',
  showAnswersPage = true,
}) {
  const [pageCounts, setPageCounts] = useState({});

  const opts = {
    answerLine: true,
    solutionSpace: 'm',
    solutionFill: 'grid',
    hideTaskPrefixes: false,
    showTaskCode: false,
    fontScale: 1,
    fontFamily: 'sans',
    showFooter: true,
    ...options,
  };

  const showVariant = variants.length > 1 || meta.alwaysShowVariant;

  const handlePageCount = (num, count) =>
    setPageCounts(prev => (prev[num] === count ? prev : { ...prev, [num]: count }));

  // Сквозная нумерация страниц по вариантам
  let offset = 0;
  const offsets = variants.map(v => {
    const at = offset;
    offset += pageCounts[v.number] || 1;
    return at;
  });

  if (!variants.length) return null;

  return (
    <div
      className={`et-root${opts.fontFamily === 'serif' ? ' et-root--serif' : ''}`}
      style={{ '--et-scale': opts.fontScale }}
    >
      {variants.map((v, i) => (
        <VariantPages
          key={v.number}
          variant={v}
          meta={meta}
          layout={layout}
          options={opts}
          variantLabel={variantLabel}
          showVariant={showVariant}
          brand={brand}
          pageOffset={offsets[i]}
          onPageCount={handlePageCount}
        />
      ))}

      {showAnswersPage && (
        <AnswerKeyPage
          variants={variants}
          variantLabel={variantLabel}
          meta={meta}
          brand={brand}
          pageNumber={offset + 1}
          showFooter={opts.showFooter}
        />
      )}
    </div>
  );
}
