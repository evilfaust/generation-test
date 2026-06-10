import { useRef, useState } from 'react';
import { Button, Card, Radio, Select, Space, Switch, Tooltip } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined, FilePdfOutlined } from '@ant-design/icons';
import VariantRenderer from './VariantRenderer';
import AnswersPage from './AnswersPage';
import { useWorksheetActions } from '../../hooks';
import '../TaskWorksheet.css';
import './WorkPrintPreview.css';

/**
 * Полноэкранный предпросмотр печати сохранённой работы (из WorkEditor).
 * Переиспользует печатный стек генераторов: VariantRenderer + AnswersPage +
 * useWorksheetActions (window.print / клиентский html2pdf).
 *
 * Scoped print: body:has(.wpv-overlay) — печатается только .wpv-print-root.
 *
 * @param {object} work - работа (нужен title)
 * @param {Array} variants - [{ number, tasks }]
 * @param {function} onClose
 */
export default function WorkPrintPreview({ work, variants = [], onClose }) {
  const printRef = useRef(null);
  const { handlePrint, handleExportPDF, exporting } = useWorksheetActions();

  const [fontSize, setFontSize] = useState(12);
  const [columns, setColumns] = useState(1);
  const [solutionSpace, setSolutionSpace] = useState('medium');
  const [compactMode, setCompactMode] = useState(false);
  const [showStudentInfo, setShowStudentInfo] = useState(true);
  const [showAnswersInline, setShowAnswersInline] = useState(false);
  const [showAnswersPage, setShowAnswersPage] = useState(true);
  const [hideTaskPrefixes, setHideTaskPrefixes] = useState(false);

  const title = work?.title || 'Контрольная работа';

  return (
    <div className="wpv-overlay">
      <Card
        size="small"
        className="wpv-toolbar no-print"
        styles={{ body: { padding: '10px 14px' } }}
      >
        <Space wrap align="center" style={{ width: '100%' }}>
          <Button icon={<ArrowLeftOutlined />} onClick={onClose}>
            Назад к редактору
          </Button>
          <span style={{ fontWeight: 600 }}>{title}</span>

          <Radio.Group
            size="small"
            value={fontSize}
            onChange={(e) => setFontSize(e.target.value)}
            buttonStyle="solid"
          >
            <Radio.Button value={10}>10pt</Radio.Button>
            <Radio.Button value={12}>12pt</Radio.Button>
            <Radio.Button value={14}>14pt</Radio.Button>
          </Radio.Group>

          <Radio.Group
            size="small"
            value={columns}
            onChange={(e) => setColumns(e.target.value)}
            buttonStyle="solid"
          >
            <Radio.Button value={1}>1 колонка</Radio.Button>
            <Radio.Button value={2}>2 колонки</Radio.Button>
          </Radio.Group>

          <Select
            size="small"
            value={solutionSpace}
            onChange={setSolutionSpace}
            style={{ width: 170 }}
            options={[
              { value: 'none', label: 'Без места решения' },
              { value: 'small', label: 'Решение — мало' },
              { value: 'medium', label: 'Решение — средне' },
              { value: 'large', label: 'Решение — много' },
            ]}
          />

          <Tooltip title="Компактный режим — плотный список с полем для ответа">
            <span style={{ fontSize: 13 }}>
              <Switch size="small" checked={compactMode} onChange={setCompactMode} /> компактно
            </span>
          </Tooltip>
          <span style={{ fontSize: 13 }}>
            <Switch size="small" checked={showStudentInfo} onChange={setShowStudentInfo} /> ФИО
          </span>
          <span style={{ fontSize: 13 }}>
            <Switch size="small" checked={showAnswersInline} onChange={setShowAnswersInline} /> ответы в тексте
          </span>
          <span style={{ fontSize: 13 }}>
            <Switch size="small" checked={showAnswersPage} onChange={setShowAnswersPage} /> лист ответов
          </span>
          <Tooltip title="Скрывать типовые фразы («Вычислите», «Найдите»…)">
            <span style={{ fontSize: 13 }}>
              <Switch size="small" checked={hideTaskPrefixes} onChange={setHideTaskPrefixes} /> без префиксов
            </span>
          </Tooltip>

          <Space style={{ marginLeft: 'auto' }}>
            <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>
              Печать
            </Button>
            <Button
              icon={<FilePdfOutlined />}
              loading={exporting}
              onClick={() => handleExportPDF(printRef, title)}
            >
              PDF
            </Button>
          </Space>
        </Space>
      </Card>

      <div className="wpv-sheet">
        <div ref={printRef} className="wpv-print-root">
          {variants.map((variant, idx) => (
            <VariantRenderer
              key={variant.number || idx}
              variant={variant}
              variantIndex={idx}
              compactMode={compactMode}
              fontSize={fontSize}
              columns={columns}
              showStudentInfo={showStudentInfo}
              showAnswersInline={showAnswersInline}
              solutionSpace={solutionSpace}
              variantLabel="Вариант"
              hideTaskPrefixes={hideTaskPrefixes}
            />
          ))}
          <AnswersPage variants={variants} variantLabel="Вариант" show={showAnswersPage} />
        </div>
      </div>
    </div>
  );
}
