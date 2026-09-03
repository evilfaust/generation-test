import { useEffect, useState } from 'react';
import { Segmented, Slider, Radio, Button, Select, Space, Tag, Empty, Alert, Spin } from 'antd';
import { AimOutlined, SwapOutlined } from '@ant-design/icons';
import MathRenderer from '../../MathRenderer';
import TaskSelectModal from '../../TaskSelectModal';
import VectorIndexNote from '../VectorIndexNote';
import { api } from '../../../services/pocketbase';

/**
 * Способ подбора задач для «Генератора» (v3.9.41).
 * Сегмент «По фильтрам» (default) / «По образцу» / «Разные сюжеты» / «Анти-дубль».
 * Под выбранным методом — его контролы. Векторные методы выдают тот же variants,
 * что и фильтры, поэтому всё ниже (превью/печать/сохранение) не меняется.
 *
 * Значения поднимаются наружу через onChange-сеттеры (lifted state в генераторе).
 */
const METHOD_OPTIONS = [
  { label: 'По фильтрам', value: 'filters' },
  { label: '🎯 По образцу', value: 'seed' },
  { label: '🌈 Разные сюжеты', value: 'diverse' },
  { label: '♻️ Анти-дубль', value: 'novelty' },
];

const DIVERSE_METHOD_OPTIONS = [
  { label: 'Разнообразие (MMR)', value: 'mmr' },
  { label: 'Кластеры сюжетов', value: 'clusters' },
];

const panelBox = {
  marginTop: 14,
  padding: '14px 16px',
  background: '#fafaff',
  border: '1px solid #efeaff',
  borderRadius: 10,
};

export default function SelectionMethodPanel({
  method,
  setMethod,
  // seed
  seedTask,
  setSeedTask,
  similarity,
  setSimilarity,
  // diverse
  diverseMethod,
  setDiverseMethod,
  // novelty
  avoidWorkIds = [],
  setAvoidWorkIds,
  noveltyMaxCos,
  setNoveltyMaxCos,
  // контекст темы (для подсказок)
  selectedTopic,
}) {
  const [pickOpen, setPickOpen] = useState(false);
  const [works, setWorks] = useState([]);
  const [loadingWorks, setLoadingWorks] = useState(false);

  // Список работ для «анти-дубль» — грузим лениво при первом открытии режима.
  useEffect(() => {
    if (method !== 'novelty' || works.length > 0 || loadingWorks) return;
    setLoadingWorks(true);
    api.getWorks()
      .then((list) => setWorks(list || []))
      .finally(() => setLoadingWorks(false));
  }, [method]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#722ed1' }}>
        Способ подбора задач
      </div>
      <Segmented
        options={METHOD_OPTIONS}
        value={method}
        onChange={setMethod}
        size="large"
      />

      {method === 'filters' && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>
          Случайный набор по заданным фильтрам (классический режим).
        </div>
      )}

      {method !== 'filters' && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>
          Фильтры ниже (сложность, теги, год, источник) действуют и здесь — подбор идёт внутри них.
          <VectorIndexNote />
        </div>
      )}

      {/* === По образцу === */}
      {method === 'seed' && (
        <div style={panelBox}>
          <Space align="start" wrap style={{ width: '100%', justifyContent: 'space-between' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              {seedTask ? (
                <div style={{ padding: 10, background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8 }}>
                  <Space size={6} style={{ marginBottom: 4 }}>
                    <Tag color="purple" style={{ margin: 0 }}>эталон</Tag>
                    <span style={{ color: '#888', fontSize: 12 }}>{seedTask.code}</span>
                    {seedTask.answer && <Tag style={{ margin: 0 }}>{seedTask.answer}</Tag>}
                  </Space>
                  <div style={{ fontSize: 13, maxHeight: 84, overflow: 'hidden' }}>
                    <MathRenderer text={(seedTask.statement_md || seedTask.statement || '').slice(0, 240)} />
                  </div>
                </div>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Задача-эталон не выбрана" style={{ margin: 0 }} />
              )}
            </div>
            <Button icon={seedTask ? <SwapOutlined /> : <AimOutlined />} onClick={() => setPickOpen(true)}>
              {seedTask ? 'Заменить эталон' : 'Выбрать задачу-эталон'}
            </Button>
          </Space>

          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8c8c8c' }}>
              <span>← другие сюжеты темы</span>
              <span style={{ fontWeight: 600, color: '#722ed1' }}>похожесть: {Math.round(similarity * 100)}%</span>
              <span>клоны-тренажёр →</span>
            </div>
            <Slider
              min={0}
              max={100}
              value={Math.round(similarity * 100)}
              onChange={(v) => setSimilarity(v / 100)}
              tooltip={{ formatter: (v) => `${v}%` }}
            />
          </div>
        </div>
      )}

      {/* === Разные сюжеты === */}
      {method === 'diverse' && (
        <div style={panelBox}>
          {!selectedTopic && (
            <Alert type="info" showIcon style={{ marginBottom: 10 }}
              message="Выберите тему выше — из неё подберём максимально разные задачи." />
          )}
          <div style={{ fontSize: 13, marginBottom: 6 }}>Стратегия разнообразия:</div>
          <Radio.Group
            options={DIVERSE_METHOD_OPTIONS}
            value={diverseMethod}
            onChange={(e) => setDiverseMethod(e.target.value)}
            optionType="button"
            buttonStyle="solid"
          />
          <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>
            {diverseMethod === 'clusters'
              ? 'Тема делится на смысловые кластеры — по одной задаче из каждого «сюжета».'
              : 'Жадный отбор максимально непохожих задач (покрытие всех сюжетов темы).'}
          </div>
        </div>
      )}

      {/* === Анти-дубль === */}
      {method === 'novelty' && (
        <div style={panelBox}>
          {!selectedTopic && (
            <Alert type="info" showIcon style={{ marginBottom: 10 }}
              message="Выберите тему выше — из неё подберём задачи, не похожие на выбранную работу." />
          )}
          <div style={{ fontSize: 13, marginBottom: 6 }}>Не повторять задачи из работ:</div>
          <Select
            mode="multiple"
            style={{ width: '100%', maxWidth: 560 }}
            placeholder={loadingWorks ? 'Загрузка работ…' : 'Выберите одну или несколько ранее выданных работ'}
            value={avoidWorkIds}
            onChange={setAvoidWorkIds}
            allowClear
            showSearch
            maxTagCount="responsive"
            optionFilterProp="label"
            notFoundContent={loadingWorks ? <Spin size="small" /> : null}
            options={works.map((w) => ({ value: w.id, label: w.title || w.id }))}
          />
          <Space size={6} wrap style={{ marginTop: 8 }}>
            <Button size="small" disabled={!works.length}
              onClick={() => setAvoidWorkIds(works.slice(0, 5).map((w) => w.id))}>
              Последние 5 работ
            </Button>
            <Button size="small" disabled={!works.length}
              onClick={() => setAvoidWorkIds(works.slice(0, 10).map((w) => w.id))}>
              Последние 10
            </Button>
            {avoidWorkIds.length > 0 && (
              <Button size="small" type="text" onClick={() => setAvoidWorkIds([])}>Очистить</Button>
            )}
          </Space>
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8c8c8c' }}>
              <span>← строже (только совсем другое)</span>
              <span style={{ fontWeight: 600, color: '#722ed1' }}>порог сходства: {Math.round(noveltyMaxCos * 100)}%</span>
              <span>мягче →</span>
            </div>
            <Slider
              min={50}
              max={98}
              value={Math.round(noveltyMaxCos * 100)}
              onChange={(v) => setNoveltyMaxCos(v / 100)}
              tooltip={{ formatter: (v) => `${v}%` }}
            />
            <div style={{ fontSize: 12, color: '#8c8c8c' }}>
              Отсекаются задачи, похожие на выбранную работу выше порога.
            </div>
          </div>
        </div>
      )}

      <TaskSelectModal
        visible={pickOpen}
        onCancel={() => setPickOpen(false)}
        onSelect={(task) => { setSeedTask(task); setPickOpen(false); }}
      />
    </div>
  );
}
