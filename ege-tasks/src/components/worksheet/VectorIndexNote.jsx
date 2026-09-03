import { Tooltip } from 'antd';
import { useVectorIndexStats } from '../../hooks/useVectorIndexStats';

const fmtDate = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('ru-RU');
};

/**
 * Строка о состоянии семантического индекса. Индексация ручная
 * (`vector-benchmark → npm run index`), поэтому свежие задачи каталога в подбор
 * не попадают — без этой подписи «нет подходящей замены» выглядит как поломка.
 *
 * @param {boolean} [alwaysShow] - показывать даже когда индекс полный
 */
export default function VectorIndexNote({ alwaysShow = false }) {
  const stats = useVectorIndexStats();
  if (!stats) return null;

  const { missing = 0, tasks_total: total = 0, indexed_at: indexedAt } = stats;
  const date = fmtDate(indexedAt);
  if (!missing && !alwaysShow) return null;

  const text = missing
    ? `В семантическом индексе ${total - missing} из ${total} задач каталога${date ? `, обновлён ${date}` : ''}. Задачи вне индекса в подбор не попадают.`
    : `Индекс покрывает все ${total} задач каталога${date ? `, обновлён ${date}` : ''}.`;

  return (
    <Tooltip title="Индекс пересчитывается вручную: vector-benchmark → npm run index">
      <div style={{ fontSize: 12, color: missing ? '#d46b08' : '#8c8c8c', marginTop: 6 }}>
        {missing ? '⚠️ ' : ''}{text}
      </div>
    </Tooltip>
  );
}
