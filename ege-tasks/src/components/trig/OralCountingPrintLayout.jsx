import React from 'react';
import { MathInline } from '../shared/MathInline';
import { sheetOptions, sheetSpacingStyle } from './sheetOptions';
import './OralCountingPrintLayout.css';

const LABELS = Array.from({ length: 30 }, (_, i) => String(i + 1));


// Чем заканчивается строка задания:
//   'eq'     — «=» (вычислите)
//   'var'    — «x =» (решите уравнение)
//   'answer' — «Ответ:» (решите неравенство — ответ не начинается с «x =»)
function resolvePrompt(promptMode, equationMode, showAnswerSpace = true) {
  if (!showAnswerSpace) return 'none';   // только условия — ученик пишет в тетради
  return promptMode || (equationMode ? 'var' : 'eq');
}

// ─── Одно задание ─────────────────────────────────────────────────────────────
function TaskRow({ q, qi, prompt }) {
  return (
    <div className="oral-task">
      <span className="oral-task-num">{LABELS[qi]})</span>
      <span className={prompt === 'eq' || prompt === 'none'
        ? 'oral-task-expr' : 'oral-task-expr oral-task-expr--eq'}>
        <MathInline latex={q.exprLatex} />
      </span>
      {prompt === 'var' && (
        <span className="oral-task-x-prompt">
          <MathInline latex={q.varLatex || 'x'} /> =
        </span>
      )}
      {prompt === 'answer' && <span className="oral-task-x-prompt">Ответ:</span>}
      {prompt === 'eq' && <span className="oral-task-eq">=</span>}
    </div>
  );
}

/**
 * Раскладывает задания варианта по плану листа: `layout` — массив элементов
 * `{ kind: 'task' | 'divider' }`. Он общий для всех вариантов (задание №5
 * везде одного типа), поэтому черта проходит через лист на одном и том же
 * месте. Без layout печатается обычный порядок.
 */
function renderTasks(variant, layout, prompt) {
  if (!layout || !layout.length) {
    return variant.map((q, qi) => <TaskRow key={qi} q={q} qi={qi} prompt={prompt} />);
  }

  let n = 0;
  return layout.map((item, i) => {
    if (item.kind === 'divider') {
      return <div key={`d${i}`} className="oral-divider" />;
    }
    const q = variant[item.idx];
    if (!q) return null;
    const qi = n++;
    return <TaskRow key={`t${i}`} q={q} qi={qi} prompt={prompt} />;
  });
}

// ─── Страница ученика ─────────────────────────────────────────────────────────
function StudentPage({ variant, variantIndex, title, mode, columnsCount, prompt, instruction, opts, layout }) {
  const pageClass =
    mode === 'side' ? 'oral-page oral-page--side' :
    mode === 'half' ? 'oral-page oral-page--half' :
    mode === 'quad' ? 'oral-page oral-page--quad' :
                      'oral-page oral-page--full';
  const gridClass = columnsCount === 2 ? 'oral-grid oral-grid--2col' : 'oral-grid oral-grid--1col';

  return (
    <div className={pageClass}>
      {opts.showHeader && (
        <div className="oral-header">
          <div className="oral-header-row1">
            <span className="oral-variant-badge">Вариант {variantIndex + 1}</span>
            <span className="oral-field oral-field--fio">ФИО: <span className="oral-line oral-line--name" /></span>
          </div>
          <div className="oral-header-row2">
            {opts.showClassField && (
              <span className="oral-field">Класс: <span className="oral-line oral-line--short" /></span>
            )}
            <span className="oral-field">Дата: <span className="oral-line oral-line--short" /></span>
          </div>
        </div>
      )}

      {opts.showTitle && title && <div className="oral-subtitle">{title}</div>}
      {opts.showInstruction && (
        <div className="oral-instruction">
          {instruction || (prompt === 'eq' ? 'Вычислите:' : 'Решите уравнения:')}
        </div>
      )}

      <div className={gridClass}>
        {renderTasks(variant, layout, prompt)}
      </div>
    </div>
  );
}

// ─── Страница ответов для учителя ─────────────────────────────────────────────
function TeacherKeyPage({ tasksData, title, prompt }) {
  return (
    <div className="oral-key-page">
      <div className="oral-key-header">{title} — Ответы (для учителя)</div>
      <div className="oral-key-variants">
        {tasksData.map((variant, vi) => (
          <div key={vi} className="oral-key-variant">
            <div className="oral-key-variant-title">Вариант {vi + 1}</div>
            <div className="oral-key-grid">
              {variant.map((q, qi) => (
                <div key={qi} className="oral-key-row">
                  <span className="oral-key-num">{LABELS[qi]})</span>
                  <span className="oral-key-expr">
                    <MathInline latex={q.exprLatex} />
                  </span>
                  <span className="oral-key-eq">
                    {prompt === 'var' && !q.hideKeyPrompt && (
                      <><MathInline latex={q.varLatex || 'x'} /> =</>
                    )}
                    {prompt === 'eq' && '='}
                  </span>
                  <span className="oral-key-ans">
                    <MathInline latex={`\\color{#c0392b}{${q.resultLatex}}`} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Сколько вариантов помещаем на лист: 1 · '2side' (рядом) · '2half' (верх/низ) · 4.
 * Новый ключ `variantsPerPage`; старые `sideBySide` / `twoPerPage` продолжают
 * работать — сохранённые настройки и смешанные работы их ещё используют.
 */
export function variantsPerPage(settings = {}) {
  const v = settings.variantsPerPage;
  if (v === 1 || v === 4 || v === '2side' || v === '2half') return v;
  if (settings.sideBySide) return '2side';
  if (settings.twoPerPage) return '2half';
  return 1;
}

// ─── Корневой компонент ────────────────────────────────────────────────────────
export default function OralCountingPrintLayout({
  tasksData, settings, title,
  equationMode = false,
  promptMode,          // 'eq' | 'var' | 'answer' — чем кончается строка задания
  instruction,         // текст над списком заданий
  layout,              // план листа: порядок заданий и разделители
  screenMode = false,
  fontSize = 's',
}) {
  if (!tasksData) return null;
  const { showTeacherKey, columnsCount = 2 } = settings;
  const opts = sheetOptions(settings);
  const prompt = resolvePrompt(promptMode, equationMode, opts.showAnswerSpace);
  const perPage = variantsPerPage(settings);

  const page = (variant, variantIndex, mode, cols) => (
    <StudentPage
      key={variantIndex}
      variant={variant}
      variantIndex={variantIndex}
      title={title}
      mode={mode}
      columnsCount={cols}
      prompt={prompt}
      instruction={instruction}
      opts={opts}
      layout={layout}
    />
  );

  // Группируем варианты по листам: 1, 2 рядом, 2 сверху-вниз или 4 в квадрате
  const chunk = (size) => {
    const out = [];
    for (let i = 0; i < tasksData.length; i += size) out.push([i, tasksData.slice(i, i + size)]);
    return out;
  };

  let pages;
  if (perPage === '2side') {
    pages = chunk(2).map(([i, pair]) => (
      <div key={i} className="oral-pair-page">
        {pair.map((v, j) => page(v, i + j, 'side', 1))}
      </div>
    ));
  } else if (perPage === '2half') {
    pages = chunk(2).map(([i, pair]) => (
      <div key={i} style={{ pageBreakAfter: 'always', breakAfter: 'page' }}>
        {pair.map((v, j) => page(v, i + j, 'half', columnsCount))}
      </div>
    ));
  } else if (perPage === 4) {
    pages = chunk(4).map(([i, quad]) => (
      <div key={i} className="oral-quad-page">
        {quad.map((v, j) => page(v, i + j, 'quad', 1))}
      </div>
    ));
  } else {
    pages = tasksData.map((v, vi) => page(v, vi, 'full', columnsCount));
  }

  const inner = (
    <>
      {pages}
      {showTeacherKey && (
        <TeacherKeyPage tasksData={tasksData} title={title} prompt={prompt} />
      )}
    </>
  );

  if (screenMode) {
    return (
      <div
        className={`oral-screen-root oral-screen-root--fs-${fontSize}`}
        style={sheetSpacingStyle(opts.lineSpacing)}
      >
        {inner}
      </div>
    );
  }

  return (
    <div className="oral-print-root" data-fs={fontSize} style={sheetSpacingStyle(opts.lineSpacing)}>
      {inner}
    </div>
  );
}
