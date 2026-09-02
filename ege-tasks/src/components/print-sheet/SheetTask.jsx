import { Button, Tooltip, Segmented } from 'antd';
import { EditOutlined, SwapOutlined, HolderOutlined } from '@ant-design/icons';
import MathRenderer from '../MathRenderer';
import { api } from '../../services/pocketbase';
import { filterTaskText } from '../../utils/filterTaskText';
import { figureSizeVars, KIM_IMAGE_SIZE_OPTIONS } from '../../utils/kimImageSize';
import SolutionFill from './SolutionFill';
import { BODY_W_MM, NUM_COL_MM } from './geometry';

/**
 * Есть ли у задачи чертёж: внешняя картинка, картинка markdown или наш SVG.
 * У встроенных чертежей ДВЕ формы записи — блочная ```numline и inline
 * `numline: …` для ячеек таблиц (fenced в ячейке не работает), и вторая
 * встречается как раз в задачах «на каком рисунке изображено…».
 */
export const hasFigure = (task) => {
  const md = task.statement_md || '';
  return !!task.has_image
    || /!\[/.test(md)
    || /```\s*(numline|plot|vectors)\b/i.test(md)
    || /`\s*(numline|plot|vectors)\s*:/i.test(md);
};

/**
 * Одна задача печатного листа.
 *
 * @param {number} solutionMm — высота зоны решения (0 — зоны нет). Считается
 *   снаружи: в режиме «N на лист» она разная на разных страницах.
 * @param {Object} editing — правка на экране: { dragDropHandlers, onEditTask,
 *   onReplaceTask, variantIndex }. В зоне измерения не передаётся — кнопки
 *   позиционированы абсолютно и высоту не меняют, но лишний рендер ни к чему.
 */
export default function SheetTask({
  task, number, taskIndex, options, solutionMm = 0, editing, contentWidthMm = BODY_W_MM,
}) {
  const {
    answerStyle = 'line',
    solutionFill = 'grid',
    hideTaskPrefixes = false,
    showTaskCode = false,
    showAnswersInline = false,
  } = options;

  const raw = task.statement_md || '';
  const text = hideTaskPrefixes ? filterTaskText(raw) : raw;
  const imageUrl = task.has_image ? api.getTaskImageUrl(task) : null;

  const dnd = editing?.dragDropHandlers;
  const vi = editing?.variantIndex ?? 0;
  const dragging = dnd?.isDragging(vi, taskIndex);
  const dragOver = dnd?.isDragOver(vi, taskIndex);

  const statement = (
    <div className="ps-task-text">
      <MathRenderer text={text} />
      {imageUrl && (
        <div className="ps-task-image">
          <img src={imageUrl} alt="" />
        </div>
      )}
      {showTaskCode && task.code && <div className="ps-task-code">{task.code}</div>}
    </div>
  );

  // Готовый ответ под условием и пустое поле для ответа — взаимоисключающие.
  const showBox = answerStyle === 'box' && !showAnswersInline;

  const className = [
    'ps-task',
    editing ? 'ps-task--draggable' : '',
    dragging ? 'ps-task--dragging' : '',
    dragOver ? 'ps-task--dragover' : '',
  ].filter(Boolean).join(' ');

  // Личный размер чертежа задачи перебивает общий по листу (переменные листа
  // ставит PrintSheet на .ps-root).
  const figVars = task.kimImageSize ? figureSizeVars(task.kimImageSize) : undefined;

  return (
    <article
      className={className}
      style={figVars}
      draggable={!!dnd}
      onDragStart={dnd ? (e => dnd.handleDragStart(e, vi, taskIndex)) : undefined}
      onDragOver={dnd ? (e => dnd.handleDragOver(e, vi, taskIndex)) : undefined}
      onDragLeave={dnd ? dnd.handleDragLeave : undefined}
      onDrop={dnd ? (e => dnd.handleDrop(e, vi, taskIndex)) : undefined}
      onDragEnd={dnd ? dnd.handleDragEnd : undefined}
    >
      <div className="ps-task-num">{number}</div>

      <div className="ps-task-main">
        {showBox ? (
          <div className="ps-task-row">
            {statement}
            <div className="ps-answer-box" />
          </div>
        ) : statement}

        {showAnswersInline && task.answer && (
          <div className="ps-task-answer">
            <span className="ps-task-answer-label">Ответ:</span>
            <MathRenderer text={task.answer} />
          </div>
        )}

        {solutionMm > 0 && (
          <div className="ps-solution" style={{ height: `${solutionMm}mm` }}>
            <span className="ps-solution-label">Решение</span>
            <SolutionFill
              fill={solutionFill}
              heightMm={solutionMm}
              widthMm={contentWidthMm - NUM_COL_MM}
            />
          </div>
        )}

        {answerStyle === 'line' && !showAnswersInline && (
          <div className="ps-answer">
            <span className="ps-answer-label">Ответ:</span>
            <span className="ps-answer-rule" />
          </div>
        )}
      </div>

      {editing && (
        <div className="ps-task-controls no-print">
          {dnd && <HolderOutlined className="ps-task-grip" />}
          {editing.onSetFigureSize && hasFigure(task) && (
            <Tooltip title="Размер чертежа этой задачи (общий для листа — в «Оформлении»)">
              <Segmented
                size="small"
                options={KIM_IMAGE_SIZE_OPTIONS}
                value={task.kimImageSize || options.figureSize || 'm'}
                onChange={(val) => editing.onSetFigureSize(vi, taskIndex, val)}
              />
            </Tooltip>
          )}
          <Tooltip title="Редактировать задачу">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => editing.onEditTask?.(task)}
            />
          </Tooltip>
          <Tooltip title="Заменить задачу">
            <Button
              type="text"
              size="small"
              icon={<SwapOutlined />}
              onClick={() => editing.onReplaceTask?.(vi, taskIndex, task)}
            />
          </Tooltip>
        </div>
      )}
    </article>
  );
}
