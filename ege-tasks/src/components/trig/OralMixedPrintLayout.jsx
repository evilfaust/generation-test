import React from 'react';
import katex from 'katex';
import './OralCountingPrintLayout.css';
import './OralMixedPrintLayout.css';

const LABELS = Array.from({ length: 60 }, (_, i) => String(i + 1));

function MathInline({ latex }) {
  let html;
  try { html = katex.renderToString(latex, { throwOnError: false, displayMode: false }); }
  catch { html = latex; }
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

// Одно задание — поддерживает обычный режим и режим уравнений
function TaskRow({ q, qi, equationMode }) {
  return (
    <div className="oral-task">
      <span className="oral-task-num">{LABELS[qi]})</span>
      <span className={`oral-task-expr${equationMode ? ' oral-task-expr--eq' : ''}`}>
        <MathInline latex={q.exprLatex} />
      </span>
      {equationMode
        ? <span className="oral-task-x-prompt"><MathInline latex="x" /> =</span>
        : <span className="oral-task-eq">=</span>}
    </div>
  );
}

function VariantPage({ variant, title, mode, showSectionHeaders, columnsCount }) {
  const pageClass =
    mode === 'side' ? 'oral-page oral-page--side' :
    mode === 'half' ? 'oral-page oral-page--half' :
                      'oral-page oral-page--full';

  let globalIdx = 0;

  return (
    <div className={pageClass}>
      <div className="oral-header">
        <div className="oral-header-row1">
          <span className="oral-variant-badge">Вариант {variant.number}</span>
          <span className="oral-field oral-field--fio">ФИО: <span className="oral-line oral-line--name" /></span>
        </div>
        <div className="oral-header-row2">
          <span className="oral-field">Класс: <span className="oral-line oral-line--short" /></span>
          <span className="oral-field">Дата: <span className="oral-line oral-line--short" /></span>
        </div>
      </div>

      {title && <div className="oral-subtitle">{title}</div>}

      {variant.sections.map((sec, si) => (
        <div key={si} className="oral-mixed-section">
          {showSectionHeaders && <div className="oral-mixed-section-title">{sec.label}</div>}
          {sec.instruction && <div className="oral-instruction">{sec.instruction}</div>}
          <div className={columnsCount === 2 ? 'oral-grid oral-grid--2col' : 'oral-grid oral-grid--1col'}>
            {sec.tasks.map((q, qi) => {
              const row = <TaskRow key={qi} q={q} qi={globalIdx} equationMode={sec.equationMode} />;
              globalIdx++;
              return row;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function TeacherKeyPage({ variants, title }) {
  return (
    <div className="oral-key-page">
      <div className="oral-key-header">{title} — Ответы (для учителя)</div>
      <div className="oral-key-variants">
        {variants.map((v) => {
          let globalIdx = 0;
          return (
            <div key={v.number} className="oral-key-variant">
              <div className="oral-key-variant-title">Вариант {v.number}</div>
              <div className="oral-key-grid">
                {v.sections.flatMap((sec) =>
                  sec.tasks.map((q, qi) => {
                    const idx = globalIdx++;
                    return (
                      <div key={`${sec.id}-${qi}`} className="oral-key-row">
                        <span className="oral-key-num">{LABELS[idx]})</span>
                        <span className="oral-key-expr"><MathInline latex={q.exprLatex} /></span>
                        <span className="oral-key-eq">{sec.equationMode ? <><MathInline latex="x" /> =</> : '='}</span>
                        <span className="oral-key-ans">
                          <MathInline latex={`\\color{#c0392b}{${q.resultLatex}}`} />
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function OralMixedPrintLayout({
  variants, title, settings, screenMode = false, fontSize = 's',
}) {
  if (!variants || !variants.length) return null;
  const {
    twoPerPage = false,
    sideBySide = true,
    showTeacherKey = true,
    columnsCount = 2,
    showSectionHeaders = true,
  } = settings || {};

  let pages;

  if (sideBySide) {
    pages = [];
    for (let i = 0; i < variants.length; i += 2) {
      const pair = variants.slice(i, i + 2);
      pages.push(
        <div key={i} className="oral-pair-page">
          {pair.map((v) => (
            <VariantPage
              key={v.number}
              variant={v}
              title={title}
              mode="side"
              showSectionHeaders={showSectionHeaders}
              columnsCount={1}
            />
          ))}
        </div>
      );
    }
  } else if (twoPerPage) {
    pages = [];
    for (let i = 0; i < variants.length; i += 2) {
      const pair = variants.slice(i, i + 2);
      pages.push(
        <div key={i} style={{ pageBreakAfter: 'always', breakAfter: 'page' }}>
          {pair.map((v) => (
            <VariantPage
              key={v.number}
              variant={v}
              title={title}
              mode="half"
              showSectionHeaders={showSectionHeaders}
              columnsCount={columnsCount}
            />
          ))}
        </div>
      );
    }
  } else {
    pages = variants.map((v) => (
      <VariantPage
        key={v.number}
        variant={v}
        title={title}
        mode="full"
        showSectionHeaders={showSectionHeaders}
        columnsCount={columnsCount}
      />
    ));
  }

  const inner = (
    <>
      {pages}
      {showTeacherKey && <TeacherKeyPage variants={variants} title={title} />}
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
