import React from 'react';
import katex from 'katex';
import TrigValuesSVG from './TrigValuesSVG';
import { sheetOptions } from './sheetOptions';
import './TrigValuesPrintLayout.css';

function MathCell({ latex }) {
  if (!latex) return null;
  let html;
  try { html = katex.renderToString(latex, { throwOnError: false, displayMode: false }); }
  catch { html = latex; }
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

// ─── Таблица значений для одного варианта ───────────────────────────────────
function TrigTable({ points, showSin, showCos, showTan, showCot, isAnswer }) {
  const cols = [
    showSin && { key: 'sin', head: '\\sin\\,\\alpha' },
    showCos && { key: 'cos', head: '\\cos\\,\\alpha' },
    showTan && { key: 'tan', head: '\\text{tg}\\,\\alpha' },
    showCot && { key: 'cot', head: '\\text{ctg}\\,\\alpha' },
  ].filter(Boolean);

  return (
    <table className="tvg-table">
      <thead>
        <tr>
          <th className="tvg-th tvg-col-num">№</th>
          <th className="tvg-th tvg-col-angle"><MathCell latex="\\alpha" /></th>
          {cols.map(c => (
            <th key={c.key} className="tvg-th tvg-col-val">
              <MathCell latex={c.head} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {points.map(p => (
          <tr key={p.id} className="tvg-tr">
            <td className="tvg-td tvg-col-num">{p.id}</td>
            <td className="tvg-td tvg-col-angle">
              <MathCell latex={p.angleDisplayCompact || p.angleDisplay} />
            </td>
            {cols.map(c => {
              const undef = (c.key === 'tan' && p.tanUndef) || (c.key === 'cot' && p.cotUndef);
              const val = p[c.key];
              return (
                <td key={c.key} className={`tvg-td tvg-col-val${isAnswer ? ' tvg-answer' : ''}`}>
                  {isAnswer
                    ? (undef || val === null
                        ? <span className="tvg-undef">—</span>
                        : <MathCell latex={`\\color{#c0392b}{${val}}`} />)
                    : null}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Одна страница ученика ───────────────────────────────────────────────────
function StudentPage({ variant, variantIndex, settings, title }) {
  const { showSin, showCos, showTan, showCot, showHelperLines, showAngleLabels } = settings;
  const opts = sheetOptions(settings);

  return (
    <div className={`tvg-page tvg-page--${settings.layout}`}>
      {/* Шапка */}
      {(opts.showTitle || opts.showHeader) && (
        <div className="tvg-page-header">
          {opts.showTitle && <div className="tvg-page-title">{title}</div>}
          {opts.showHeader && (
            <div className="tvg-page-meta">
              <span className="tvg-variant-badge">Вариант {variantIndex + 1}</span>
              <span className="tvg-field">ФИО: <span className="tvg-line tvg-line--long" /></span>
              {opts.showClassField && (
                <span className="tvg-field">Класс: <span className="tvg-line tvg-line--short" /></span>
              )}
              <span className="tvg-field">Дата: <span className="tvg-line tvg-line--short" /></span>
            </div>
          )}
        </div>
      )}

      {/* Контент: окружность + таблица */}
      <div className="tvg-page-body">
        <div className="tvg-circle-area">
          <TrigValuesSVG
            points={variant}
            showHelperLines={showHelperLines}
            showAngleLabels={showAngleLabels}
          />
        </div>
        <div className="tvg-table-area">
          <TrigTable
            points={variant}
            showSin={showSin} showCos={showCos}
            showTan={showTan} showCot={showCot}
            isAnswer={false}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Страница(ы) ответов учителя ─────────────────────────────────────────────
function TeacherKeyPage({ tasksData, settings, title }) {
  const { showSin, showCos, showTan, showCot } = settings;
  const cols = [
    showSin && 'sin', showCos && 'cos', showTan && 'tan', showCot && 'cot',
  ].filter(Boolean);

  const heads = { sin: '\\sin', cos: '\\cos', tan: '\\text{tg}', cot: '\\text{ctg}' };

  // Все варианты выводим компактно на одной (или нескольких) страницах
  return (
    <div className="tvg-page tvg-key-page">
      <div className="tvg-key-header">
        <strong>{title}</strong> — Ответы (для учителя)
      </div>

      <div className="tvg-key-grid">
        {tasksData.map((variant, vi) => (
          <div key={vi} className="tvg-key-variant">
            <div className="tvg-key-variant-title">Вариант {vi + 1}</div>
            <table className="tvg-table tvg-table--key">
              <thead>
                <tr>
                  <th className="tvg-th tvg-col-num">№</th>
                  <th className="tvg-th tvg-col-angle"><MathCell latex="\\alpha" /></th>
                  {cols.map(c => (
                    <th key={c} className="tvg-th tvg-col-val">
                      <MathCell latex={`${heads[c]}\\,\\alpha`} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {variant.map(p => (
                  <tr key={p.id} className="tvg-tr">
                    <td className="tvg-td tvg-col-num">{p.id}</td>
                    <td className="tvg-td tvg-col-angle">
                      <MathCell latex={p.angleDisplayCompact || p.angleDisplay} />
                    </td>
                    {cols.map(c => {
                      const undef = (c === 'tan' && p.tanUndef) || (c === 'cot' && p.cotUndef);
                      return (
                        <td key={c} className="tvg-td tvg-col-val tvg-answer">
                          {undef || p[c] === null
                            ? <span className="tvg-undef">—</span>
                            : <MathCell latex={`\\color{#c0392b}{${p[c]}}`} />}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Корневой компонент вёрстки ──────────────────────────────────────────────
export default function TrigValuesPrintLayout({ tasksData, settings, title }) {
  if (!tasksData) return null;

  return (
    <div className="tvg-print-root">
      {/* Страницы учеников */}
      {tasksData.map((variant, vi) => (
        <StudentPage
          key={vi}
          variant={variant}
          variantIndex={vi}
          settings={settings}
          title={title}
        />
      ))}

      {/* Страница ответов */}
      {settings.showTeacherKey && (
        <TeacherKeyPage
          tasksData={tasksData}
          settings={settings}
          title={title}
        />
      )}
    </div>
  );
}
