import MathRenderer from '../../shared/components/MathRenderer';
import { api } from '../../shared/services/pocketbase';

const DIFFICULTY_COLOR = { 1: '#52c41a', 2: '#faad14', 3: '#ff4d4f', 4: '#a8071a', 5: '#722ed1' };

function MarathonCard({ task, idx, title, showLogo }) {
  const diff = task.difficulty || 1;
  const color = DIFFICULTY_COLOR[diff] || '#1890ff';
  const imageUrl = api.getTaskImageUrl(task);

  return (
    <div className="mcp-slot">
      <div className="mcp-card">
        {/* Шапка: лого + номер + заголовок */}
        <div className={`mcp-header${showLogo ? '' : ' mcp-header--no-logo'}`}>
          {showLogo && (
            <img
              src="/lemma-text-logo-vertical.png"
              alt="Lemma"
              className="mcp-logo"
            />
          )}
          <div className="mcp-header-right">
            <div className="mcp-title-row">
              <div className="mcp-num" style={{ background: color }}>
                {idx + 1}
              </div>
              <span className="mcp-title-text">{title}</span>
            </div>
            <div className="mcp-rule" />
          </div>
        </div>

        {/* Условие задачи */}
        <div className="mcp-body">
          <div className="mcp-body-text">
            <MathRenderer content={task.statement_md || ''} />
          </div>
          {imageUrl && (
            <div className="mcp-body-image">
              <img
                src={imageUrl}
                alt=""
                className="mcp-task-image"
                crossOrigin="anonymous"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Печать A4: 2 колонки × 3 строки = 6 карточек на страницу.
 * Каждые 6 карточек — отдельная страница.
 */
export default function MarathonCardsPrint({ tasks, title, showLogo = true }) {
  if (!tasks.length) return null;

  const pages = [];
  for (let i = 0; i < tasks.length; i += 6) {
    pages.push(tasks.slice(i, i + 6));
  }

  return (
    <div className="marathon-cards-print-root">
      {pages.map((pageTasks, pageIdx) => (
        <div key={pageIdx} className="mcp-page">
          {pageTasks.map((task, slotIdx) => (
            <MarathonCard
              key={task.id}
              task={task}
              idx={pageIdx * 6 + slotIdx}
              title={title}
              showLogo={showLogo}
            />
          ))}
          {/* Пустые слоты для неполной последней страницы */}
          {Array.from({ length: 6 - pageTasks.length }).map((_, i) => (
            <div key={`empty-${i}`} className="mcp-slot mcp-slot--empty" />
          ))}
        </div>
      ))}
    </div>
  );
}
