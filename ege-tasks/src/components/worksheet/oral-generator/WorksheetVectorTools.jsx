import { useState } from 'react';
import { Button, Space, Card } from 'antd';
import { ExperimentOutlined, PlusOutlined } from '@ant-design/icons';
import VariantSimilarityWarning from '../VariantSimilarityWarning';
import ParallelVariantsModal from '../ParallelVariantsModal';
import FillSimilarModal from './FillSimilarModal';
import NoveltyBadge from './NoveltyBadge';

/**
 * Блок векторных инструментов под результатом «Генератора»:
 *  - NoveltyBadge — насколько свежий набор относительно последних работ;
 *  - VariantSimilarityWarning (A2) — авто-предупреждение о повторах/дублях внутри вариантов;
 *  - «Дополнить похожими» (A1 + догенерация) — FillSimilarModal;
 *  - «Параллельные варианты» (A4) — ParallelVariantsModal.
 *
 * Рендерится только когда есть сгенерированные варианты.
 */
export default function WorksheetVectorTools({ variants, setVariants, workTitle, currentWorkId, onOpenWork }) {
  const [parallelOpen, setParallelOpen] = useState(false);
  const [fillOpen, setFillOpen] = useState(false);

  if (!variants || variants.length === 0) return null;
  const baseTasks = variants[0]?.tasks || [];

  return (
    <Card
      size="small"
      style={{ marginBottom: 16, borderColor: '#d3adf7', background: '#fcfaff' }}
      styles={{ body: { padding: '10px 14px' } }}
    >
      <Space wrap align="center">
        <span style={{ fontWeight: 600, color: '#722ed1' }}>🔎 Векторные инструменты:</span>
        <Button icon={<PlusOutlined />} onClick={() => setFillOpen(true)}>
          Дополнить похожими
        </Button>
        <Button icon={<ExperimentOutlined />} onClick={() => setParallelOpen(true)} disabled={baseTasks.length === 0}>
          Параллельные варианты
        </Button>
        <NoveltyBadge variants={variants} currentWorkId={currentWorkId} />
      </Space>

      {/* A2 — авто-предупреждение о возможных повторах внутри вариантов */}
      <VariantSimilarityWarning variants={variants} />

      <ParallelVariantsModal
        open={parallelOpen}
        onClose={() => setParallelOpen(false)}
        baseTasks={baseTasks}
        baseTitle={workTitle}
        onOpenWork={onOpenWork}
      />

      <FillSimilarModal
        open={fillOpen}
        onClose={() => setFillOpen(false)}
        variants={variants}
        setVariants={setVariants}
      />
    </Card>
  );
}
