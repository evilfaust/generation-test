import { Button, Tooltip, Segmented } from 'antd';
import { EditOutlined, SwapOutlined } from '@ant-design/icons';
import MathRenderer from '../MathRenderer';
import { filterTaskText } from '../../utils/filterTaskText';
import { api } from '../../services/pocketbase';
import { buildCryptogramForVariant } from '../../utils/cryptogram';
import {
  KIM_IMAGE_SIZE_OPTIONS,
  DEFAULT_KIM_IMAGE_SIZE,
  kimImageBoxStyle,
  kimImageImgStyle,
} from '../../utils/kimImageSize';

/**
 * Компонент рендеринга одного варианта (компактный и обычный режимы).
 *
 * @param {Object} variant - данные варианта { number, tasks }
 * @param {number} variantIndex - индекс варианта
 * @param {boolean} compactMode - компактный режим
 * @param {number} fontSize - размер шрифта (pt)
 * @param {number} columns - количество колонок
 * @param {boolean} showStudentInfo - показывать ФИО
 * @param {boolean} showAnswersInline - показывать ответы в тексте
 * @param {string} solutionSpace - место для решения (none/small/medium/large)
 * @param {string} variantLabel - название варианта
 * @param {boolean} hideTaskPrefixes - скрывать типовые фразы
 * @param {Object} dragDropHandlers - обработчики drag & drop из useTaskDragDrop
 * @param {Function} onEditTask - (task) => void
 * @param {Function} onReplaceTask - (variantIndex, taskIndex, task) => void
 * @param {boolean} cryptogramEnabled - включена ли шифровка
 * @param {string} cryptogramPhrase - слово/фраза для шифровки
 */
const VariantRenderer = ({
  variant,
  variantIndex,
  compactMode = false,
  fontSize = 12,
  columns = 1,
  showStudentInfo = true,
  showAnswersInline = false,
  solutionSpace = 'medium',
  variantLabel = 'Вариант',
  hideTaskPrefixes = false,
  dragDropHandlers,
  onEditTask,
  onReplaceTask,
  onSetImageSize,
  cryptogramEnabled = false,
  cryptogramPhrase = '',
}) => {
  const applyTextFilter = (text) => {
    if (!hideTaskPrefixes) return text;
    return filterTaskText(text);
  };

  const showCryptogram = cryptogramEnabled;
  const cryptogram = showCryptogram
    ? buildCryptogramForVariant({ variant, phrase: cryptogramPhrase })
    : null;
  const isCompactMode = compactMode;
  const effectiveColumns = columns;

  if (isCompactMode) {
    return (
      <div key={variant.number} className="variant-container compact-mode">
        <div className="variant-header-compact">
          <h2>
            {variantLabel} {variant.number}
          </h2>
        </div>

        <div className="tasks-content-compact" style={{ fontSize: `${fontSize}pt` }}>
          {variant.tasks.map((task, taskIndex) => {
            const isDragging = dragDropHandlers?.isDragging(variantIndex, taskIndex);
            const isDragOver = dragDropHandlers?.isDragOver(variantIndex, taskIndex);

            return (
              <div
                key={task.id}
                className={`task-item-compact ${isDragging ? 'dragging' : ''} ${
                  isDragOver ? 'drag-over' : ''
                }`}
                draggable
                onDragStart={e => dragDropHandlers?.handleDragStart(e, variantIndex, taskIndex)}
                onDragOver={e => dragDropHandlers?.handleDragOver(e, variantIndex, taskIndex)}
                onDragLeave={dragDropHandlers?.handleDragLeave}
                onDrop={e => dragDropHandlers?.handleDrop(e, variantIndex, taskIndex)}
                onDragEnd={dragDropHandlers?.handleDragEnd}
              >
                <div className="compact-answer-box"></div>
                <div className="compact-task-content">
                  <span className="compact-task-number">{taskIndex + 1}.</span>
                  <MathRenderer text={applyTextFilter(task.statement_md)} answerBoxes />
                </div>
                {/* Кнопки управления (только на экране) */}
                <div className="no-print compact-controls">
                  <Tooltip title="Редактировать задачу">
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => onEditTask?.(task)}
                    />
                  </Tooltip>
                  <Tooltip title="Заменить задачу">
                    <Button
                      type="text"
                      size="small"
                      icon={<SwapOutlined />}
                      onClick={() => onReplaceTask?.(variantIndex, taskIndex, task)}
                    />
                  </Tooltip>
                </div>
              </div>
            );
          })}
        </div>

        <div className="page-break"></div>
      </div>
    );
  }

  // Обычный режим
  return (
    <div key={variant.number} className="variant-container">
      <div className="variant-header">
        <div className="variant-header-row">
          <h2>
            {variantLabel} {variant.number}
          </h2>
          {showStudentInfo && (
            <div className="student-info student-info-inline">
              <div className="student-info-block">
                <span className="student-info-label">ФИО</span>
                <div className="student-info-box student-info-box-fio"></div>
              </div>
              <div className="student-info-block">
                <span className="student-info-label">Дата</span>
                <div className="student-info-box student-info-box-date"></div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        className="tasks-content"
        style={{
          fontSize: `${fontSize}pt`,
          columnCount: effectiveColumns,
          columnGap: '20px',
          columnRule: effectiveColumns > 1 ? '1px solid #ddd' : 'none',
        }}
      >
        {variant.tasks.map((task, taskIndex) => {
          const isDragging = dragDropHandlers?.isDragging(variantIndex, taskIndex);
          const isDragOver = dragDropHandlers?.isDragOver(variantIndex, taskIndex);
          const taskImageUrl = api.getTaskImageUrl(task);

          return (
            <div
              key={task.id}
              className={`task-item ${isDragging ? 'dragging' : ''} ${
                isDragOver ? 'drag-over' : ''
              }`}
              draggable
              onDragStart={e => dragDropHandlers?.handleDragStart(e, variantIndex, taskIndex)}
              onDragOver={e => dragDropHandlers?.handleDragOver(e, variantIndex, taskIndex)}
              onDragLeave={dragDropHandlers?.handleDragLeave}
              onDrop={e => dragDropHandlers?.handleDrop(e, variantIndex, taskIndex)}
              onDragEnd={dragDropHandlers?.handleDragEnd}
            >
              <div className="task-header">
                <span className="task-number">{taskIndex + 1}.</span>
                <span className="task-code">{task.code}</span>
                <div className="no-print" style={{ marginLeft: 'auto', display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {onSetImageSize && task.has_image && taskImageUrl && (
                    <Tooltip title="Размер чертежа в печати (КИМ)">
                      <Segmented
                        size="small"
                        options={KIM_IMAGE_SIZE_OPTIONS}
                        value={task.kimImageSize || DEFAULT_KIM_IMAGE_SIZE}
                        onChange={(val) => onSetImageSize(variantIndex, taskIndex, val)}
                      />
                    </Tooltip>
                  )}
                  <Tooltip title="Редактировать задачу">
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => onEditTask?.(task)}
                    />
                  </Tooltip>
                  <Tooltip title="Заменить задачу">
                    <Button
                      type="text"
                      size="small"
                      icon={<SwapOutlined />}
                      onClick={() => onReplaceTask?.(variantIndex, taskIndex, task)}
                    />
                  </Tooltip>
                </div>
                <div className="answer-box"></div>
              </div>

              <div className="task-content">
                <MathRenderer text={applyTextFilter(task.statement_md)} />

                {task.has_image && taskImageUrl && (
                  <div
                    className="task-image"
                    style={task.kimImageSize ? kimImageBoxStyle(task.kimImageSize) : undefined}
                  >
                    <img
                      src={taskImageUrl}
                      alt=""
                      style={task.kimImageSize ? kimImageImgStyle(task.kimImageSize) : undefined}
                    />
                  </div>
                )}
              </div>

              {showAnswersInline && task.answer && (
                <div className="task-answer">
                  <strong>Ответ:</strong> <MathRenderer text={task.answer} />
                </div>
              )}

              {!showAnswersInline && (
                <div className={`answer-space answer-space-${solutionSpace}`}>
                  {solutionSpace !== 'none' && 'Решение:'}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showCryptogram && (
        <div className="cryptogram-panel">
          <div className="cryptogram-panel-title">Шифровка по ответам</div>
          {cryptogram?.valid ? (
            <>
              <div className="cryptogram-panel-note">
                Решите задачи, найдите каждый ответ в таблице и запишите буквы по порядку.
              </div>

              <div className="cryptogram-table-grid">
                {cryptogram.entries.map((entry, index) => (
                  <div
                    key={`${entry.letter}-${entry.answer}-${index}`}
                    className={`cryptogram-table-entry ${entry.isDecoy ? 'cryptogram-table-entry-decoy' : ''}`}
                  >
                    <div className="cryptogram-table-answer">
                      <MathRenderer text={entry.answer} />
                    </div>
                    <div className="cryptogram-table-letter">{entry.letter}</div>
                  </div>
                ))}
              </div>

              <div className="cryptogram-result-block">
                <div className="cryptogram-result-label">Получившееся слово / фраза:</div>
                <div className="cryptogram-result-cells">
                  {cryptogram.answerCells.map((cell, index) => (
                    cell.type === 'space' ? (
                      <span key={`space-${index}`} className="cryptogram-result-gap" />
                    ) : (
                      <span key={`cell-${index}`} className="cryptogram-result-cell" />
                    )
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="cryptogram-warning">
              {cryptogram?.warnings?.join(' ')}
            </div>
          )}
        </div>
      )}

      <div className="page-break"></div>
    </div>
  );
};

export default VariantRenderer;
