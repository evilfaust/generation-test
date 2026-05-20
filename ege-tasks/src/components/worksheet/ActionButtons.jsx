import { Button, Space, Tooltip, Dropdown, Divider, Tag } from 'antd';
import {
  PrinterOutlined,
  FilePdfOutlined,
  FileMarkdownOutlined,
  SaveOutlined,
  FolderOpenOutlined,
  ThunderboltOutlined,
  DeleteOutlined,
  DownOutlined,
  CheckOutlined,
  RocketOutlined,
} from '@ant-design/icons';

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
  pdfMethod = 'puppeteer',
  setPdfMethod,
  puppeteerAvailable = true,
  exporting = false,
  saving = false,
  generateLabel = 'Сформировать работу',
  generateDisabled = false,
  saveLabel = 'Сохранить',
  loadLabel = 'Открыть сохранённую',
}) => {
  const pdfMenuItems = [
    {
      key: 'puppeteer',
      label: (
        <Space>
          {pdfMethod === 'puppeteer' && <CheckOutlined style={{ color: '#52c41a' }} />}
          <RocketOutlined style={{ color: '#52c41a' }} />
          <span>Высокое качество</span>
          {!puppeteerAvailable && <Tag color="error" style={{ marginLeft: 4 }}>недоступно</Tag>}
        </Space>
      ),
      disabled: !puppeteerAvailable,
    },
    {
      key: 'legacy',
      label: (
        <Space>
          {pdfMethod === 'legacy' && <CheckOutlined style={{ color: '#52c41a' }} />}
          <FilePdfOutlined />
          <span>Стандартный</span>
        </Space>
      ),
    },
  ];

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

          {/* Сохранить */}
          {onSave && (
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

          {/* PDF — кнопка с dropdown для выбора метода */}
          {onExportPDF && (
            setPdfMethod ? (
              <Dropdown.Button
                icon={<DownOutlined />}
                onClick={onExportPDF}
                loading={exporting}
                menu={{
                  items: pdfMenuItems,
                  onClick: ({ key }) => setPdfMethod(key),
                }}
              >
                <FilePdfOutlined />
                {' PDF'}
                {pdfMethod === 'puppeteer' && puppeteerAvailable && (
                  <RocketOutlined style={{ color: '#52c41a', marginLeft: 4, fontSize: 11 }} />
                )}
              </Dropdown.Button>
            ) : (
              <Button icon={<FilePdfOutlined />} onClick={onExportPDF} loading={exporting}>
                PDF
              </Button>
            )
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
