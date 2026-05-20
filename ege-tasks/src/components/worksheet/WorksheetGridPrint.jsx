import { useEffect, useState } from 'react';
import { Button, Card, Input, Segmented, Space, Switch, Typography } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined, TableOutlined } from '@ant-design/icons';
import MathRenderer from '../MathRenderer';
import { filterTaskText } from '../../utils/filterTaskText';
import { api } from '../../services/pocketbase';
import './WorksheetGridPrint.css';

const { Text } = Typography;

const CELL_OPTIONS = [
  { value: 4, label: '4 мм' },
  { value: 5, label: '5 мм' },
  { value: 8, label: '8 мм' },
];

const HEIGHT_OPTIONS = [
  { value: 12, label: '12 мм' },
  { value: 16, label: '16 мм' },
  { value: 22, label: '22 мм' },
  { value: 30, label: '30 мм' },
  { value: 40, label: '40 мм' },
  { value: 55, label: '55 мм' },
];

const FONT_OPTIONS = [9, 10, 11, 12].map(n => ({ value: n, label: String(n) }));

// ── Клетка: div'ы с физическими mm-позициями ─────────────────────────────────
// mm для позиций + pt для толщины → нативные векторы в PDF при любом DPI

function GridArea({ cellMm, heightMm, uid, imageUrl }) {
  const hLines = Math.ceil(heightMm / cellMm);
  const vLines = Math.ceil(200 / cellMm); // запас на ширину A4 с отступами
  return (
    <div className="wgp-grid-area" style={{ height: `${heightMm}mm` }}>
      {Array.from({ length: hLines }, (_, i) => (
        <div key={`h${uid}${i}`} className="wgp-h-line" style={{ top: `${(i + 1) * cellMm}mm` }} />
      ))}
      {Array.from({ length: vLines }, (_, i) => (
        <div key={`v${uid}${i}`} className="wgp-v-line" style={{ left: `${(i + 1) * cellMm}mm` }} />
      ))}
      {imageUrl && (
        <div className="wgp-grid-drawing">
          <img src={imageUrl} alt="" className="wgp-grid-drawing-img" style={{ maxHeight: `${heightMm - 4}mm` }} />
        </div>
      )}
    </div>
  );
}

// ── Одна задача ───────────────────────────────────────────────────────────────

function TaskBlock({ task, number, cellMm, heightMm, fontSize, hideTaskPrefixes, uid, showGrid, overlayGrid }) {
  const raw = task.statement_md || '';
  const text = hideTaskPrefixes ? filterTaskText(raw) : raw;
  const imageUrl = task.has_image ? api.getTaskImageUrl(task) : null;

  const statement = (
    <div className="wgp-task-statement" style={{ fontSize: `${fontSize}pt` }}>
      <span className="wgp-task-num">{number}.</span>
      <span className="wgp-task-text">
        <MathRenderer text={text || ' '} />
      </span>
    </div>
  );

  if (showGrid && overlayGrid) {
    return (
      <div className="wgp-task wgp-task--overlay">
        <div className="wgp-overlay-grid">
          <GridArea cellMm={cellMm} heightMm={heightMm} uid={uid} imageUrl={imageUrl} />
        </div>
        <div className="wgp-overlay-content">
          {statement}
          <div style={{ height: `${heightMm}mm` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="wgp-task">
      {statement}
      {showGrid && <GridArea cellMm={cellMm} heightMm={heightMm} uid={uid} imageUrl={imageUrl} />}
    </div>
  );
}

// ── Одна страница ─────────────────────────────────────────────────────────────

function WorksheetPage({ page, pageIdx, settings, hideTaskPrefixes, showStudentInfo, titleOverride, showGrid, overlayGrid }) {
  const { gridCellMm, gridHeightMm, columns, fontSize } = settings;
  const tasks = page.tasks || [];
  const half = Math.ceil(tasks.length / 2);
  const col1 = columns === 2 ? tasks.slice(0, half) : tasks;
  const col2 = columns === 2 ? tasks.slice(half) : [];

  const renderTasks = (list, offset = 0) =>
    list.map((task, i) => (
      <TaskBlock
        key={task.id || i}
        task={task}
        number={offset + i + 1}
        cellMm={gridCellMm}
        heightMm={gridHeightMm}
        fontSize={fontSize}
        hideTaskPrefixes={hideTaskPrefixes}
        uid={`${pageIdx}-${offset + i}`}
        showGrid={showGrid}
        overlayGrid={overlayGrid}
      />
    ));

  return (
    <div className={`wgp-page${pageIdx > 0 ? ' wgp-page-break' : ''}`}>
      <div className="wgp-header">
        <div className="wgp-header-left">
          {(titleOverride || page.title) && <span className="wgp-work-title">{titleOverride || page.title}</span>}
          {page.label && <span className="wgp-variant-label">{page.label}</span>}
        </div>
        {showStudentInfo && (
          <div className="wgp-student-info">
            <span className="wgp-info-item">Фамилия, имя:&nbsp;<span className="wgp-info-line" /></span>
            <span className="wgp-info-item">Дата:&nbsp;<span className="wgp-info-line wgp-info-line--short" /></span>
          </div>
        )}
      </div>
      <div className="wgp-ruler" />
      {columns === 2 ? (
        <div className="wgp-tasks wgp-tasks-2col">
          <div className="wgp-col">{renderTasks(col1, 0)}</div>
          <div className="wgp-col">{renderTasks(col2, half)}</div>
        </div>
      ) : (
        <div className="wgp-tasks">{renderTasks(col1)}</div>
      )}
    </div>
  );
}

// ── Лист ответов учителя ──────────────────────────────────────────────────────

function TeacherKeyPage({ pages, hideTaskPrefixes, titleOverride }) {
  return (
    <div className="wgp-key-page">
      <div className="wgp-key-title">Ответы (для учителя)</div>
      <div className="wgp-key-grid">
        {pages.map((page, pi) => (
          <div key={pi} className="wgp-key-variant">
            {(page.title || page.label) && (
              <div className="wgp-key-variant-label">
                {(titleOverride || page.title) && <span className="wgp-key-work-title">{titleOverride || page.title}</span>}
                {page.label && <span className="wgp-key-variant-badge">{page.label}</span>}
              </div>
            )}
            <ol className="wgp-key-list">
              {(page.tasks || []).map((task, ti) => (
                <li key={task.id || ti} className="wgp-key-item">
                  <span className="wgp-key-answer">
                    {task.answer
                      ? <MathRenderer text={task.answer} />
                      : <span className="wgp-key-no-answer">—</span>}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Основной компонент ────────────────────────────────────────────────────────

export default function WorksheetGridPrint({ pages = [], hideTaskPrefixes = false, onBack }) {
  const [gridCellMm, setGridCellMm] = useState(5);
  const [gridHeightMm, setGridHeightMm] = useState(22);
  const [columns, setColumns] = useState(1);
  const [fontSize, setFontSize] = useState(10);
  const [showStudentInfo, setShowStudentInfo] = useState(true);
  const [showTeacherKey, setShowTeacherKey] = useState(true);
  const [showGridPerTask, setShowGridPerTask] = useState(true);
  const [overlayGrid, setOverlayGrid] = useState(false);
  const [title, setTitle] = useState(() => pages[0]?.title || '');

  useEffect(() => {
    setTitle(pages[0]?.title || '');
  }, [pages[0]?.title]); // eslint-disable-line react-hooks/exhaustive-deps

  const settings = { gridCellMm, gridHeightMm, columns, fontSize };

  const handlePrint = () => {
    const style = document.createElement('style');
    style.id = 'wgp-page-style';
    style.textContent = '@page { size: A4 portrait; margin: 0; }';
    document.head.appendChild(style);
    window.print();
    const cleanup = () => {
      document.getElementById('wgp-page-style')?.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(cleanup, 3000);
  };

  if (!pages.length) return null;

  return (
    <div className="wgp-root">
      {/* ── Карточка настроек — видна на экране, скрыта при печати ── */}
      <Card
        className="wgp-settings-card"
        size="small"
        title={<span><TableOutlined style={{ marginRight: 8 }} />Рабочий лист с клеткой</span>}
        style={{ marginTop: 8, marginBottom: 16 }}
        extra={
          <Space>
            {onBack && (
              <Button icon={<ArrowLeftOutlined />} onClick={onBack}>Назад</Button>
            )}
            <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>
              Печать рабочего листа
            </Button>
          </Space>
        }
      >
        <Space wrap size={12}>
          <Space size={6}>
            <Text style={{ fontSize: 13 }}>Название:</Text>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Название листа"
              style={{ width: 180 }}
              size="small"
            />
          </Space>
          <Space size={6}>
            <Text style={{ fontSize: 13 }}>Клетка:</Text>
            <Segmented size="small" value={gridCellMm} onChange={setGridCellMm} options={CELL_OPTIONS} />
          </Space>
          <Space size={6}>
            <Text style={{ fontSize: 13 }}>Поле для решения:</Text>
            <Segmented size="small" value={gridHeightMm} onChange={setGridHeightMm} options={HEIGHT_OPTIONS} />
          </Space>
          <Space size={6}>
            <Text style={{ fontSize: 13 }}>Колонки:</Text>
            <Segmented size="small" value={columns} onChange={setColumns} options={[{ value: 1, label: '1' }, { value: 2, label: '2' }]} />
          </Space>
          <Space size={6}>
            <Text style={{ fontSize: 13 }}>Шрифт:</Text>
            <Segmented size="small" value={fontSize} onChange={setFontSize} options={FONT_OPTIONS} />
          </Space>
          <Space size={6}>
            <Switch size="small" checked={showStudentInfo} onChange={setShowStudentInfo} />
            <Text style={{ fontSize: 13 }}>Шапка</Text>
          </Space>
          <Space size={6}>
            <Switch size="small" checked={showGridPerTask} onChange={v => { setShowGridPerTask(v); if (!v) setOverlayGrid(false); }} />
            <Text style={{ fontSize: 13 }}>Клетка под задачей</Text>
          </Space>
          <Space size={6}>
            <Switch size="small" checked={overlayGrid} onChange={setOverlayGrid} disabled={!showGridPerTask} />
            <Text style={{ fontSize: 13 }}>Задача поверх клетки</Text>
          </Space>
          <Space size={6}>
            <Switch size="small" checked={showTeacherKey} onChange={setShowTeacherKey} />
            <Text style={{ fontSize: 13 }}>Ответы (учитель)</Text>
          </Space>
        </Space>
      </Card>

      {/* ── Печатный блок — всегда в DOM, скрыт на экране ── */}
      <div className="wgp-pages">
        {pages.map((page, i) => (
          <WorksheetPage
            key={i}
            page={page}
            pageIdx={i}
            settings={settings}
            hideTaskPrefixes={hideTaskPrefixes}
            showStudentInfo={showStudentInfo}
            titleOverride={title}
            showGrid={showGridPerTask}
            overlayGrid={overlayGrid}
          />
        ))}
        {showTeacherKey && (
          <TeacherKeyPage pages={pages} hideTaskPrefixes={hideTaskPrefixes} titleOverride={title} />
        )}
      </div>
    </div>
  );
}
