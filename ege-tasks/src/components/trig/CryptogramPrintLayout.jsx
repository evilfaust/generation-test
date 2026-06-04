import React from 'react';
import './CryptogramPrintLayout.css';
import UnitCircleSVG from './UnitCircleSVG';
import { MathInline } from '../shared/MathInline';

// Один блок: Окружность + Таблица
function TaskBlock({ task, isAnswer, settings, taskNumber }) {
  const layoutClass = settings.circlesPerPage === 4 ? 'layout-4' : 'layout-2';

  return (
    <div className="crw-task-block">
      <div className="crw-task-label">Шифровка {taskNumber}</div>

      <div className="crw-task-content">
        {/* Окружность */}
        <div className={`crw-circle-wrap ${layoutClass}`}>
          <UnitCircleSVG
            taskType="cryptogram" // скрывает точки классические
            isAnswer={false} 
            showAxes={settings.showAxes}
            showDegrees={settings.showDegrees}
            showTicks={settings.showTicks}
            cipherMap={task.cipherMap}
          />
        </div>

        {/* Таблица */}
        <div className={`crw-table-wrap ${layoutClass}`}>
          <table className="crw-table">
            <thead>
              <tr>
                <th>Угол</th>
                <th>БУКВА</th>
              </tr>
            </thead>
            <tbody>
              {task.questions.map((q, i) => (
                <tr key={i}>
                  <td className="crw-td-angle">
                    <MathInline latex={q.display} />
                  </td>
                  <td className="crw-td-letter">
                    {isAnswer ? <span style={{ color: '#c41d7f', fontWeight: 'bold' }}>{q.letter}</span> : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {isAnswer && (
            <div style={{ marginTop: '5mm', fontSize: '10pt', fontWeight: 'bold', color: '#c41d7f' }}>
              Слово: {task.word}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Одна страница
function VariantPage({ variant, variantIndex, settings, isAnswer }) {
  const layoutClass = `layout-${settings.circlesPerPage}`;
  return (
    <div className="crw-page">
      <div className="crw-variant-header">
        <span className="crw-variant-title">Комплект {variantIndex + 1}</span>
        {!isAnswer && (
          <span className="crw-name-line">
            Класс: <span className="crw-name-blank" style={{ width: '20mm' }} />
            Имя: <span className="crw-name-blank" />
          </span>
        )}
        {isAnswer && <span style={{ color: '#c41d7f', fontWeight: 'bold' }}>КЛЮЧ</span>}
      </div>

      <div className={`crw-tasks-grid ${layoutClass}`}>
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

// Главный компонент
export default function CryptogramPrintLayout({ tasksData, settings, title }) {
  if (!tasksData) return null;

  return (
    <div className="cryptogram-print-root">
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
          <div className="crw-page">
            <div className="crw-answer-page-title">
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
