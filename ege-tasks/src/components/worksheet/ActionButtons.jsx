import { Button, Tooltip, Divider } from 'antd';
import {
  PrinterOutlined,
  FilePdfOutlined,
  FileMarkdownOutlined,
  SaveOutlined,
  FolderOpenOutlined,
  ThunderboltOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Компонент кнопок действий для генераторов.
 */
const ActionButtons = ({
  hasVariants = false,
  loading = false,
  onGenerate,
  onOpenLoad,
  onSave,
  onPrint,
  onExportPDF,
  onExportMD,
  onReset,
  exporting = false,
  saving = false,
  generateLabel = 'Сформировать работу',
  generateDisabled = false,
  saveLabel = 'Сохранить',
  loadLabel = 'Открыть сохранённую',
}) => {
  const { canEdit } = useAuth();

  return (
    <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 8, alignItems: 'center' }}>

      {/* Основное действие */}
      {onGenerate && (
        <Button
          type="primary"
          htmlType="submit"
          icon={<ThunderboltOutlined />}
          loading={loading}
          size="large"
          disabled={generateDisabled}
        >
          {generateLabel}
        </Button>
      )}

      {/* Загрузить — всегда видна */}
      {onOpenLoad && (
        <Button
          icon={<FolderOpenOutlined />}
          onClick={onOpenLoad}
          size="large"
        >
          {loadLabel}
        </Button>
      )}

      {/* Вторичные действия — только при наличии вариантов */}
      {hasVariants && (
        <>
          <Divider type="vertical" style={{ height: 28, margin: '0 2px', borderColor: '#d9d9d9' }} />

          {/* Сохранить (только для editor+) */}
          {canEdit && onSave && (
            <Tooltip title={saveLabel}>
              <Button icon={<SaveOutlined />} onClick={onSave} loading={saving}>
                Сохранить
              </Button>
            </Tooltip>
          )}

          <Divider type="vertical" style={{ height: 28, margin: '0 2px', borderColor: '#d9d9d9' }} />

          {/* Печать */}
          {onPrint && (
            <Tooltip title="Открыть диалог печати браузера">
              <Button icon={<PrinterOutlined />} onClick={onPrint}>
                Печать
              </Button>
            </Tooltip>
          )}

          {/* PDF — клиентский экспорт через html2pdf */}
          {onExportPDF && (
            <Tooltip title="Скачать PDF (клиентский рендеринг)">
              <Button icon={<FilePdfOutlined />} onClick={onExportPDF} loading={exporting}>
                PDF
              </Button>
            </Tooltip>
          )}

          {/* Markdown */}
          {onExportMD && (
            <Tooltip title="Экспорт в Markdown (для Obsidian)">
              <Button icon={<FileMarkdownOutlined />} onClick={onExportMD}>
                MD
              </Button>
            </Tooltip>
          )}

          <Divider type="vertical" style={{ height: 28, margin: '0 2px', borderColor: '#d9d9d9' }} />

          {/* Сброс */}
          {onReset && (
            <Tooltip title="Сбросить всё">
              <Button icon={<DeleteOutlined />} onClick={onReset} danger />
            </Tooltip>
          )}
        </>
      )}
    </div>
  );
};

export default ActionButtons;
