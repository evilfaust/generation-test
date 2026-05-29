import { useState, useEffect, useCallback } from 'react';
import { Card, Tag, Button, Space, Spin, Alert, Empty, Pagination, Segmented, Tooltip, App } from 'antd';
import { CheckOutlined, EyeInvisibleOutlined, ReloadOutlined, EditOutlined } from '@ant-design/icons';
import { api } from '../../services/pocketbase';
import { useAuth } from '../../contexts/AuthContext';
import { useReferenceData } from '../../contexts/ReferenceDataContext';
import MathRenderer from '../MathRenderer';
import TaskEditModal from '../TaskEditModal';

export default function VectorDuplicatesTab({ onOpenTasks }) {
  const { message } = App.useApp();
  const { canEdit } = useAuth();
  const { topics, tags, subtopics, years, sources } = useReferenceData();
  const [type, setType] = useState('exact_dup');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [markingId, setMarkingId] = useState(null);
  const [hidden, setHidden] = useState(new Set()); // локально скрытые (пропущенные/размеченные)
  const [editTask, setEditTask] = useState(null); // задача в редакторе
  const [editOpen, setEditOpen] = useState(false);

  const openEditor = async (taskId) => {
    try {
      const t = await api.getTask(taskId);
      setEditTask(t); setEditOpen(true);
    } catch (e) { message.error(`Не удалось загрузить задачу: ${e.message}`); }
  };
  const handleSaved = async (id, taskData) => {
    try {
      await api.updateTask(id || editTask.id, taskData);
      message.success('Задача сохранена');
      setEditOpen(false);
      load(); // обновить превью кластеров
    } catch (e) { message.error(`Не удалось сохранить: ${e.message}`); }
  };
  const handleDeleted = async (taskId) => {
    try {
      await api.deleteTask(taskId);
      message.success('Задача удалена');
      setEditOpen(false);
      load(); // обновить очередь
    } catch (e) { message.error(`Не удалось удалить: ${e.message}`); }
  };

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await api.getDuplicateClusters({ type, page, perPage: 20 });
      setData(r);
    } catch (e) {
      setError(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [type, page]);

  useEffect(() => { load(); }, [load]);

  const clusterKey = (c) => c.members.map((m) => m.id).sort().join('|');

  const handleMark = async (c) => {
    const key = clusterKey(c);
    setMarkingId(key);
    try {
      const label = `${c.members[0]?.code || '?'} ×${c.size}`;
      await api.markDedupCluster(c.members.map((m) => ({ id: m.id })), label);
      setHidden((prev) => new Set(prev).add(key));
      message.success(`Помечено как дубли: ${label}`);
    } catch (e) {
      message.error(`Не удалось пометить: ${e.message}`);
    } finally {
      setMarkingId(null);
    }
  };

  const handleSkip = (c) => {
    setHidden((prev) => new Set(prev).add(clusterKey(c)));
  };

  const visible = (data?.items || []).filter((c) => !hidden.has(clusterKey(c)));

  return (
    <div>
      <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <Segmented
          value={type}
          onChange={(v) => { setType(v); setPage(1); setHidden(new Set()); }}
          options={[
            { label: 'Точные дубли', value: 'exact_dup' },
            { label: 'Параметрические семейства', value: 'param_family' },
          ]}
        />
        <Button size="small" icon={<ReloadOutlined />} onClick={load} disabled={loading}>Обновить</Button>
        {data && (
          <span style={{ color: '#888', fontSize: 13 }}>
            На ревью: <b>{data.total}</b> · уже размечено задач: {data.reviewed_count}
          </span>
        )}
      </Space>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={type === 'exact_dup'
          ? 'Кластеры почти-идентичных задач с одинаковым ответом (cos ≥ 0.93 внутри темы). «Пометить дублями» создаёт запись-семейство (dedup_cluster) — задачи НЕ удаляются, только связываются.'
          : 'Параметрические семейства: тот же тип, но разные числа/ответы — обычно это здоровое разнообразие, а не дубли.'}
      />

      {loading && <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>}
      {!loading && error && <Alert type="error" showIcon message={error} />}
      {!loading && !error && visible.length === 0 && (
        <Empty description="Кластеров не осталось — всё размечено или пропущено" />
      )}

      {!loading && visible.length > 0 && (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {visible.map((c) => (
            <Card
              key={clusterKey(c)}
              size="small"
              title={<Space><Tag color={type === 'exact_dup' ? 'red' : 'blue'}>{c.size} задач</Tag></Space>}
              extra={
                <Space>
                  {onOpenTasks && (
                    <Button size="small" onClick={() => onOpenTasks({ search: (c.members[0]?.statement || '').slice(0, 40) })}>
                      Найти в списке
                    </Button>
                  )}
                  <Tooltip title="Скрыть из очереди до перезагрузки (не сохраняется)">
                    <Button size="small" icon={<EyeInvisibleOutlined />} onClick={() => handleSkip(c)}>Не дубли</Button>
                  </Tooltip>
                  {canEdit && (
                    <Button
                      size="small" type="primary" icon={<CheckOutlined />}
                      loading={markingId === clusterKey(c)}
                      onClick={() => handleMark(c)}
                    >
                      Пометить дублями
                    </Button>
                  )}
                </Space>
              }
            >
              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                {c.members.map((m) => (
                  <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
                    <span style={{ flexShrink: 0, minWidth: 64, color: '#888' }}>{m.code}</span>
                    <Tag style={{ flexShrink: 0 }}>{m.answer || '—'}</Tag>
                    {m.ref_count != null && (
                      <Tooltip title={m.ref_count > 0 ? 'Используется в работах — удаление урежет их. Безопаснее «Пометить дублями».' : 'Нигде не используется — можно безопасно удалить.'}>
                        <Tag color={m.ref_count > 0 ? 'volcano' : 'green'} style={{ flexShrink: 0 }}>
                          {m.ref_count > 0 ? `в ${m.ref_count} раб.` : 'не исп.'}
                        </Tag>
                      </Tooltip>
                    )}
                    <div style={{ overflow: 'hidden', flex: 1 }}><MathRenderer text={m.statement} /></div>
                    {canEdit && (
                      <Tooltip title="Открыть в редакторе (правка / удаление)">
                        <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEditor(m.id)} />
                      </Tooltip>
                    )}
                  </div>
                ))}
              </Space>
            </Card>
          ))}
        </Space>
      )}

      {data && data.totalPages > 1 && (
        <Pagination
          style={{ marginTop: 16, textAlign: 'center' }}
          current={page}
          total={data.total}
          pageSize={20}
          showSizeChanger={false}
          onChange={(p) => { setPage(p); setHidden(new Set()); }}
        />
      )}

      <TaskEditModal
        task={editTask}
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        onSave={handleSaved}
        onDelete={handleDeleted}
        allTags={tags || []}
        allSources={sources || []}
        allYears={years || []}
        allSubtopics={subtopics || []}
        allTopics={topics || []}
      />
    </div>
  );
}
