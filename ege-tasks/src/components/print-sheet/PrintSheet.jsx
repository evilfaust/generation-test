import { useState, useRef, useMemo, useLayoutEffect, useEffect, Fragment } from 'react';
import SheetHeader from './SheetHeader';
import SheetTask from './SheetTask';
import AnswerKeyPage from './AnswerKeyPage';
import { figureSizeVars } from '../../utils/kimImageSize';
import {
  MM, TASK_GAP_PX, SOLUTION_GAP_MM, SOLUTION_SPACE_MM, COLUMN_GAP_MM,
  bodyFirstMm, bodyRestMm, bodyWidthMm, columnWidthMm, marginsOf,
  paginateByHeight, paginateFixedCount, paginateIntoColumns,
} from './geometry';
import './printSheet.css';

export { paginateByHeight, paginateFixedCount, paginateIntoColumns };

const DEFAULT_OPTIONS = {
  answerStyle: 'line',      // 'none' | 'line' | 'box'
  solutionSpace: 'none',    // 'none' | 's' | 'm' | 'l' | 'xl' | 'fit'
  solutionFill: 'grid',
  tasksPerPage: 6,          // для solutionSpace='fit'
  hideTaskPrefixes: false,
  showTaskCode: false,
  showAnswersInline: false,
  fontScale: 1,
  fontFamily: 'sans',
  showFooter: true,
  figureSize: 'm',          // общий размер чертежей: s | m | l | xl
  showFigures: true,
};

/* ── Страницы одного варианта ───────────────────────────────────────────────*/
function VariantPages({
  variant, variantIndex, meta, headerMode, layout, options, variantLabel,
  showVariant, brand, pageOffset, onPageCount, editing, tail, columns, margins,
}) {
  const tasks = useMemo(
    () => (variant.tasks || []).map((t, i) => ({
      ...t, __key: `${variant.number}-${i}-${t.id}`, __no: i + 1,
    })),
    [variant.tasks, variant.number]
  );

  const tailKey = `${variant.number}-tail`;
  const items = useMemo(
    () => (tail ? [...tasks, { __key: tailKey, __kind: 'tail' }] : tasks),
    [tasks, tail, tailKey]
  );

  // Зона решения: фиксированная (S/M/L/XL) или «N на лист» — тогда высоту
  // считает пагинация из остатка страницы.
  const workbook = layout === 'workbook';
  // «N на лист» — одноколоночный режим: в двух колонках «остаток высоты» делить
  // не на что (см. AppearanceSection — там пункт просто не показывается).
  const fitMode = workbook && options.solutionSpace === 'fit' && columns === 1;
  const fixedSolutionMm = workbook && !fitMode
    ? (SOLUTION_SPACE_MM[options.solutionSpace] ?? 0)
    : 0;

  const [pages, setPages] = useState(null);
  const [tick, setTick] = useState(0);
  const taskRefs = useRef({});
  const headRef = useRef(null);

  // Перемер при смене содержимого/настроек — в ключ входит ТЕКСТ, а не только id
  // (правка задачи не меняет id, но меняет высоту).
  const measureKey = useMemo(() => [
    layout, headerMode, columns, margins,
    options.answerStyle, options.solutionSpace, options.solutionFill,
    options.tasksPerPage, options.hideTaskPrefixes, options.showTaskCode,
    options.showAnswersInline, options.fontScale, options.fontFamily, options.showFooter,
    options.figureSize, options.showFigures,
    meta.instruction, meta.notes, meta.notesTitle, meta.title, meta.subtitle,
    meta.eyebrow, meta.classLabel, meta.dateLabel, meta.duration,
    meta.showStudentFields, meta.showClassField,
    tail ? '1' : '0',
    tasks.map(t => `${t.__key}|${t.statement_md || ''}|${t.answer || ''}|${t.has_image ? 1 : 0}|${t.kimImageSize || 'm'}`).join('§'),
  ].join('¦'), [tasks, layout, headerMode, options, meta, tail]);

  // Шрифты KaTeX догружаются асинхронно — после готовности меряем заново.
  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts?.ready) return undefined;
    let alive = true;
    document.fonts.ready.then(() => { if (alive) setTick(t => t + 1); });
    return () => { alive = false; };
  }, []);

  useLayoutEffect(() => {
    if (!tasks.length) { setPages([]); return; }

    const heights = new Map();
    items.forEach((it) => {
      const el = taskRefs.current[it.__key];
      if (el) heights.set(it.__key, el.offsetHeight);
    });

    const headPx = headRef.current?.offsetHeight || 0;
    const withFoot = options.showFooter !== false;
    const firstCap = Math.max(bodyFirstMm(withFoot, margins) * MM - headPx, 40 * MM);
    const restCap = bodyRestMm(withFoot, margins) * MM;

    if (fitMode) {
      const tailPx = tail ? (heights.get(tailKey) || 0) : 0;
      const raw = paginateFixedCount(
        tasks, heights, options.tasksPerPage, firstCap, restCap, TASK_GAP_PX, tailPx
      );
      if (tail && raw.length) raw[raw.length - 1].items = [...raw[raw.length - 1].items, { __key: tailKey, __kind: 'tail' }];
      setPages(raw.map(p => ({ columns: [p.items], solutionMm: p.solutionMm })));
      return;
    }

    // Зона решения меряется не в DOM, а прибавляется к измеренной высоте:
    // так в measure-зоне живёт одна «голая» задача на все режимы.
    const extraPx = fixedSolutionMm > 0 ? (fixedSolutionMm + SOLUTION_GAP_MM) * MM : 0;
    const withSolution = new Map();
    items.forEach((it) => {
      const h = heights.get(it.__key) || 0;
      withSolution.set(it.__key, it.__kind === 'tail' ? h : h + extraPx);
    });

    if (columns > 1) {
      setPages(
        paginateIntoColumns(items, withSolution, firstCap, restCap, TASK_GAP_PX, columns)
          .map(pageCols => ({ columns: pageCols, solutionMm: fixedSolutionMm }))
      );
      return;
    }

    setPages(
      paginateByHeight(items, withSolution, firstCap, restCap)
        .map(pageItems => ({ columns: [pageItems], solutionMm: fixedSolutionMm }))
    );
  }, [measureKey, tick]);

  // 🚨 Чертежи грузятся асинхронно. Пока <img> не загружен, его высота — 0
  // (kimImageImgStyle задаёт только max-height), и задача с чертежом меряется
  // на несколько сантиметров короче, чем будет. Пагинация набивает страницу
  // «лишними» задачами, после загрузки картинок хвост выезжает за лист.
  // Поэтому ждём каждую картинку и перемеряем.
  useEffect(() => {
    const pending = Object.values(taskRefs.current)
      .filter(Boolean)
      .flatMap(el => [...el.querySelectorAll('img')])
      .filter(img => !img.complete);
    if (!pending.length) return undefined;

    const bump = () => setTick(t => t + 1);
    pending.forEach(img => {
      img.addEventListener('load', bump);
      img.addEventListener('error', bump);
    });
    return () => pending.forEach(img => {
      img.removeEventListener('load', bump);
      img.removeEventListener('error', bump);
    });
  }, [measureKey, tick]);

  const list = pages || [];

  useEffect(() => { onPageCount?.(variant.number, list.length); }, [list.length, variant.number]);

  const header = (
    <SheetHeader
      meta={meta}
      mode={headerMode}
      variantLabel={variantLabel}
      variantNumber={variant.number}
      tasksCount={tasks.length}
      showVariant={showVariant}
    />
  );

  const colWidthMm = columnWidthMm(margins, columns);

  const renderItem = (item, solutionMm) => (
    item.__kind === 'tail'
      ? <Fragment key={item.__key}>{tail}</Fragment>
      : (
        <SheetTask
          key={item.__key}
          task={item}
          number={item.__no}
          taskIndex={item.__no - 1}
          options={options}
          solutionMm={solutionMm}
          contentWidthMm={colWidthMm}
          editing={editing ? { ...editing, variantIndex } : null}
        />
      )
  );

  return (
    <>
      {/* Фаза измерения — вне экрана. Шапка меряется шириной листа, задачи —
          шириной колонки, «голыми» (без зоны решения и без кнопок правки). */}
      <div className="ps-measure ps-measure--head" aria-hidden="true">
        <div ref={headRef}>{header}</div>
      </div>

      <div className="ps-measure" aria-hidden="true">
        {items.map(it => (
          <div key={it.__key} ref={(el) => { taskRefs.current[it.__key] = el; }}>
            {it.__kind === 'tail'
              ? tail
              : <SheetTask task={it} number={it.__no} taskIndex={it.__no - 1} options={options} />}
          </div>
        ))}
      </div>

      {list.map((page, i) => (
        <section className="ps-page" key={`${variant.number}-p${i}`}>
          {i === 0 ? header : (
            <div className="ps-runhead">
              <span>{meta.title}{meta.classLabel ? ` · ${meta.classLabel}` : ''}</span>
              {showVariant && <span>{variantLabel} {variant.number}</span>}
            </div>
          )}

          <div className={columns > 1 ? 'ps-body ps-body--cols' : 'ps-body'}>
            {columns > 1
              ? page.columns.map((colItems, ci) => (
                <div className="ps-col" key={`col-${ci}`}>
                  {colItems.map(item => renderItem(item, page.solutionMm))}
                </div>
              ))
              : (page.columns[0] || []).map(item => renderItem(item, page.solutionMm))}
          </div>

          {options.showFooter !== false && (
            <div className="ps-foot">
              <span>{meta.footerNote || brand}</span>
              <span>{pageOffset + i + 1}</span>
            </div>
          )}
        </section>
      ))}
    </>
  );
}

/**
 * Печатный лист A4 — общий движок «Входной контрольной» и «Листа задач».
 *
 * Монохром — цвета нет намеренно (лист живёт на ч/б принтере), иерархия
 * держится кеглем и толщиной линеек. Пагинация честная: задачи измеряются в
 * скрытой зоне той же ширины, что и лист, и раскладываются по страницам по
 * реальным высотам — с перемером после загрузки шрифтов KaTeX и чертежей.
 *
 * @param {Array} variants — [{ number, tasks: [...] }]
 * @param {Object} meta — шапка листа (заголовок, класс, инструкция, поля)
 * @param {'full'|'compact'} headerMode — полная шапка или строка-заголовок
 * @param {'sheet'|'workbook'} layout — 'workbook' включает зону решения
 * @param {Object} options — см. DEFAULT_OPTIONS
 * @param {Object} editing — правка на экране: { dragDropHandlers, onEditTask,
 *   onReplaceTask }; в печать не идёт
 * @param {Function} renderTail — (variant) => ReactNode, блок в конце варианта
 *   (шифровка); участвует в пагинации как обычный элемент
 * @param {number} columns — колонок на листе (1 или 2); раскладку считает
 *   пагинация, задачи меряются шириной колонки
 * @param {'normal'|'narrow'} margins — поля листа (см. MARGIN_PRESETS)
 */
export default function PrintSheet({
  variants = [],
  meta = {},
  headerMode = 'full',
  layout = 'sheet',
  options = {},
  variantLabel = 'Вариант',
  brand = 'Lemma',
  showAnswersPage = true,
  editing = null,
  renderTail = null,
  columns = 1,
  margins = 'normal',
}) {
  const [pageCounts, setPageCounts] = useState({});

  const opts = { ...DEFAULT_OPTIONS, ...options };
  // Обратная совместимость: входная контрольная передаёт answerLine.
  if (options.answerStyle === undefined && options.answerLine !== undefined) {
    opts.answerStyle = options.answerLine ? 'line' : 'none';
  }

  // Надпись «Вариант N» в шапке, колонтитуле и ключе. По умолчанию появляется
  // сама, когда вариантов больше одного; meta.showVariant (true/false) —
  // явное решение учителя и перебивает авто-режим в обе стороны.
  const showVariant = meta.showVariant != null
    ? !!meta.showVariant
    : (variants.length > 1 || !!meta.alwaysShowVariant);
  const cols = Math.max(1, Math.min(3, Math.floor(columns) || 1));

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

  // Геометрия листа и размер чертежей раздаются CSS-переменными: их должны
  // видеть и страницы, и measure-зона (она обязана быть шириной с колонку).
  const m = marginsOf(margins);
  const rootClass = [
    'ps-root',
    opts.fontFamily === 'serif' ? 'ps-root--serif' : '',
    opts.showFigures === false ? 'ps-root--nofig' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={rootClass}
      style={{
        '--ps-scale': opts.fontScale,
        '--ps-pad-x': `${m.x}mm`,
        '--ps-pad-top': `${m.top}mm`,
        '--ps-pad-bot': `${m.bottom}mm`,
        '--ps-col-gap': `${COLUMN_GAP_MM}mm`,
        '--ps-cols': cols,
        '--ps-body-w': `${bodyWidthMm(margins)}mm`,
        '--ps-measure-w': `${columnWidthMm(margins, cols)}mm`,
        ...figureSizeVars(opts.figureSize),
      }}
    >
      {variants.map((v, i) => (
        <VariantPages
          key={v.number}
          variant={v}
          variantIndex={i}
          meta={meta}
          headerMode={headerMode}
          layout={layout}
          options={opts}
          variantLabel={variantLabel}
          showVariant={showVariant}
          brand={brand}
          pageOffset={offsets[i]}
          onPageCount={handlePageCount}
          editing={editing}
          tail={renderTail ? renderTail(v) : null}
          columns={cols}
          margins={margins}
        />
      ))}

      {showAnswersPage && (
        <AnswerKeyPage
          variants={variants}
          variantLabel={variantLabel}
          // В ключе заголовок варианта скрываем только когда вариант один:
          // при нескольких без него не понять, чьи это ответы.
          showVariantTitle={showVariant || variants.length > 1}
          meta={meta}
          brand={brand}
          pageNumber={offset + 1}
          showFooter={opts.showFooter}
        />
      )}
    </div>
  );
}
