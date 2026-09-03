import React from 'react';
import { MathInline } from '../shared/MathInline';
import './OralCountingPrintLayout.css';

const LABELS = Array.from({ length: 30 }, (_, i) => String(i + 1));


// Чем заканчивается строка задания:
//   'eq'     — «=» (вычислите)
//   'var'    — «x =» (решите уравнение)
//   'answer' — «Ответ:» (решите неравенство — ответ не начинается с «x =»)
function resolvePrompt(promptMode, equationMode) {
  return promptMode || (equationMode ? 'var' : 'eq');
}

// ─── Одно задание ─────────────────────────────────────────────────────────────
function TaskRow({ q, qi, prompt }) {
  return (
    <div className="oral-task">
      <span className="oral-task-num">{LABELS[qi]})</span>
      <span className={prompt === 'eq' ? 'oral-task-expr' : 'oral-task-expr oral-task-expr--eq'}>
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

// ─── Страница ученика ─────────────────────────────────────────────────────────
function StudentPage({ variant, variantIndex, title, mode, columnsCount, prompt, instruction }) {
  const pageClass =
    mode === 'side' ? 'oral-page oral-page--side' :
    mode === 'half' ? 'oral-page oral-page--half' :
                      'oral-page oral-page--full';
  const gridClass = columnsCount === 2 ? 'oral-grid oral-grid--2col' : 'oral-grid oral-grid--1col';

  return (
    <div className={pageClass}>
      <div className="oral-header">
        <div className="oral-header-row1">
          <span className="oral-variant-badge">Вариант {variantIndex + 1}</span>
          <span className="oral-field oral-field--fio">ФИО: <span className="oral-line oral-line--name" /></span>
        </div>
        <div className="oral-header-row2">
          <span className="oral-field">Класс: <span className="oral-line oral-line--short" /></span>
          <span className="oral-field">Дата: <span className="oral-line oral-line--short" /></span>
        </div>
      </div>

      {title && <div className="oral-subtitle">{title}</div>}
      <div className="oral-instruction">
        {instruction || (prompt === 'eq' ? 'Вычислите:' : 'Решите уравнения:')}
      </div>

      <div className={gridClass}>
        {variant.map((q, qi) => (
          <TaskRow key={qi} q={q} qi={qi} prompt={prompt} />
        ))}
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

// ─── Корневой компонент ────────────────────────────────────────────────────────
export default function OralCountingPrintLayout({
  tasksData, settings, title,
  equationMode = false,
  promptMode,          // 'eq' | 'var' | 'answer' — чем кончается строка задания
  instruction,         // текст над списком заданий
  screenMode = false,
  fontSize = 's',
}) {
  if (!tasksData) return null;
  const { twoPerPage, sideBySide, showTeacherKey, columnsCount = 2 } = settings;
  const prompt = resolvePrompt(promptMode, equationMode);

  let pages;

  if (sideBySide) {
    pages = [];
    for (let i = 0; i < tasksData.length; i += 2) {
      const pair = tasksData.slice(i, i + 2);
      pages.push(
        <div key={i} className="oral-pair-page">
          {pair.map((variant, j) => (
            <StudentPage
              key={j}
              variant={variant}
              variantIndex={i + j}
              title={title}
              mode="side"
              columnsCount={1}
              prompt={prompt}
              instruction={instruction}
            />
          ))}
        </div>
      );
    }
  } else if (twoPerPage) {
    pages = [];
    for (let i = 0; i < tasksData.length; i += 2) {
      const pair = tasksData.slice(i, i + 2);
      pages.push(
        <div key={i} style={{ pageBreakAfter: 'always', breakAfter: 'page' }}>
          {pair.map((variant, j) => (
            <StudentPage
              key={j}
              variant={variant}
              variantIndex={i + j}
              title={title}
              mode="half"
              columnsCount={columnsCount}
              prompt={prompt}
              instruction={instruction}
            />
          ))}
        </div>
      );
    }
  } else {
    pages = tasksData.map((variant, vi) => (
      <StudentPage
        key={vi}
        variant={variant}
        variantIndex={vi}
        title={title}
        mode="full"
        columnsCount={columnsCount}
        prompt={prompt}
        instruction={instruction}
      />
    ));
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
      <div className={`oral-screen-root oral-screen-root--fs-${fontSize}`}>
        {inner}
      </div>
    );
  }

  return (
    <div className="oral-print-root" data-fs={fontSize}>
      {inner}
    </div>
  );
}
