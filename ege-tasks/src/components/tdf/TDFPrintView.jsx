import { useRef, useState } from 'react';
import { Button, Space, Typography, Segmented } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined, FilePdfOutlined } from '@ant-design/icons';
import { api } from '../../services/pocketbase';
import MathRenderer from '../../shared/components/MathRenderer';
import { usePuppeteerPDF } from '../../hooks/usePuppeteerPDF';
import './TDFPrintView.css';

const { Text } = Typography;

const TYPE_LABELS = {
  theorem: 'Теорема', definition: 'Определение', formula: 'Формула',
  axiom: 'Аксиома', property: 'Свойство', criterion: 'Признак', corollary: 'Следствие',
};

/**
 * Печатный вид ТДФ.
 *
 * mode="etalon" — полный конспект (все поля заполнены)
 * mode="blank"  — пустой вариант (только название, остальное — пустое место)
 */
export default function TDFPrintView({ tdfSet, items, mode, variantNumber, variantTitle, onBack }) {
  const printRef = useRef(null);
  const { exportToPDF, exporting } = usePuppeteerPDF();
  const [portrait, setPortrait] = useState(false);

  const isBlank = mode === 'blank';
  const today = new Date().toLocaleDateString('ru-RU');

  const handlePrint = () => {
    const style = document.createElement('style');
    style.textContent = `@page { size: A4 ${portrait ? 'portrait' : 'landscape'}; margin: 7mm 8mm 6mm; }`;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => document.head.removeChild(style), 1500);
  };

  const handleExportPDF = () => {
    const filename = isBlank
      ? `ТДФ_Вариант${variantNumber}_${tdfSet?.title || ''}.pdf`
      : `ТДФ_Конспект_${tdfSet?.title || ''}.pdf`;
    exportToPDF(printRef, filename, { format: 'A4', landscape: !portrait });
  };

  // Группировка пунктов по разделам (только для эталона)
  // Для бланка просто нумеруем подряд
  const renderRows = () => {
    let num = 0;
    return items.map((item, idx) => {
      if (item.is_section_header) {
        return (
          <tr key={item.id} className="tdf-section-header-row">
            <td colSpan={4} className="tdf-section-header-cell">
              {item.section_title}
            </td>
          </tr>
        );
      }
      num++;
      return (
        <tr key={item.id} className="tdf-item-row">
          <td className="tdf-cell tdf-cell-num">
            <div className="tdf-num-content">
              <span className="tdf-num-value">{num}</span>
              {item.type && <span className="tdf-type-vertical">{TYPE_LABELS[item.type]}</span>}
            </div>
          </td>
          <td className="tdf-cell tdf-cell-name-formulation">
            <div className="tdf-item-name">{item.name}</div>
            {isBlank ? (
              <div className="tdf-blank-area" />
            ) : (
              <div className="tdf-formulation-content tdf-math-content">
                {item.formulation_md
                  ? <MathRenderer content={item.formulation_md} />
                  : <span className="tdf-empty">—</span>}
              </div>
            )}
          </td>
          <td className="tdf-cell tdf-cell-drawing">
            {isBlank ? (
              <div className="tdf-blank-area" />
            ) : (
              item.drawing_image
                ? <img src={api.getTdfItemDrawingUrl(item)} alt="чертёж" className="tdf-drawing-img" />
                : <span className="tdf-empty">—</span>
            )}
          </td>
          <td className="tdf-cell tdf-cell-notation">
            {isBlank ? (
              <div className="tdf-blank-area" />
            ) : (
              <div className="tdf-math-content">
                {item.short_notation_md
                  ? <MathRenderer content={item.short_notation_md} />
                  : <span className="tdf-empty">—</span>}
              </div>
            )}
          </td>
        </tr>
      );
    });
  };

  return (
    <div className="tdf-print-wrapper">
      {/* Панель управления (не печатается) */}
      <div className="tdf-print-controls no-print">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={onBack}>Назад</Button>
          <Segmented
            value={portrait ? 'portrait' : 'landscape'}
            onChange={(v) => setPortrait(v === 'portrait')}
            options={[
              { label: 'Альбомная', value: 'landscape' },
              { label: 'Книжная', value: 'portrait' },
            ]}
          />
          <Button icon={<PrinterOutlined />} onClick={handlePrint}>Печать</Button>
          <Button icon={<FilePdfOutlined />} onClick={handleExportPDF} loading={exporting}>
            Скачать PDF
          </Button>
        </Space>
        <Text type="secondary" style={{ marginLeft: 16 }}>
          {isBlank ? `Вариант ${variantNumber}${variantTitle ? ' — ' + variantTitle : ''}` : 'Эталонный конспект'}
        </Text>
      </div>

      {/* Печатаемый контент */}
      <div ref={printRef} className={`tdf-print-page${portrait ? ' tdf-print-page--portrait' : ''}`}>
        {/* Шапка */}
        <div className="tdf-header">
          <div className="tdf-header-title">
            <strong>ТДФ: {tdfSet?.title}</strong>
            {tdfSet?.class_number && <span className="tdf-header-class"> — {tdfSet.class_number} класс</span>}
          </div>
          {isBlank ? (
            <div className="tdf-header-meta">
              <span>Вариант {variantNumber}{variantTitle ? ` — ${variantTitle}` : ''}</span>
              <span className="tdf-header-name-field">ФИО: ________________________</span>
              <span>Дата: {today}</span>
            </div>
          ) : null}
        </div>

        {/* Таблица */}
        <table className="tdf-table">
          <colgroup>
            <col style={{ width: '4%' }} />
            <col style={{ width: '42%' }} />
            <col style={{ width: '30%' }} />
            <col style={{ width: '24%' }} />
          </colgroup>
          <thead>
            <tr className="tdf-thead-row">
              <th className="tdf-th">№</th>
              <th className="tdf-th">Тема / Формулировка</th>
              <th className="tdf-th">Чертёж</th>
              <th className="tdf-th">Краткая запись</th>
            </tr>
          </thead>
          <tbody>
            {renderRows()}
          </tbody>
        </table>

        {/* Нижняя строка для бланка */}
        {isBlank && (
          <div className="tdf-footer">
            Оценка: _______
          </div>
        )}
      </div>
    </div>
  );
}
