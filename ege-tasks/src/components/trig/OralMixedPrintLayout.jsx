import React from 'react';
import { MathInline } from '../shared/MathInline';
import { sheetOptions, sheetSpacingStyle } from './sheetOptions';
import './OralCountingPrintLayout.css';
import './OralMixedPrintLayout.css';

const LABELS = Array.from({ length: 60 }, (_, i) => String(i + 1));


// Чем кончается строка: 'eq' — «=», 'var' — «x =», 'answer' — «Ответ:»
const sectionPrompt = (sec, showAnswerSpace = true) => {
  if (!showAnswerSpace) return 'none';
  return sec.promptMode || (sec.equationMode ? 'var' : 'eq');
};

// Одно задание — поддерживает вычисления, уравнения и неравенства
function TaskRow({ q, qi, prompt }) {
  return (
    <div className="oral-task">
      <span className="oral-task-num">{LABELS[qi]})</span>
      <span className={`oral-task-expr${prompt === 'eq' || prompt === 'none' ? '' : ' oral-task-expr--eq'}`}>
        <MathInline latex={q.exprLatex} />
      </span>
      {prompt === 'var' && (
        <span className="oral-task-x-prompt"><MathInline latex={q.varLatex || 'x'} /> =</span>
      )}
      {prompt === 'answer' && <span className="oral-task-x-prompt">Ответ:</span>}
      {prompt === 'eq' && <span className="oral-task-eq">=</span>}
    </div>
  );
}

function VariantPage({ variant, title, mode, showSectionHeaders, columnsCount, opts }) {
  const pageClass =
    mode === 'side' ? 'oral-page oral-page--side' :
    mode === 'half' ? 'oral-page oral-page--half' :
                      'oral-page oral-page--full';

  let globalIdx = 0;

  return (
    <div className={pageClass}>
      {opts.showHeader && (
        <div className="oral-header">
          <div className="oral-header-row1">
            <span className="oral-variant-badge">Вариант {variant.number}</span>
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

      {variant.sections.map((sec, si) => (
        <div key={si} className="oral-mixed-section">
          {showSectionHeaders && <div className="oral-mixed-section-title">{sec.label}</div>}
          {opts.showInstruction && sec.instruction && (
            <div className="oral-instruction">{sec.instruction}</div>
          )}
          <div className={columnsCount === 2 ? 'oral-grid oral-grid--2col' : 'oral-grid oral-grid--1col'}>
            {sec.tasks.map((q, qi) => {
              const row = <TaskRow key={qi} q={q} qi={globalIdx} prompt={sectionPrompt(sec, opts.showAnswerSpace)} />;
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
                        <span className="oral-key-eq">
                          {sectionPrompt(sec) === 'var' && !q.hideKeyPrompt && (
                            <><MathInline latex={q.varLatex || 'x'} /> =</>
                          )}
                          {sectionPrompt(sec) === 'eq' && '='}
                        </span>
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
  const opts = sheetOptions(settings || {});

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
              opts={opts}
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
              opts={opts}
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
        opts={opts}
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
