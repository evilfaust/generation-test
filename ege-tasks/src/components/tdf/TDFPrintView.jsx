import { useRef, useState, useLayoutEffect } from 'react';
import { Button, Space, Typography, Segmented } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import { api } from '../../services/pocketbase';
import MathRenderer from '../../shared/components/MathRenderer';
import './TDFPrintView.css';

const { Text } = Typography;

const TYPE_LABELS = {
  theorem: 'Теорема', definition: 'Определение', formula: 'Формула',
  axiom: 'Аксиома', property: 'Свойство', criterion: 'Признак', corollary: 'Следствие',
  geometry_formula: 'Геом. формула',
};

const MM_TO_PX = 3.7795; // фолбэк, если measureRootRef не готов

const PX_PER_MM = 3.7795;

// Клетка 5 мм — канонический паттерн (div-линии с физическими mm-единицами →
// нативный вектор в PDF). Кол-во линий считаем ТОЧНО под размер поля (как в
// GeometryWorksheetPrint), с минимальным запасом +2 — без огромного перерасхода
// (он ломал расчёт печатной области в Chrome). Лишнее клипуется overflow:hidden.
function GridLines({ h, v }) {
  return (
    <div className="tdf-grid-lines">
      {Array.from({ length: h }, (_, i) => (
        <div key={`h${i}`} className="tdf-h-line" style={{ top: `${(i + 1) * 5}mm` }} />
      ))}
      {Array.from({ length: v }, (_, i) => (
        <div key={`v${i}`} className="tdf-v-line" style={{ left: `${(i + 1) * 5}mm` }} />
      ))}
    </div>
  );
}

const COUNT_LABELS = ['формула', 'формулы', 'формул'];
function pluralRu(n, forms) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

/**
 * Разбирает short_notation_md на список формул.
 * Каждая непустая строка/абзац — отдельная формула.
 * Из каждой извлекается LHS (левая часть до первого `=`).
 *
 * Пример входа: "$S = \\frac{(a+b)}{2} \\cdot h$\n$S = m h, m = \\frac{a+b}{2}$"
 * Выход: [
 *   { full: "$S = \\frac{(a+b)}{2} \\cdot h$", lhs: "$S =$" },
 *   { full: "$S = m h, ...", lhs: "$S =$" },
 * ]
 */
function parseFormulas(md) {
  if (!md || !md.trim()) return [{ full: '', lhs: '$S =$' }];
  const lines = md.split(/\n\s*\n|\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [{ full: '', lhs: '$S =$' }];
  return lines.map(line => {
    // Снимаем внешние $...$ если есть, ищем "X =" до первого знака равенства
    const stripped = line.replace(/^\$+|\$+$/g, '').trim();
    const m = /^(.+?)=/.exec(stripped);
    const lhs = m ? `$${m[1].trim()} =$` : '$S =$';
    return { full: line, lhs };
  });
}

/**
 * Жадно распределяет items по страницам.
 * Страница 1 учитывает заголовок (firstPageAreaPx), страницы 2+ — полную высоту (otherPageAreaPx).
 */
function paginateByHeight(items, heights, firstPageAreaPx, otherPageAreaPx) {
  const pages = [];
  let current = [];
  let usedPx = 0;

  for (const item of items) {
    const h = heights[item.id] ?? 50;
    const areaForPage = pages.length === 0 ? firstPageAreaPx : otherPageAreaPx;
    if (current.length > 0 && usedPx + h > areaForPage) {
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
 *     pxPerMm берётся из measureRootRef.offsetWidth / pageWidthMm (точный замер контейнера)
 *  2. «render»: строки распределяются по страницам с фиксированным размером A4
 *
 * Stretch-режим (только для blank): 2 страницы, строки растянуты равномерно.
 */
export default function TDFPrintView({ tdfSet, items, mode, variantNumber, variantTitle, onBack }) {
  const printRef = useRef(null);
  const rowRefs = useRef({});
  const theadRef = useRef(null);
  const measureRootRef = useRef(null); // точный источник pxPerMm

  const [portrait, setPortrait] = useState(false);
  const [drawingSize, setDrawingSize] = useState('m');
  const [stretchMode, setStretchMode] = useState(false); // blank: 1 vs 2 листа
  const [showGrid, setShowGrid] = useState(false);       // blank: сетка в ячейках
  const [pagination, setPagination] = useState({ key: null, pages: null, stretchRowH: null });
  const [geoStripsPerPage, setGeoStripsPerPage] = useState(2); // geo: 1 или 2 полоски на A4

  const isBlank = mode === 'blank';

  // Если в варианте только геом. формулы и режим — контроль, используем
  // спец. компактный формат: A4 portrait, поделенный на N полосок-вариантов
  const nonHeaderItems = items.filter(i => !i.is_section_header);
  const isAllGeoFormula = nonHeaderItems.length > 0
    && nonHeaderItems.every(i => i.type === 'geometry_formula');
  const useGeoLayout = isAllGeoFormula && isBlank;

  const DRAWING_CFG = {
    s:  { drawingCol: '22%', contentCol: '50%', notationCol: '24%', imgH: portrait ?  50 :  60 },
    m:  { drawingCol: '30%', contentCol: '42%', notationCol: '24%', imgH: portrait ?  65 :  90 },
    l:  { drawingCol: '42%', contentCol: '34%', notationCol: '20%', imgH: portrait ? 120 : 160 },
    xl: { drawingCol: '54%', contentCol: '28%', notationCol: '14%', imgH: portrait ? 170 : 230 },
  };
  const dcfg = DRAWING_CFG[drawingSize];

  const paginationKey = [
    items.map(i => i.id).join(','),
    drawingSize,
    portrait ? 'p' : 'l',
    isBlank ? 'blank' : 'etalon',
    stretchMode ? 'stretch' : 'compact',
  ].join('|');
  const needsMeasure = pagination.key !== paginationKey;

  const pageWidthMm  = portrait ? 210 : 297;
  const pageHeightMm = portrait ? 297 : 210;

  useLayoutEffect(() => {
    if (useGeoLayout) return;       // в гео-режиме измерения не нужны
    if (!needsMeasure) return;

    // Точный px/mm: берём реальную ширину контейнера-измерителя в px и делим на известную ширину в mm
    const pxPerMm = measureRootRef.current
      ? measureRootRef.current.offsetWidth / pageWidthMm
      : MM_TO_PX;

    const heights = {};
    items.forEach(item => {
      const el = rowRefs.current[item.id];
      if (el) heights[item.id] = el.offsetHeight;
    });

    const theadH = theadRef.current ? theadRef.current.offsetHeight : 70;
    const pageContentPx = (pageHeightMm - 10) * pxPerMm; // 10 = 5mm top + 5mm bottom padding

    const firstPageAreaPx = pageContentPx - theadH;
    const otherPageAreaPx = pageContentPx;

    // Определяем распределение items по страницам
    let pages;
    if (isBlank && stretchMode) {
      // «2 листа»: ровно 2 страницы, пополам
      const n = items.length;
      if (n === 0) { setPagination({ key: paginationKey, pages: [[]], stretchRowH: null }); return; }
      const n1 = Math.ceil(n / 2);
      pages = n > n1 ? [items.slice(0, n1), items.slice(n1)] : [items.slice(0, n1)];
    } else {
      // «1 лист» / эталон: умная пагинация по высоте
      pages = paginateByHeight(items, heights, firstPageAreaPx, otherPageAreaPx);
    }

    // В blank-режиме всегда растягиваем строки до заполнения страницы
    const STRETCH_SAFETY_PX = Math.ceil(2 * pxPerMm); // ~8px запас на различия экран↔печать
    const stretchRowH = isBlank
      ? pages.map((pageItems, pageIdx) => {
          const n = Math.max(pageItems.length, 1);
          const availH = (pageIdx === 0 ? firstPageAreaPx : otherPageAreaPx) - STRETCH_SAFETY_PX;
          return Math.floor(availH / n);
        })
      : null;

    setPagination({ key: paginationKey, pages, stretchRowH });
  });

  const handlePrint = () => {
    const orientation = useGeoLayout ? 'portrait' : (portrait ? 'portrait' : 'landscape');
    const style = document.createElement('style');
    style.textContent = `@page { size: A4 ${orientation}; margin: 0; }`;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => document.head.removeChild(style), 1500);
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

  const renderRow = (item, num, refCb, rowHeight) => {
    const rowStyle = rowHeight ? { height: rowHeight } : undefined;
    const gridOn = showGrid && isBlank;

    // Высота клеточного поля в px. В фазе 2 строка имеет точную высоту
    // (rowHeight = stretchRowH), поэтому полю задаём ЯВНУЮ высоту (минус padding
    // ячейки) — это надёжно заполняет ячейку, в отличие от height:100%, которое
    // не резолвится внутри table-cell. В фазе измерения (rowHeight undefined)
    // высоту даёт min-height из CSS. Линии клетки — div с физическими mm
    // (нативный вектор в PDF), лежат absolute внутри positioned-div (НЕ <td>:
    // relative на ячейке ломает table-layout при печати).
    const fieldHpx = rowHeight ? Math.max(40, rowHeight - 12) : null;
    const fieldStyle = fieldHpx ? { height: `${fieldHpx}px`, minHeight: 0 } : undefined;

    // Точное число линий клетки под размер поля (+2 запас), без перерасхода —
    // огромный overshoot ломал расчёт печатной области в Chrome (масштаб < 1).
    const usableMm = (portrait ? 210 : 297) - 10; // ширина листа минус поля 5мм
    const fieldHmm = fieldHpx ? fieldHpx / PX_PER_MM : 60;
    const hCount = Math.ceil(fieldHmm / 5) + 2;
    const vCount = (colPct) => Math.ceil((parseFloat(colPct) / 100 * usableMm) / 5) + 2;

    // Поле для записи в drawing/notation ячейках (без имени).
    const writeField = (colPct) => gridOn
      ? <div className="tdf-grid-field" style={fieldStyle}><GridLines h={hCount} v={vCount(colPct)} /></div>
      : <div className="tdf-blank-area" />;

    if (item.is_section_header) {
      return (
        <tr key={item.id} ref={refCb} style={rowStyle} className="tdf-section-header-row">
          <td colSpan={4} className="tdf-section-header-cell">{item.section_title}</td>
        </tr>
      );
    }

    // ── Геометрическая формула: особый рендер ───────────────────────────────
    if (item.type === 'geometry_formula') {
      const formulaHidden = isBlank && (item.formula_control_hidden !== false);

      // В blank-режиме — контрольный чертёж (частичный), в etalon — полный
      const drawingCell = isBlank
        ? (item.drawing_image_control
            ? <img src={api.getTdfItemControlDrawingUrl(item)} alt="контроль" className="tdf-drawing-img" style={{ maxHeight: dcfg.imgH }} />
            : writeField(dcfg.drawingCol))
        : (item.drawing_image
            ? <img src={api.getTdfItemDrawingUrl(item)} alt="подготовка" className="tdf-drawing-img" style={{ maxHeight: dcfg.imgH }} />
            : <span className="tdf-empty">—</span>);

      return (
        <tr key={item.id} ref={refCb} style={rowStyle} className="tdf-item-row">
          <td className="tdf-cell tdf-cell-num">
            <div className="tdf-num-content">
              <span className="tdf-num-value">{num}</span>
              <span className="tdf-type-vertical">{TYPE_LABELS.geometry_formula}</span>
            </div>
          </td>
          <td className="tdf-cell tdf-cell-name-formulation">
            <div className="tdf-item-name">{item.name}</div>
          </td>
          <td className="tdf-cell tdf-cell-drawing">
            {drawingCell}
          </td>
          <td className="tdf-cell tdf-cell-notation">
            {formulaHidden ? (
              writeField(dcfg.notationCol)
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
    }

    // ── Стандартный пункт ТДФ ───────────────────────────────────────────────
    return (
      <tr key={item.id} ref={refCb} style={rowStyle} className="tdf-item-row">
        <td className="tdf-cell tdf-cell-num">
          <div className="tdf-num-content">
            <span className="tdf-num-value">{num}</span>
            {item.type && <span className="tdf-type-vertical">{TYPE_LABELS[item.type]}</span>}
          </div>
        </td>
        <td className="tdf-cell tdf-cell-name-formulation">
          {isBlank ? (
            // Клетка + имя оверлеем поверх неё (имя на белом фоне, поверх линий)
            gridOn ? (
              <div className="tdf-grid-field" style={fieldStyle}>
                <GridLines h={hCount} v={vCount(dcfg.contentCol)} />
                <div className="tdf-item-name tdf-item-name--overlay">{item.name}</div>
              </div>
            ) : (
              <>
                <div className="tdf-item-name">{item.name}</div>
                <div className="tdf-blank-area" />
              </>
            )
          ) : (
            <>
              <div className="tdf-item-name">{item.name}</div>
              <div className="tdf-formulation-content tdf-math-content">
                {item.formulation_md
                  ? <MathRenderer content={item.formulation_md} />
                  : <span className="tdf-empty">—</span>}
              </div>
            </>
          )}
        </td>
        <td className="tdf-cell tdf-cell-drawing">
          {isBlank ? (
            writeField(dcfg.drawingCol)
          ) : (
            item.drawing_image
              ? <img src={api.getTdfItemDrawingUrl(item)} alt="чертёж" className="tdf-drawing-img" style={{ maxHeight: dcfg.imgH }} />
              : <span className="tdf-empty">—</span>
          )}
        </td>
        <td className="tdf-cell tdf-cell-notation">
          {isBlank ? (
            writeField(dcfg.notationCol)
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

  const docHeader = (
    <thead ref={theadRef}>
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
                <span>Дата: ____________</span>
              </div>
            )}
          </div>
        </td>
      </tr>
      <tr className="tdf-thead-row">
        <th className="tdf-th">№</th>
        <th className="tdf-th">Тема / Формулировка</th>
        <th className="tdf-th">Чертёж</th>
        <th className="tdf-th">Краткая запись</th>
      </tr>
    </thead>
  );

  const controls = (
    <div className="tdf-print-controls no-print">
      <Space wrap>
        <Button icon={<ArrowLeftOutlined />} onClick={onBack}>Назад</Button>
        {useGeoLayout ? (
          <Segmented
            value={String(geoStripsPerPage)}
            onChange={v => setGeoStripsPerPage(Number(v))}
            options={[
              { label: '1 полоска', value: '1' },
              { label: '2 полоски', value: '2' },
            ]}
          />
        ) : (
          <>
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
            {isBlank && (
              <>
                <Segmented
                  value={stretchMode ? '2' : '1'}
                  onChange={v => setStretchMode(v === '2')}
                  options={[
                    { label: '1 лист', value: '1' },
                    { label: '2 листа', value: '2' },
                  ]}
                />
                <Segmented
                  value={showGrid ? 'grid' : 'plain'}
                  onChange={v => setShowGrid(v === 'grid')}
                  options={[
                    { label: 'Без сетки', value: 'plain' },
                    { label: 'В клетку', value: 'grid' },
                  ]}
                />
              </>
            )}
          </>
        )}
        <Button icon={<PrinterOutlined />} onClick={handlePrint}>Печать</Button>
      </Space>
      <Text type="secondary" style={{ marginLeft: 16 }}>
        {isBlank ? `Вариант ${variantNumber}${variantTitle ? ' — ' + variantTitle : ''}` : 'Эталонный конспект'}
      </Text>
    </div>
  );

  // ── Гео-формат: компактные полоски-варианты на A4 portrait ────────────────
  if (useGeoLayout) {
    const stripTitle = (variantTitle || tdfSet?.title || '').trim();
    const stripsArr = Array.from({ length: geoStripsPerPage }, (_, idx) => (
      <div key={idx} className="tdf-geo-strip">
        <h2 className="tdf-geo-title">{stripTitle}</h2>
        <div className="tdf-geo-fio">
          <span>ФИ</span>
          <span className="tdf-geo-fio-line" />
        </div>
        <ol className="tdf-geo-list">
          {nonHeaderItems.map((item, i) => {
            const showFormula = item.formula_control_hidden === false;
            const formulas = parseFormulas(item.short_notation_md);
            const multi = formulas.length > 1;
            return (
              <li key={item.id} className="tdf-geo-item">
                <span className="tdf-geo-num">{i + 1}).</span>
                <div className="tdf-geo-figure">
                  {item.drawing_image_control
                    ? <img src={api.getTdfItemControlDrawingUrl(item)} alt="" />
                    : <div className="tdf-geo-figure--empty" />}
                </div>
                <div className="tdf-geo-formulas">
                  {item.name && (
                    <div className="tdf-geo-name">{item.name}</div>
                  )}
                  {multi && (
                    <div className="tdf-geo-hint">
                      Запишите {formulas.length} {pluralRu(formulas.length, COUNT_LABELS)}:
                    </div>
                  )}
                  {showFormula && item.short_notation_md ? (
                    <div className="tdf-geo-formula-shown">
                      <MathRenderer content={item.short_notation_md} />
                    </div>
                  ) : (
                    formulas.map((f, idx) => (
                      <div key={idx} className="tdf-geo-formula-row">
                        <span className="tdf-geo-formula-lhs">
                          <MathRenderer content={f.lhs} />
                        </span>
                        <span className="tdf-geo-formula-line" />
                      </div>
                    ))
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    ));

    return (
      <div className="tdf-print-wrapper">
        {controls}
        <div ref={printRef} className="tdf-print-book">
          <div className="tdf-print-page tdf-print-page--geo">
            {stripsArr}
          </div>
        </div>
      </div>
    );
  }

  // ── Фаза 1: скрытый рендер для замера высот ─────────────────────────────────
  if (needsMeasure) {
    let measureNum = 0;
    return (
      <div className="tdf-print-wrapper">
        {controls}
        <div
          ref={measureRootRef}
          className={`tdf-measure-root${portrait ? ' tdf-measure-root--portrait' : ''}`}
        >
          <table className="tdf-table">
            {colgroup}
            {docHeader}
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

  // ── Фаза 2: рендер постраничного вывода ─────────────────────────────────────
  const { pages, stretchRowH } = pagination;
  let globalNum = 0;

  return (
    <div className="tdf-print-wrapper">
      {controls}
      <div ref={printRef} className="tdf-print-book">
        {pages.map((pageItems, pageIdx) => (
          <div key={pageIdx} className={`tdf-print-page${portrait ? ' tdf-print-page--portrait' : ''}`}>
            <table className={`tdf-table${stretchRowH ? ' tdf-table--stretch' : ''}`}>
              {colgroup}
              {pageIdx === 0 && docHeader}
              <tbody>
                {pageItems.map(item => {
                  if (!item.is_section_header) globalNum++;
                  const rowH = stretchRowH ? stretchRowH[pageIdx] : undefined;
                  return renderRow(item, globalNum, undefined, rowH);
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
