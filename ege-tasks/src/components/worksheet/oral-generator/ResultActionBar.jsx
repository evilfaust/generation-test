import { Affix, Tooltip } from 'antd';
import { CheckCircleFilled } from '@ant-design/icons';
import ActionButtons from '../ActionButtons';

export default function ResultActionBar({
  variants,
  outputMode,
  variantLabel,
  cardFormat,
  showAnswersPage,
  sheetSummary,
  onSave,
  onOpenLoad,
  onPrint,
  onExportPDF,
  onExportMD,
  onReset,
  worksheetActions,
}) {
  if (!variants || variants.length === 0) return null;

  const totalTasks = variants.reduce((sum, v) => sum + (v.tasks?.length || 0), 0);
  const tasksPerVariant = variants[0]?.tasks?.length || 0;
  const isSheet = outputMode === 'sheet';
  const formatLabel = isSheet ? sheetSummary : cardFormat;
  const modeLabel = isSheet ? 'Лист задач' : 'Карточки';

  return (
    <Affix offsetTop={8} style={{ zIndex: 10 }}>
      <div
        style={{
          background: '#fff',
          border: '1px solid #b7eb8f',
          borderRadius: 12,
          padding: '12px 18px',
          marginBottom: 16,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <CheckCircleFilled style={{ color: '#52c41a', fontSize: 20 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>
              {variants.length} {variants.length === 1 ? 'вариант' : 'вариантов'} × {tasksPerVariant} = {totalTasks} задач
            </div>
            <div
              style={{
                fontSize: 12,
                color: '#888',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 360,
              }}
            >
              {modeLabel} · {formatLabel}{showAnswersPage && isSheet ? ' · с листом ответов' : ''}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
          {isSheet && (
            <Tooltip title="Лист свёрстан по миллиметрам — растровый html2pdf его портит. Печать → «Сохранить как PDF» даёт векторный файл.">
              <span style={{ fontSize: 12, color: '#8c8c8c', whiteSpace: 'nowrap' }}>
                PDF — через «Печать»
              </span>
            </Tooltip>
          )}
          <ActionButtons
            hasVariants={true}
            loading={false}
            onOpenLoad={onOpenLoad}
            onSave={onSave}
            onPrint={onPrint}
            onExportPDF={isSheet ? undefined : onExportPDF}
            onExportMD={onExportMD}
            onReset={onReset}
            exporting={worksheetActions.exporting}
            saving={worksheetActions.saving}
          />
        </div>
      </div>
    </Affix>
  );
}
