import { Affix } from 'antd';
import { CheckCircleFilled } from '@ant-design/icons';
import ActionButtons from '../ActionButtons';

export default function ResultActionBar({
  variants,
  outputMode,
  variantLabel,
  sheetFormat,
  cardFormat,
  showAnswersPage,
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
  const formatLabel = outputMode === 'sheet' ? sheetFormat : cardFormat;
  const modeLabel = outputMode === 'sheet' ? 'Лист задач' : 'Карточки';

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
              {modeLabel} · {formatLabel}{showAnswersPage && outputMode === 'sheet' ? ' · с листом ответов' : ''}
            </div>
          </div>
        </div>

        <ActionButtons
          hasVariants={true}
          loading={false}
          onOpenLoad={onOpenLoad}
          onSave={onSave}
          onPrint={onPrint}
          onExportPDF={onExportPDF}
          onExportMD={onExportMD}
          onReset={onReset}
          pdfMethod={worksheetActions.pdfMethod}
          setPdfMethod={worksheetActions.setPdfMethod}
          puppeteerAvailable={worksheetActions.puppeteerAvailable}
          exporting={worksheetActions.exporting}
          saving={worksheetActions.saving}
        />
      </div>
    </Affix>
  );
}
