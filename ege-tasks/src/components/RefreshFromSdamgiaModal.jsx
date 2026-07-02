// RefreshFromSdamgiaModal — модал «Перепарсить задачу с Решу ЕГЭ».
//
// Для задач с task.sdamgia_url:
//   1. Запрашивает у /parse-sdamgia заново страницу задачи.
//   2. Опционально прогоняет формулы через /latex-fix.
//   3. Показывает дифф «До / После» по 4 текстовым полям + max_score
//      + список картинок. Учитель чекбоксами выбирает что применить.
//   4. По «Применить» — updateTask + при необходимости пересоздание
//      task_images (старые удаляются, новые скачиваются через прокси).
import { useState } from 'react';
import {
  Modal, Button, Space, Checkbox, Alert, Progress, Spin,
  Typography, Divider, Tag, App,
} from 'antd';
import { ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons';
import pb, { api, aiHeaders } from '../services/pocketbase';
import { useAuth } from '../contexts/AuthContext';
import TaskStatementRenderer from './TaskStatementRenderer';

const { Text } = Typography;

const PDF_SERVICE_URL = (() => {
  const envUrl = import.meta.env.VITE_PDF_SERVICE_URL;
  if (envUrl) return envUrl;
  return 'http://localhost:3001';
})();

const FIELDS = [
  { key: 'statement_md', label: 'Условие' },
  { key: 'answer',       label: 'Ответ',       singleLine: true },
  { key: 'solution_md',  label: 'Решение' },
  { key: 'criteria_md',  label: 'Критерии'    },
  { key: 'max_score',    label: 'Макс. балл',   singleLine: true, numeric: true },
];

/**
 * Скачать страницу sdamgia, спарсить, опционально починить LaTeX.
 */
async function fetchFreshTaskData(sdamgiaUrl, withLlmFix) {
  const parseRes = await fetch(`${PDF_SERVICE_URL}/parse-sdamgia`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: sdamgiaUrl }),
  });
  if (!parseRes.ok) throw new Error(`parse-sdamgia: HTTP ${parseRes.status}`);
  const parsed = await parseRes.json();
  const problem = parsed.problems?.[0];
  if (!problem) throw new Error('Задача не найдена на странице sdamgia');

  let fresh = {
    statement_md: problem.condition || '',
    answer:       problem.answer || '',
    solution_md:  problem.solution || '',
    criteria_md:  problem.criteria_md || '',
    max_score:    problem.max_score ?? null,
    condition_images: problem.condition_images || [],
    solution_images:  problem.solution_images || [],
    criteria_images:  problem.criteria_images || [],
  };

  if (withLlmFix) {
    // Параллельно через /latex-fix
    const fixPromises = ['statement_md', 'solution_md', 'criteria_md'].map(async (k) => {
      if (!fresh[k] || !fresh[k].trim()) return [k, fresh[k]];
      try {
        const r = await fetch(`${PDF_SERVICE_URL}/latex-fix`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...aiHeaders() },
          body: JSON.stringify({ text: fresh[k], role: k.replace('_md', '') }),
        });
        if (!r.ok) return [k, fresh[k]];
        const d = await r.json();
        return [k, d.text || fresh[k]];
      } catch {
        return [k, fresh[k]];
      }
    });
    const fixed = await Promise.all(fixPromises);
    for (const [k, v] of fixed) fresh[k] = v;
  }

  return fresh;
}

export default function RefreshFromSdamgiaModal({ task, open, onClose, onApplied }) {
  const { message } = App.useApp();
  const { aiEnabled } = useAuth(); // ИИ-тумблер: без него LLM-фикс недоступен
  const [phase, setPhase] = useState('idle'); // 'idle' | 'loading' | 'preview' | 'applying'
  const [withLlmFix, setWithLlmFix] = useState(true);
  const [reloadImages, setReloadImages] = useState(false);
  const [fresh, setFresh] = useState(null);
  const [selectedFields, setSelectedFields] = useState({});

  const reset = () => {
    setPhase('idle');
    setFresh(null);
    setSelectedFields({});
    setReloadImages(false);
  };

  const handleClose = () => {
    reset();
    onClose?.();
  };

  const handleStart = async () => {
    setPhase('loading');
    try {
      const data = await fetchFreshTaskData(task.sdamgia_url, withLlmFix && aiEnabled);
      setFresh(data);
      // Preselect: галочка стоит на полях, где значение реально изменилось.
      const initialSel = {};
      for (const f of FIELDS) {
        const oldVal = task?.[f.key] ?? null;
        const newVal = data[f.key] ?? null;
        const changed = (oldVal || '') !== (newVal || '') && newVal !== null && newVal !== '';
        initialSel[f.key] = changed;
      }
      setSelectedFields(initialSel);
      setPhase('preview');
    } catch (e) {
      message.error(`Ошибка: ${e.message}`);
      setPhase('idle');
    }
  };

  const handleApply = async () => {
    if (!fresh) return;
    setPhase('applying');
    try {
      // 1) Сбор изменений по выбранным полям
      const updateData = {};
      for (const f of FIELDS) {
        if (selectedFields[f.key]) {
          const v = fresh[f.key];
          if (f.numeric) {
            if (v != null) updateData[f.key] = v;
          } else {
            updateData[f.key] = v || '';
          }
        }
      }
      // Раз правка — сбросим latex_needs_review
      if (Object.keys(updateData).length > 0 && task.latex_needs_review) {
        updateData.latex_needs_review = false;
      }
      if (Object.keys(updateData).length > 0) {
        await api.updateTask(task.id, updateData);
      }

      // 2) Картинки — удаляем старые, заливаем новые через прокси
      if (reloadImages) {
        // Удаляем существующие записи task_images этой задачи
        const existing = await pb.collection('task_images').getFullList({
          filter: `task = "${task.id}"`,
        });
        for (const rec of existing) {
          await pb.collection('task_images').delete(rec.id);
        }
        // Заливаем новые
        const roleGroups = [
          ['condition', fresh.condition_images],
          ['solution',  fresh.solution_images],
          ['criteria',  fresh.criteria_images],
        ];
        for (const [role, imgs] of roleGroups) {
          for (const img of (imgs || [])) {
            try {
              const r = await fetch(`${PDF_SERVICE_URL}/fetch-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: img.url }),
              });
              if (!r.ok) continue;
              const blob = await r.blob();
              const ct = r.headers.get('content-type') || blob.type || 'image/png';
              const ext = ct.includes('svg') ? 'svg'
                : ct.includes('jpeg') ? 'jpg'
                : ct.includes('webp') ? 'webp'
                : ct.includes('gif')  ? 'gif'
                : 'png';
              const fileName = `${img.file_id || `${role}_${img.order || 1}`}.${ext}`;
              await api.createTaskImage({
                task: task.id,
                role,
                order: img.order,
                fileBlob: blob,
                fileName,
                sdamgia_file_id: img.file_id,
                original_url: img.url,
              });
            } catch (e) {
              console.warn(`[refresh] img ${img.url}: ${e.message}`);
            }
          }
        }
      }

      message.success('Задача обновлена');
      onApplied?.();
      handleClose();
    } catch (e) {
      message.error(`Не удалось применить: ${e.message}`);
      setPhase('preview');
    }
  };

  const renderDiff = () => {
    if (!fresh) return null;
    const oldImgCount =
      (task?.condition_images_count ?? '?') !== '?'
        ? null
        : null; // не считаем — обновляется только по reloadImages
    const freshImgTotal =
      (fresh.condition_images?.length || 0) +
      (fresh.solution_images?.length || 0) +
      (fresh.criteria_images?.length || 0);

    return (
      <div>
        <Alert
          type={withLlmFix ? 'success' : 'info'}
          showIcon
          style={{ marginBottom: 16 }}
          message={
            withLlmFix
              ? `Получено с sdamgia + прогнано через LLM. Выбери поля для применения.`
              : `Получено с sdamgia (без LLM-нормализации). Выбери поля для применения.`
          }
        />

        {FIELDS.map((f) => {
          const oldVal = task?.[f.key] ?? '';
          const newVal = fresh[f.key] ?? '';
          const isChanged = (oldVal || '') !== (newVal || '') && (newVal !== '' && newVal !== null);
          const isEmpty = (newVal === '' || newVal === null);
          return (
            <div key={f.key} style={{ marginBottom: 12 }}>
              <Space style={{ marginBottom: 6 }}>
                <Checkbox
                  checked={!!selectedFields[f.key]}
                  disabled={!isChanged || isEmpty}
                  onChange={(e) => setSelectedFields(s => ({ ...s, [f.key]: e.target.checked }))}
                >
                  <strong>{f.label}</strong>
                </Checkbox>
                {!isChanged && !isEmpty && <Tag color="default">не изменилось</Tag>}
                {isEmpty && <Tag color="default">пусто</Tag>}
                {isChanged && <Tag color="processing">⚡ изменено</Tag>}
              </Space>
              {isChanged && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ padding: 8, background: '#fafafa', border: '1px solid #eee', borderRadius: 4 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>ДО</Text>
                    <div style={{ marginTop: 4, fontSize: 13, maxHeight: 200, overflowY: 'auto' }}>
                      {f.numeric
                        ? <Text>{oldVal ?? '—'}</Text>
                        : <TaskStatementRenderer text={oldVal || '(пусто)'} images={[]} />
                      }
                    </div>
                  </div>
                  <div style={{ padding: 8, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>ПОСЛЕ</Text>
                    <div style={{ marginTop: 4, fontSize: 13, maxHeight: 200, overflowY: 'auto' }}>
                      {f.numeric
                        ? <Text>{newVal}</Text>
                        : <TaskStatementRenderer text={newVal} images={[]} />
                      }
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <Divider style={{ margin: '12px 0' }} />

        <Space>
          <Checkbox
            checked={reloadImages}
            onChange={(e) => setReloadImages(e.target.checked)}
          >
            <strong>Перезагрузить картинки</strong> (старые удалятся, скачаются новые: {freshImgTotal} шт.)
          </Checkbox>
        </Space>
      </div>
    );
  };

  return (
    <Modal
      title={
        <Space>
          <ReloadOutlined />
          <span>Перепарсить с «Решу ЕГЭ»</span>
          {task?.sdamgia_id && <Tag color="green">id {task.sdamgia_id}</Tag>}
        </Space>
      }
      open={open}
      onCancel={handleClose}
      width={900}
      footer={
        phase === 'preview' ? (
          <Space>
            <Button onClick={handleClose}>Отмена</Button>
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={handleApply}
              disabled={
                !Object.values(selectedFields).some(v => v) && !reloadImages
              }
            >
              Применить выбранное
            </Button>
          </Space>
        ) : null
      }
      maskClosable={phase === 'idle'}
      keyboard={phase === 'idle'}
    >
      {phase === 'idle' && (
        <div>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="Что произойдёт"
            description={
              <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                <li>Скачаем страницу задачи с sdamgia заново (актуальный парсер).</li>
                <li>Опционально: прогоним формулы через LLM для нормализации LaTeX.</li>
                <li>Покажем разницу с текущей версией и дадим тебе выбрать что применить.</li>
              </ul>
            }
          />
          {aiEnabled && (
            <Space direction="vertical" size={12}>
              <Checkbox
                checked={withLlmFix}
                onChange={(e) => setWithLlmFix(e.target.checked)}
              >
                <strong>🤖 Дополнительно: прогнать LaTeX через LLM</strong>
                <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                  Рекомендуется. Лечит \angleABC → \angle&#123;ABC&#125;, степени в скобках, индексы и т.п.
                </div>
              </Checkbox>
            </Space>
          )}
          <div style={{ marginTop: 24 }}>
            <Button type="primary" icon={<ReloadOutlined />} onClick={handleStart}>
              Начать
            </Button>
          </div>
        </div>
      )}

      {phase === 'loading' && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, color: '#666' }}>
            Качаем страницу sdamgia{withLlmFix ? ' и прогоняем формулы через LLM' : ''}…
          </div>
        </div>
      )}

      {phase === 'preview' && renderDiff()}

      {phase === 'applying' && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Progress type="circle" percent={50} />
          <div style={{ marginTop: 16, color: '#666' }}>Применяем изменения…</div>
        </div>
      )}
    </Modal>
  );
}
