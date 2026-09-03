import React from 'react';
import katex from 'katex';
import UnitCircleSVG from './UnitCircleSVG';
import { sheetOptions, sheetSpacingStyle } from './sheetOptions';
import './TrigMixedPrintLayout.css';

function MathLine({ latex }) {
  let html;
  try { html = katex.renderToString(latex, { throwOnError: false, displayMode: false }); }
  catch { html = latex; }
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function WorkSpace({ size }) {
  return <div className="tmixed-workspace" style={{ height: `${size}mm` }} />;
}

// ─── Одно задание (обычный или двухстрочный режим) ────────────────────────────
function RegularTaskRow({ q, globalIndex, questionMode, showWorkSpace, workSpaceSize }) {
  const label = `${globalIndex})`;
  const ws = showWorkSpace ? <WorkSpace size={workSpaceSize} /> : null;

  if (questionMode === 'twoLine') {
    return (
      <div className="tmixed-question tmixed-question--twoLine">
        <div className="tmixed-question-top">
          <span className="tmixed-q-label">{label}</span>
          <span className="tmixed-q-expr"><MathLine latex={q.exprLatex} /></span>
        </div>
        {ws}
      </div>
    );
  }

  return (
    <div className="tmixed-question">
      <div className="tmixed-question-top">
        <span className="tmixed-q-label">{label}</span>
        <span className="tmixed-q-expr"><MathLine latex={q.exprLatex} /></span>
        <span className="tmixed-q-equals">=</span>
        <span className="tmixed-q-answer-space" />
      </div>
      {ws}
    </div>
  );
}

// ─── Инструкция для единичной окружности ─────────────────────────────────────
function ucInstruction(taskType) {
  if (taskType === 'direct')  return 'Запишите угол для каждой отмеченной точки:';
  if (taskType === 'inverse') return 'Отметьте на окружности точки, соответствующие углам:';
  return 'Выполните задания с единичной окружностью:';
}

// ─── Секция одного генератора ─────────────────────────────────────────────────
function SectionBlock({ section, startIndex, showSectionHeaders, showWorkSpace, workSpaceSize, showInstruction = true, showAnswerSpace = true }) {
  const { label, instruction, tasks, ucSettings, twoColumns } = section;
  const questionMode = showAnswerSpace === false ? 'plain' : section.questionMode;

  const isUC = questionMode === 'unitcircle';
  const endIndex = startIndex + tasks.length - 1;

  // Инструкция с диапазоном номеров заданий
  const instructionText = instruction
    ? (tasks.length > 1
        ? `${startIndex}–${endIndex}. ${instruction}`
        : `${startIndex}. ${instruction}`)
    : null;

  return (
    <div className="tmixed-section">
      {showSectionHeaders && (
        <div className="tmixed-section-header">{label}</div>
      )}

      {isUC ? (
        <div className="tmixed-uc-tasks">
          {tasks.map((task, i) => {
            const isDirect  = task.type === 'direct';
            const isInverse = task.type === 'inverse';
            return (
              <div key={i} className="tmixed-uc-task">
                {/* Окружность */}
                <div className="tmixed-uc-circle-wrap">
                  <div className="tmixed-uc-task-num">{startIndex + i})</div>
                  <UnitCircleSVG
                    points={task.points}
                    taskType={task.type}
                    isAnswer={false}
                    showAxes={ucSettings?.showAxes ?? 'axes'}
                    showDegrees={ucSettings?.showDegrees ?? false}
                    showTicks={ucSettings?.showTicks ?? true}
                  />
                </div>

                {/* Область заданий/ответов справа */}
                <div className="tmixed-uc-points">
                  {isInverse && (
                    <>
                      <div className="tmixed-uc-points-label">Отметьте точки:</div>
                      <div className="tmixed-uc-angle-list">
                        {task.points.map(p => (
                          <span key={p.id} className="tmixed-uc-angle-item">
                            <span className="tmixed-uc-pt-num">{p.id}.</span>
                            <MathLine latex={p.display} />
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                  {isDirect && (
                    <>
                      <div className="tmixed-uc-points-label">Подпишите точки:</div>
                      <div className="tmixed-uc-answer-list">
                        {task.points.map(p => (
                          <span key={p.id} className="tmixed-uc-answer-item">
                            <span className="tmixed-uc-pt-num">{p.id}.</span>
                            <span className="tmixed-uc-answer-blank" />
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          {showInstruction && instructionText && (
            <div className="tmixed-instruction">{instructionText}</div>
          )}
          <div className={`tmixed-questions${twoColumns ? ' tmixed-questions--compact' : ''}`}>
            {tasks.map((q, i) => (
              <RegularTaskRow
                key={i}
                q={q}
                globalIndex={startIndex + i}
                questionMode={questionMode}
                showWorkSpace={showWorkSpace}
                workSpaceSize={workSpaceSize}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Одна страница варианта (ученик) ──────────────────────────────────────────
function VariantPage({ variant, title, settings, mode }) {
  const { showSectionHeaders, showWorkSpace, workSpaceSize } = settings;
  const opts = sheetOptions(settings);
  const pageClass = mode === 'half'
    ? 'tmixed-page tmixed-page--half'
    : 'tmixed-page';

  // Вычисляем стартовые индексы для каждой секции (сквозная нумерация)
  let cursor = 1;
  const sectionsWithStart = variant.sections.map(sec => {
    const start = cursor;
    cursor += sec.tasks.length;
    return { ...sec, startIndex: start };
  });

  return (
    <div className={pageClass}>
      {opts.showHeader && (
        <div className="tmixed-header">
          <span className="tmixed-variant-badge">Вариант {variant.number}</span>
          <span className={`tmixed-field tmixed-field--name`}>
            ФИО: <span className="tmixed-line tmixed-line--name" />
          </span>
          {opts.showClassField && (
            <span className="tmixed-field">
              Класс: <span className="tmixed-line tmixed-line--short" />
            </span>
          )}
          <span className="tmixed-field">
            Дата: <span className="tmixed-line tmixed-line--short" />
          </span>
        </div>
      )}

      {opts.showTitle && title && <div className="tmixed-work-title">{title}</div>}

      {sectionsWithStart.map((sec, si) => (
        <SectionBlock
          key={si}
          section={sec}
          startIndex={sec.startIndex}
          showSectionHeaders={showSectionHeaders}
          showWorkSpace={showWorkSpace}
          workSpaceSize={workSpaceSize}
          showInstruction={opts.showInstruction}
          showAnswerSpace={opts.showAnswerSpace}
        />
      ))}
    </div>
  );
}

// ─── Блок одного варианта в листе ответов ─────────────────────────────────────
function VariantKeyBlock({ variant }) {
  // Сквозная нумерация заданий внутри варианта
  let cursor = 1;
  const sectionsWithStart = variant.sections.map(sec => {
    const start = cursor;
    cursor += sec.tasks.length;
    return { ...sec, startIndex: start };
  });

  return (
    <div className="tmixed-key-variant-block">
      <div className="tmixed-key-variant-title">Вариант {variant.number}</div>

      {sectionsWithStart.map(sec => (
        <div key={sec.id} className="tmixed-key-section-inline">
          <div className="tmixed-key-section-inline-name">{sec.label}</div>

          {sec.questionMode === 'unitcircle' ? (
            <div className="tmixed-key-uc-grid">
              {sec.tasks.map((task, ti) => (
                <div key={ti} className="tmixed-key-uc-item">
                  <div className="tmixed-key-uc-label">{sec.startIndex + ti})</div>
                  <div style={{ width: '44mm', height: '44mm' }}>
                    <UnitCircleSVG
                      points={task.points}
                      taskType={task.type}
                      isAnswer={true}
                      showAxes={sec.ucSettings?.showAxes ?? 'axes'}
                      showDegrees={sec.ucSettings?.showDegrees ?? false}
                      showTicks={sec.ucSettings?.showTicks ?? true}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            sec.tasks.map((q, qi) => {
              const isEq = sec.questionMode === 'twoLine';
              return (
                <div
                  key={qi}
                  className={`tmixed-key-row${isEq ? ' tmixed-key-row--eq' : ''}`}
                >
                  <span className="tmixed-key-label">{sec.startIndex + qi})</span>
                  <span className="tmixed-key-expr">
                    <MathLine latex={q.exprLatex} />
                  </span>
                  <span className="tmixed-key-eq">{isEq ? 'x =' : '='}</span>
                  <span className="tmixed-key-ans">
                    <MathLine latex={`\\color{#c0392b}{${q.resultLatex}}`} />
                  </span>
                </div>
              );
            })
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Страница ответов для учителя ─────────────────────────────────────────────
function TeacherKeyPage({ variants, title }) {
  if (!variants.length) return null;

  // Разбиваем варианты на пары для двухколоночной вёрстки
  const pairs = [];
  for (let i = 0; i < variants.length; i += 2) {
    pairs.push(variants.slice(i, i + 2));
  }

  return (
    <div className="tmixed-key-page">
      <div className="tmixed-key-title">{title} — Ответы (для учителя)</div>

      {pairs.map((pair, pi) => (
        <div key={pi} className="tmixed-key-variants-grid">
          {pair.map(variant => (
            <VariantKeyBlock key={variant.number} variant={variant} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Корневой компонент ────────────────────────────────────────────────────────
export default function TrigMixedPrintLayout({ variants, title, settings }) {
  if (!variants || !variants.length) return null;

  const { twoPerPage, showTeacherKey } = settings;
  const rootOpts = sheetOptions(settings);

  let pages;
  if (twoPerPage) {
    pages = [];
    for (let i = 0; i < variants.length; i += 2) {
      const pair = variants.slice(i, i + 2);
      pages.push(
        <div key={i} style={{ pageBreakAfter: 'always', breakAfter: 'page' }}>
          {pair.map((variant, j) => (
            <VariantPage
              key={j}
              variant={variant}
              title={title}
              settings={settings}
              mode="half"
            />
          ))}
        </div>
      );
    }
  } else {
    pages = variants.map((variant, vi) => (
      <VariantPage
        key={vi}
        variant={variant}
        title={title}
        settings={settings}
        mode="full"
      />
    ));
  }

  return (
    <div className="tmixed-print-root" style={sheetSpacingStyle(rootOpts.lineSpacing)}>
      {pages}
      {showTeacherKey && (
        <TeacherKeyPage variants={variants} title={title} />
      )}
    </div>
  );
}
