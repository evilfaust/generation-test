import { useState, useCallback } from 'react';
import { Popover, Button, Tooltip } from 'antd';
import { TableOutlined } from '@ant-design/icons';

const MAX_ROWS = 6;
const MAX_COLS = 6;

export default function TableInsertPopover({ onInsert }) {
  const [open, setOpen] = useState(false);
  const [hoverRow, setHoverRow] = useState(0);
  const [hoverCol, setHoverCol] = useState(0);

  const handleSelect = useCallback((rows, cols) => {
    const header = Array.from({ length: cols }, (_, i) => `Столбец ${i + 1}`).join(' | ');
    const separator = Array.from({ length: cols }, () => '---').join(' | ');
    const emptyRow = Array.from({ length: cols }, () => '   ').join(' | ');
    const bodyRows = Array.from({ length: rows }, () => `| ${emptyRow} |`).join('\n');

    const table = `\n| ${header} |\n| ${separator} |\n${bodyRows}\n`;
    onInsert?.(table);
    setOpen(false);
    setHoverRow(0);
    setHoverCol(0);
  }, [onInsert]);

  const content = (
    <div style={{ padding: 4 }}>
      <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 8, textAlign: 'center' }}>
        {hoverRow > 0 ? `${hoverRow} × ${hoverCol}` : 'Выберите размер'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${MAX_COLS}, 1fr)`, gap: 2 }}>
        {Array.from({ length: MAX_ROWS * MAX_COLS }, (_, idx) => {
          const row = Math.floor(idx / MAX_COLS) + 1;
          const col = (idx % MAX_COLS) + 1;
          const isHighlighted = row <= hoverRow && col <= hoverCol;
          return (
            <div
              key={idx}
              onMouseEnter={() => { setHoverRow(row); setHoverCol(col); }}
              onClick={() => handleSelect(row, col)}
              style={{
                width: 20,
                height: 20,
                borderRadius: 3,
                border: '1px solid',
                borderColor: isHighlighted ? '#4361ee' : '#e0e0e0',
                background: isHighlighted ? 'rgba(67, 97, 238, 0.15)' : '#fafafa',
                cursor: 'pointer',
                transition: 'all 0.1s ease',
              }}
            />
          );
        })}
      </div>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottom"
    >
      <Tooltip title="Таблица">
        <Button size="small" type="text" className="tf-btn" icon={<TableOutlined />} />
      </Tooltip>
    </Popover>
  );
}
