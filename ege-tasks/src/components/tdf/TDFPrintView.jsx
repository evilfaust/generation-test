import { useRef, useState, useLayoutEffect } from 'react';
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

const MM_TO_PX = 3.7795;

/**
 * Распределяет items по страницам на основе замеренных высот строк.
 * Возвращает массив страниц — каждая страница = массив items.
 */
function paginateByHeight(items, heights, rowAreaPx) {
  const pages = [];
  let current = [];
  let usedPx = 0;

  for (const item of items) {
    const h = heights[item.id] ?? 50;
    // Если строка не влезает и страница не пустая — переходим на следующую
    if (current.length > 0 && usedPx + h > rowAreaPx) {
      pages.push(current);
      current = [];
      usedPx = 0;
    }
    current.push(item);
    usedPx += h;
  }
  if (current.length > 0) pages.push(current);
  return pages.length > 0 ? pages : [[]];
}

/**
 * Печатный вид ТДФ — КИМ-паттерн.
 *
 * Двухфазный рендер:
 *  1. «measure»: все строки рендерятся в скрытый блок → useLayoutEffect замеряет offsetHeight
 *  2. «render»: строки распределяются по страницам-div с фиксированным размером A4
 *
 * @page { margin: 0 } + break-after: page — каждая страница точно соответствует листу A4.
 */
export default function TDFPrintView({ tdfSet, items, mode, variantNumber, variantTitle, onBack }) {
  const printRef = useRef(null);
  const rowRefs = useRef({});
  const { exportToPDF, exporting } = usePuppeteerPDF();

  const [portrait, setPortrait] = useState(false);
  const [drawingSize, setDrawingSize] = useState('m');
  const [pagination, setPagination] = useState({ key: null, pages: null });

  const isBlank = mode === 'blank';
  const today = new Date().toLocaleDateString('ru-RU');

  const DRAWING_CFG = {
    s:  { drawingCol: '22%', contentCol: '50%', notationCol: '24%', imgH: portrait ?  50 :  60 },
    m:  { drawingCol: '30%', contentCol: '42%', notationCol: '24%', imgH: portrait ?  65 :  90 },
    l:  { drawingCol: '42%', contentCol: '34%', notationCol: '20%', imgH: portrait ? 120 : 160 },
    xl: { drawingCol: '54%', contentCol: '28%', notationCol: '14%', imgH: portrait ? 170 : 230 },
  };
  const dcfg = DRAWING_CFG[drawingSize];

  // Ключ пересчёта: меняется при изменении контента, ориентации, размера чертежей, режима
  const paginationKey = [
    items.map(i => i.id).join(','),
    drawingSize,
    portrait ? 'p' : 'l',
    isBlank ? 'blank' : 'etalon',
  ].join('|');
  const needsMeasure = pagination.key !== paginationKey;

  // Доступная высота для строк tbody на странице (px)
  // A4 landscape: 210mm, portrait: 297mm
  // padding top: 8mm, bottom: 5mm
  // doc-header строка: ~10mm, col-header строка: ~8mm
  const pageHeightMm = portrait ? 297 : 210;
  const rowAreaPx = (pageHeightMm - 8 - 5 - 10 - 8) * MM_TO_PX;

  // Фаза 1 → Фаза 2: замеряем высоты сразу после рендера скрытого блока
  useLayoutEffect(() => {
    if (!needsMeasure) return;
    const heights = {};
    items.forEach(item => {
      const el = rowRefs.current[item.id];
      if (el) heights[item.id] = el.offsetHeight;
    });
    setPagination({ key: paginationKey, pages: paginateByHeight(items, heights, rowAreaPx) });
  });

  const handlePrint = () => {
    const style = document.createElement('style');
    style.textContent = `@page { size: A4 ${portrait ? 'portrait' : 'landscape'}; margin: 0; }`;
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

  // ── Переиспользуемые части ──────────────────────────────────────────────────

  const colgroup = (
    <colgroup>
      <col style={{ width: '4%' }} />
      <col style={{ width: dcfg.contentCol }} />
      <col style={{ width: dcfg.drawingCol }} />
      <col style={{ width: dcfg.notationCol }} />
    </colgroup>
  );

  const renderRow = (item, num, refCb) => {
    if (item.is_section_header) {
      return (
        <tr key={item.id} ref={refCb} className="tdf-section-header-row">
          <td colSpan={4} className="tdf-section-header-cell">{item.section_title}</td>
        </tr>
      );
    }
    return (
      <tr key={item.id} ref={refCb} className="tdf-item-row">
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
              ? <img src={api.getTdfItemDrawingUrl(item)} alt="чертёж" className="tdf-drawing-img" style={{ maxHeight: dcfg.imgH }} />
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
  };

  const controls = (
    <div className="tdf-print-controls no-print">
      <Space>
        <Button icon={<ArrowLeftOutlined />} onClick={onBack}>Назад</Button>
        <Segmented
          value={portrait ? 'portrait' : 'landscape'}
          onChange={v => setPortrait(v === 'portrait')}
          options={[
            { label: 'Альбомная', value: 'landscape' },
            { label: 'Книжная', value: 'portrait' },
          ]}
        />
        <Segmented
          value={drawingSize}
          onChange={setDrawingSize}
          options={[
            { label: 'Чертёж S', value: 's' },
            { label: 'Чертёж M', value: 'm' },
            { label: 'Чертёж L', value: 'l' },
            { label: 'Чертёж XL', value: 'xl' },
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
  );

  // ── Фаза 1: скрытый рендер для замера высот ────────────────────────────────
  if (needsMeasure) {
    let measureNum = 0;
    return (
      <div className="tdf-print-wrapper">
        {controls}
        <div className={`tdf-measure-root${portrait ? ' tdf-measure-root--portrait' : ''}`}>
          <table className="tdf-table">
            {colgroup}
            <tbody>
              {items.map(item => {
                if (!item.is_section_header) measureNum++;
                return renderRow(item, measureNum, el => { rowRefs.current[item.id] = el; });
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── Фаза 2: рендер постраничного вывода ────────────────────────────────────
  const { pages } = pagination;
  let globalNum = 0; // сквозной номер пунктов через все страницы

  return (
    <div className="tdf-print-wrapper">
      {controls}
      <div ref={printRef} className="tdf-print-book">
        {pages.map((pageItems, pageIdx) => (
          <div key={pageIdx} className={`tdf-print-page${portrait ? ' tdf-print-page--portrait' : ''}`}>
            <table className="tdf-table">
              {colgroup}
              <thead>
                {/* Заголовок документа — на каждой странице */}
                <tr>
                  <td colSpan={4} className="tdf-doc-header-cell">
                    <div className="tdf-doc-header-inner">
                      <div className="tdf-header-title">
                        <strong>ТДФ: {tdfSet?.title}</strong>
                        {tdfSet?.class_number && (
                          <span className="tdf-header-class"> — {tdfSet.class_number} класс</span>
                        )}
                      </div>
                      {isBlank && (
                        <div className="tdf-header-meta">
                          <span>Вариант {variantNumber}{variantTitle ? ` — ${variantTitle}` : ''}</span>
                          <span className="tdf-header-name-field">ФИО: ________________________</span>
                          <span>Дата: {today}</span>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
                {/* Заголовки колонок */}
                <tr className="tdf-thead-row">
                  <th className="tdf-th">№</th>
                  <th className="tdf-th">Тема / Формулировка</th>
                  <th className="tdf-th">Чертёж</th>
                  <th className="tdf-th">Краткая запись</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map(item => {
                  if (!item.is_section_header) globalNum++;
                  return renderRow(item, globalNum);
                })}
              </tbody>
            </table>
            {isBlank && pageIdx === pages.length - 1 && (
              <div className="tdf-footer">Оценка: _______</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
