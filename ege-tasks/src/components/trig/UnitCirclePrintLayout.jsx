import React from 'react';
import './UnitCirclePrintLayout.css';
import UnitCircleSVG from './UnitCircleSVG';
import { MathInline } from '../shared/MathInline';

// Один блок с окружностью + область ответов
function TaskBlock({ task, isAnswer, settings, taskNumber }) {
  const layoutClass = settings.circlesPerPage === 4 ? 'layout-4' : 'layout-2';
  const isDirect  = task.type === 'direct';
  const isInverse = task.type === 'inverse';

  const taskLabel = isDirect ? 'Подпишите точки:' : 'Отметьте точки на окружности:';

  return (
    <div className="ucw-task-block">
      <div className="ucw-task-label">{taskLabel}</div>

      {/* Окружность */}
      <div className={`ucw-circle-wrap ${layoutClass}`}>
        <UnitCircleSVG
          points={task.points}
          taskType={task.type}
          isAnswer={isAnswer}
          showAxes={settings.showAxes}
          showDegrees={settings.showDegrees}
          showTicks={settings.showTicks}
        />
      </div>

      {/* Область ответов / список углов */}
      <div className={`ucw-answer-area ${layoutClass}`}>
        {isDirect && (
          <>
            <div className="ucw-answer-grid">
              {task.points.map(p => (
                <div key={p.id} className="ucw-answer-item">
                  <span className="ucw-answer-num">{p.id}.</span>
                  {isAnswer
                    ? <span className="ucw-answer-value"><MathInline latex={p.display} /></span>
                    : <span className="ucw-answer-blank" />
                  }
                </div>
              ))}
            </div>
          </>
        )}

        {isInverse && (
          <>
            <div className="ucw-angle-list-label">Отметьте точки:</div>
            <div className="ucw-angle-grid">
              {task.points.map(p => (
                <div key={p.id} className="ucw-angle-item">
                  <b>{p.id}.</b> <MathInline latex={p.display} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Одна страница (один вариант)
function VariantPage({ variant, variantIndex, settings, isAnswer }) {
  const layoutClass = `layout-${settings.circlesPerPage}`;
  return (
    <div className="ucw-page">
      <div className="ucw-variant-header">
        <span className="ucw-variant-title">Вариант {variantIndex + 1}</span>
        {!isAnswer && (
          <span className="ucw-name-line">
            Имя: <span className="ucw-name-blank" />
          </span>
        )}
        {isAnswer && <span style={{ color: '#c41d7f', fontWeight: 'bold' }}>КЛЮЧ</span>}
      </div>

      <div className={`ucw-tasks-grid ${layoutClass}`}>
        {variant.map((task, ti) => (
          <TaskBlock
            key={ti}
            task={task}
            isAnswer={isAnswer}
            settings={settings}
            taskNumber={ti + 1}
          />
        ))}
      </div>
    </div>
  );
}

// ── Главный компонент ────────────────────────────────────────────────────────
export default function UnitCirclePrintLayout({ tasksData, settings, title }) {
  if (!tasksData) return null;

  return (
    <div className="unit-circle-print-root">
      {/* Страницы учеников */}
      {tasksData.map((variant, vi) => (
        <VariantPage
          key={vi}
          variant={variant}
          variantIndex={vi}
          settings={settings}
          isAnswer={false}
        />
      ))}

      {/* Страница ответов учителя */}
      {settings.showTeacherKey && (
        <>
          <div className="ucw-page">
            <div className="ucw-answer-page-title">
              Ответы учителя — {title}
            </div>
          </div>
          {tasksData.map((variant, vi) => (
            <VariantPage
              key={`answer-${vi}`}
              variant={variant}
              variantIndex={vi}
              settings={settings}
              isAnswer={true}
            />
          ))}
        </>
      )}
    </div>
  );
}
