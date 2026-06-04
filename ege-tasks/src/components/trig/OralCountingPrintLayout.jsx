import React from 'react';
import { MathInline } from '../shared/MathInline';
import './OralCountingPrintLayout.css';

const LABELS = Array.from({ length: 30 }, (_, i) => String(i + 1));


// ─── Одно задание ─────────────────────────────────────────────────────────────
function TaskRow({ q, qi, equationMode }) {
  return (
    <div className="oral-task">
      <span className="oral-task-num">{LABELS[qi]})</span>
      <span className={equationMode ? 'oral-task-expr oral-task-expr--eq' : 'oral-task-expr'}>
        <MathInline latex={q.exprLatex} />
      </span>
      {equationMode
        ? (
          <span className="oral-task-x-prompt">
            <MathInline latex="x" /> =
          </span>
        )
        : <span className="oral-task-eq">=</span>
      }
    </div>
  );
}

// ─── Страница ученика ─────────────────────────────────────────────────────────
function StudentPage({ variant, variantIndex, title, mode, columnsCount, equationMode }) {
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
        {equationMode ? 'Решите уравнения:' : 'Вычислите:'}
      </div>

      <div className={gridClass}>
        {variant.map((q, qi) => (
          <TaskRow key={qi} q={q} qi={qi} equationMode={equationMode} />
        ))}
      </div>
    </div>
  );
}

// ─── Страница ответов для учителя ─────────────────────────────────────────────
function TeacherKeyPage({ tasksData, title, equationMode }) {
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
                  <span className="oral-key-eq">{equationMode ? 'x =' : '='}</span>
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
  screenMode = false,
  fontSize = 's',
}) {
  if (!tasksData) return null;
  const { twoPerPage, sideBySide, showTeacherKey, columnsCount = 2 } = settings;

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
              equationMode={equationMode}
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
              equationMode={equationMode}
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
        equationMode={equationMode}
      />
    ));
  }

  const inner = (
    <>
      {pages}
      {showTeacherKey && (
        <TeacherKeyPage tasksData={tasksData} title={title} equationMode={equationMode} />
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
