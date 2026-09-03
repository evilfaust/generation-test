import React from 'react';
import katex from 'katex';
import { sheetOptions, sheetSpacingStyle } from './sheetOptions';
import './TrigExprPrintLayout.css';

const LABELS = Array.from({ length: 20 }, (_, i) => String(i + 1));

function MathLine({ latex }) {
  let html;
  try { html = katex.renderToString(latex, { throwOnError: false, displayMode: false }); }
  catch { html = latex; }
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

// ─── Одна строка задания ───────────────────────────────────────────────────────
// questionMode:
//   'inline'  — задание + "=" + пустое место (по умолчанию)
//   'twoLine' — задание на первой строке, "t = ___" на второй (для уравнений)
//   'plain'   — только задание, без поля для ответа (для уравнений без строки ответа)
function WorkSpace({ size }) {
  return <div className="texpr-workspace" style={{ height: `${size}mm` }} />;
}

function QuestionRow({ q, qi, questionMode, showWorkSpace, workSpaceSize }) {
  const ws = showWorkSpace ? <WorkSpace size={workSpaceSize} /> : null;

  if (questionMode === 'twoLine') {
    return (
      <div className="texpr-question texpr-question--twoLine">
        <div className="texpr-question-top">
          <span className="texpr-q-label">{LABELS[qi]})</span>
          <span className="texpr-q-expr"><MathLine latex={q.exprLatex} /></span>
        </div>
        <div className="texpr-question-answer">
          <span className="texpr-q-answer-label">t =</span>
          <span className="texpr-q-answer-line" />
        </div>
        {ws}
      </div>
    );
  }
  if (questionMode === 'plain') {
    return (
      <div className="texpr-question texpr-question--plain">
        <div className="texpr-question-top">
          <span className="texpr-q-label">{LABELS[qi]})</span>
          <span className="texpr-q-expr"><MathLine latex={q.exprLatex} /></span>
        </div>
        {ws}
      </div>
    );
  }
  return (
    <div className="texpr-question">
      <div className="texpr-question-top">
        <span className="texpr-q-label">{LABELS[qi]})</span>
        <span className="texpr-q-expr"><MathLine latex={q.exprLatex} /></span>
        <span className="texpr-q-equals">=</span>
        <span className="texpr-q-answer-space" />
      </div>
      {ws}
    </div>
  );
}

// ─── Одна страница ученика ────────────────────────────────────────────────────
function StudentPage({ variant, variantIndex, title, mode, instruction, questionMode, showWorkSpace, workSpaceSize, opts }) {
  const pageClass = mode === 'half' ? 'texpr-page texpr-page--half' : 'texpr-page texpr-page--full';

  return (
    <div className={pageClass}>
      {opts.showHeader && (
        <div className="texpr-header">
          <span className="texpr-variant-badge">Вариант {variantIndex + 1}</span>
          <span className="texpr-field">ФИО: <span className="texpr-line texpr-line--name" /></span>
          {opts.showClassField && (
            <span className="texpr-field">Класс: <span className="texpr-line texpr-line--short" /></span>
          )}
          <span className="texpr-field">Дата: <span className="texpr-line texpr-line--short" /></span>
        </div>
      )}
      {opts.showTitle && <div className="texpr-subtitle">{title}</div>}

      {opts.showInstruction && (
        <div className="texpr-instruction">{instruction || 'Вычислите:'}</div>
      )}

      <div className="texpr-questions">
        {variant.map((q, qi) => (
          <QuestionRow key={qi} q={q} qi={qi} questionMode={questionMode}
            showWorkSpace={showWorkSpace} workSpaceSize={workSpaceSize} />
        ))}
      </div>
    </div>
  );
}

// ─── Страница ответов для учителя ─────────────────────────────────────────────
function TeacherKeyPage({ tasksData, title, questionMode }) {
  return (
    <div className="texpr-page texpr-key-page">
      <div className="texpr-key-header">{title} — Ответы (для учителя)</div>
      <div className="texpr-key-grid">
        {tasksData.map((variant, vi) => (
          <div key={vi} className="texpr-key-variant">
            <div className="texpr-key-variant-title">Вариант {vi + 1}</div>
            {variant.map((q, qi) => (
              <div key={qi} className={`texpr-key-row${questionMode === 'twoLine' ? ' texpr-key-row--eq' : ''}`}>
                <span className="texpr-key-label">{LABELS[qi]})</span>
                <span className="texpr-key-expr">
                  <MathLine latex={q.exprLatex} />
                </span>
                <span className="texpr-key-eq">{questionMode === 'twoLine' ? 't =' : '='}</span>
                <span className="texpr-key-ans">
                  <MathLine latex={`\\color{#c0392b}{${q.resultLatex}}`} />
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Корневой компонент ────────────────────────────────────────────────────────
export default function TrigExprPrintLayout({
  tasksData, settings, title,
  instruction,        // текст инструкции ("Вычислите:", "Решите уравнение:" и т.д.)
  questionMode,       // 'inline' | 'twoLine' | 'plain'
}) {
  if (!tasksData) return null;
  const { twoPerPage, showTeacherKey, showWorkSpace = false, workSpaceSize = 25 } = settings;
  const opts = sheetOptions(settings);
  // Без места для ответа печатаем только условия — ученик решает в тетради
  const qMode = opts.showAnswerSpace === false ? 'plain' : (questionMode || 'inline');

  let pages;
  if (twoPerPage) {
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
              instruction={instruction}
              questionMode={qMode}
              showWorkSpace={showWorkSpace}
              workSpaceSize={workSpaceSize}
              opts={opts}
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
        instruction={instruction}
        questionMode={qMode}
        showWorkSpace={showWorkSpace}
        workSpaceSize={workSpaceSize}
        opts={opts}
      />
    ));
  }

  return (
    <div className="texpr-print-root" style={sheetSpacingStyle(opts.lineSpacing)}>
      {pages}
      {showTeacherKey && (
        <TeacherKeyPage tasksData={tasksData} title={title} questionMode={qMode} />
      )}
    </div>
  );
}
