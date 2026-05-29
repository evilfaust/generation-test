import { useState, useEffect, useCallback } from 'react';
import { Card, Tag, Button, Space, Spin, Alert, Empty, Pagination, Segmented, Tooltip, Popconfirm, Checkbox, App } from 'antd';
import { CheckOutlined, EyeInvisibleOutlined, ReloadOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { api } from '../../services/pocketbase';
import { useAuth } from '../../contexts/AuthContext';
import { useReferenceData } from '../../contexts/ReferenceDataContext';
import MathRenderer from '../MathRenderer';
import TaskEditModal from '../TaskEditModal';

export default function VectorDuplicatesTab({ onOpenTasks, onOpenWork }) {
  const { message } = App.useApp();
  const { canEdit, canDelete } = useAuth();
  const [deletingId, setDeletingId] = useState(null);
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
  const [selected, setSelected] = useState(new Set()); // выбранные задачи (птички)
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Удалить задачи из локального состояния (без рефреша страницы).
  // Кластеры, где осталось <2 задач, убираем из очереди.
  const removeTasksLocally = (ids) => {
    const idset = new Set(ids);
    setData((prev) => {
      if (!prev) return prev;
      let dropped = 0;
      const items = prev.items
        .map((c) => {
          const members = c.members.filter((m) => !idset.has(m.id));
          return { ...c, members, size: members.length };
        })
        .filter((c) => {
          if (c.members.length >= 2) return true;
          dropped += 1; return false;
        });
      return { ...prev, items, total: Math.max(0, prev.total - dropped) };
    });
    setSelected((prev) => { const n = new Set(prev); ids.forEach((id) => n.delete(id)); return n; });
  };

  const toggleSelect = (id) => setSelected((prev) => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  // выбрать все безопасно удаляемые (сироты, ref_count===0) на странице
  const selectAllOrphans = () => {
    const ids = [];
    (data?.items || []).forEach((c) => c.members.forEach((m) => { if (m.ref_count === 0) ids.push(m.id); }));
    setSelected(new Set(ids));
  };

  const bulkDelete = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    setBulkDeleting(true);
    const okIds = []; let failed = 0;
    for (const id of ids) {
      try { await api.deleteTask(id); okIds.push(id); } catch { failed += 1; }
    }
    removeTasksLocally(okIds);
    setBulkDeleting(false);
    if (okIds.length) message.success(`Удалено: ${okIds.length}${failed ? `, не удалось: ${failed} (используются в работах)` : ''}`);
    else message.warning('Ничего не удалено — выбранные задачи используются в работах (БД не даёт удалить)');
  };

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
      removeTasksLocally([taskId]); // без рефреша
    } catch (e) { message.error(`Не удалось удалить: ${e.message}`); }
  };
  // быстрое удаление прямо из строки (иконка 🗑)
  const quickDelete = async (taskId) => {
    setDeletingId(taskId);
    try {
      await api.deleteTask(taskId);
      message.success('Задача удалена');
      removeTasksLocally([taskId]); // без рефреша
    } catch (e) {
      const used = /relation reference|required relation/i.test(e?.message || '');
      message.error(used
        ? 'Задача используется в работах — БД не даёт удалить. Замени/убери её в работах (ссылки рядом) или «Пометить дублями».'
        : `Не удалось удалить: ${e.message}`);
    } finally {
      setDeletingId(null);
    }
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

  const handleSkip = async (c) => {
    const key = clusterKey(c);
    setMarkingId(key);
    try {
      await api.markNotDuplicate(c.members.map((m) => ({ id: m.id })), `${c.members[0]?.code || '?'} ×${c.size}`);
      setHidden((prev) => new Set(prev).add(key));
      message.success('Помечено «не дубли» — больше не появится в очереди');
    } catch (e) {
      message.error(`Не удалось пометить: ${e.message}`);
    } finally {
      setMarkingId(null);
    }
  };

  const visible = (data?.items || []).filter((c) => !hidden.has(clusterKey(c)));

  return (
    <div>
      <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <Segmented
          value={type}
          onChange={(v) => { setType(v); setPage(1); setHidden(new Set()); setSelected(new Set()); }}
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

      {/* Панель массового удаления (птички) */}
      {canDelete && !loading && visible.length > 0 && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 5, display: 'flex', gap: 8, alignItems: 'center',
          flexWrap: 'wrap', padding: '8px 12px', marginBottom: 12, borderRadius: 6,
          background: selected.size > 0 ? '#fff1f0' : '#fafafa', border: '1px solid #f0f0f0',
        }}>
          <span style={{ fontSize: 13 }}>Выбрано: <b>{selected.size}</b></span>
          <Button size="small" onClick={selectAllOrphans}>Выбрать всех «сирот» (можно удалить)</Button>
          {selected.size > 0 && <Button size="small" onClick={() => setSelected(new Set())}>Снять</Button>}
          <Popconfirm
            title={`Удалить выбранные задачи (${selected.size})?`}
            description="Используемые в работах БД удалить не даст — они будут пропущены. Сироты удалятся безвозвратно."
            okText="Удалить" okButtonProps={{ danger: true }} cancelText="Отмена"
            onConfirm={bulkDelete}
            disabled={selected.size === 0}
          >
            <Button size="small" danger type="primary" icon={<DeleteOutlined />} loading={bulkDeleting} disabled={selected.size === 0}>
              Удалить выбранные
            </Button>
          </Popconfirm>
        </div>
      )}

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
                  <Tooltip title="Пометить «не дубли» — кластер больше не появится в очереди">
                    <Button size="small" icon={<EyeInvisibleOutlined />} loading={markingId === clusterKey(c)} onClick={() => handleSkip(c)}>Не дубли</Button>
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
                    {canDelete && (
                      <Tooltip title={m.ref_count > 0 ? 'Используется в работах — при удалении будет пропущена' : 'Можно удалить'}>
                        <Checkbox
                          checked={selected.has(m.id)}
                          onChange={() => toggleSelect(m.id)}
                          style={{ marginTop: 2 }}
                        />
                      </Tooltip>
                    )}
                    <span style={{ flexShrink: 0, minWidth: 64, color: '#888' }}>{m.code}</span>
                    <Tag style={{ flexShrink: 0 }}>{m.answer || '—'}</Tag>
                    <div style={{ overflow: 'hidden', flex: 1 }}>
                      <MathRenderer text={m.statement} />
                      {/* работы, использующие задачу */}
                      <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                        {m.ref_count === 0 && <Tag color="green" style={{ margin: 0 }}>не используется — можно удалить</Tag>}
                        {m.ref_count > 0 && (
                          <Tooltip title="Используется в работах. Удалить нельзя (БД защитит) — открой работу и замени/убери там, либо «Пометить дублями».">
                            <span style={{ color: '#cf1322', fontSize: 12 }}>в {m.ref_count} раб.:</span>
                          </Tooltip>
                        )}
                        {(m.works || []).map((w) => (
                          <Tag
                            key={w.id} color="volcano"
                            style={{ margin: 0, cursor: onOpenWork ? 'pointer' : 'default' }}
                            onClick={onOpenWork ? () => onOpenWork(w.id) : undefined}
                          >
                            {w.title || 'без названия'} →
                          </Tag>
                        ))}
                      </div>
                    </div>
                    <Space size={0} style={{ flexShrink: 0 }}>
                      {canEdit && (
                        <Tooltip title="Открыть в редакторе (правка / LaTeX)">
                          <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEditor(m.id)} />
                        </Tooltip>
                      )}
                      {canDelete && (
                        <Popconfirm
                          title="Удалить задачу?"
                          description={m.ref_count > 0
                            ? `Используется в ${m.ref_count} раб. — БД, скорее всего, не даст удалить.`
                            : 'Задача нигде не используется — удалится безвозвратно.'}
                          okText="Удалить" okButtonProps={{ danger: true }} cancelText="Отмена"
                          onConfirm={() => quickDelete(m.id)}
                        >
                          <Tooltip title="Удалить задачу">
                            <Button size="small" type="text" danger icon={<DeleteOutlined />} loading={deletingId === m.id} />
                          </Tooltip>
                        </Popconfirm>
                      )}
                    </Space>
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
          onChange={(p) => { setPage(p); setHidden(new Set()); setSelected(new Set()); }}
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
