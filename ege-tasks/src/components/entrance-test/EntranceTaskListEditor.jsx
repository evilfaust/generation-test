import { Button, Tooltip, Card, Segmented } from 'antd';
import { EditOutlined, SwapOutlined, ArrowUpOutlined, ArrowDownOutlined, PictureOutlined } from '@ant-design/icons';
import MathRenderer from '../MathRenderer';
import { KIM_IMAGE_SIZE_OPTIONS, DEFAULT_KIM_IMAGE_SIZE } from '../../utils/kimImageSize';

/**
 * Экранный редактор состава работы: компактный список задач по вариантам
 * с кнопками правки, замены и перестановки. Печатный лист (EntranceTestPrint)
 * остаётся чистым WYSIWYG — кнопок в нём нет.
 */
export default function EntranceTaskListEditor({
  variants = [],
  variantLabel = 'Вариант',
  onEditTask,
  onReplaceTask,
  onMove,
  onSetImageSize,
}) {
  if (!variants.length) return null;

  return (
    <div style={{ marginTop: 20, display: 'grid', gap: 12 }}>
      {variants.map((variant, variantIndex) => (
        <Card
          key={variant.number}
          size="small"
          title={`${variantLabel} ${variant.number} · ${variant.tasks.length} задач`}
          styles={{ body: { padding: 0 } }}
        >
          {variant.tasks.map((task, taskIndex) => (
            <div
              key={task.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '8px 12px',
                borderTop: taskIndex === 0 ? 'none' : '1px solid var(--rule-soft)',
              }}
            >
              <span
                style={{
                  flex: '0 0 22px',
                  height: 22,
                  borderRadius: 6,
                  background: 'var(--accent-soft)',
                  color: 'var(--accent-ink)',
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {taskIndex + 1}
              </span>

              <div style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.45, overflow: 'hidden' }}>
                <MathRenderer text={task.statement_md} />
              </div>

              <div style={{ display: 'flex', gap: 2, flexShrink: 0, alignItems: 'center' }}>
                {onSetImageSize && task.has_image && (
                  <Tooltip title="Размер чертежа на листе">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 4 }}>
                      <PictureOutlined style={{ color: 'var(--ink-4)', fontSize: 12 }} />
                      <Segmented
                        size="small"
                        options={KIM_IMAGE_SIZE_OPTIONS}
                        value={task.kimImageSize || DEFAULT_KIM_IMAGE_SIZE}
                        onChange={(val) => onSetImageSize(variantIndex, taskIndex, val)}
                      />
                    </span>
                  </Tooltip>
                )}
                {onMove && (
                  <>
                    <Tooltip title="Выше">
                      <Button
                        type="text"
                        size="small"
                        icon={<ArrowUpOutlined />}
                        disabled={taskIndex === 0}
                        onClick={() => onMove(variantIndex, taskIndex, taskIndex - 1)}
                      />
                    </Tooltip>
                    <Tooltip title="Ниже">
                      <Button
                        type="text"
                        size="small"
                        icon={<ArrowDownOutlined />}
                        disabled={taskIndex === variant.tasks.length - 1}
                        onClick={() => onMove(variantIndex, taskIndex, taskIndex + 1)}
                      />
                    </Tooltip>
                  </>
                )}
                <Tooltip title="Редактировать задачу">
                  <Button type="text" size="small" icon={<EditOutlined />} onClick={() => onEditTask?.(task)} />
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
          ))}
        </Card>
      ))}
    </div>
  );
}
