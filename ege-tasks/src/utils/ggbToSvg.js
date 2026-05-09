/**
 * Конвертер GeoGebra XML → SVG через JSXGraph.
 *
 * Принимает строку XML из `ggbApi.getXML()`.
 * Возвращает SVG-строку, готовую к хранению в drawing_svg.
 *
 * Поддерживаемые объекты: point, segment, ray, line, polygon, angle.
 * Скрытые объекты (show object="false") игнорируются.
 */

import JXG from 'jsxgraph';

// ── Вспомогательные функции ────────────────────────────────────────────────────

const SUB_DIGITS = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
                     '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };

function toUnicodeSub(s) {
  return s.split('').map((c) => SUB_DIGITS[c] ?? c).join('');
}

function normalizeLabel(label) {
  return label
    .replace(/_{([^}]+)}/g, (_, g) => toUnicodeSub(g))
    .replace(/_(\w)/g, (_, g) => toUnicodeSub(g));
}

function parseColor(el) {
  if (!el) return 'rgb(0,0,0)';
  return `rgb(${el.getAttribute('r') ?? 0},${el.getAttribute('g') ?? 0},${el.getAttribute('b') ?? 0})`;
}

function parseLineStyle(el) {
  if (!el) return { dash: 0, strokeWidth: 1 };
  const type      = parseInt(el.getAttribute('type')      ?? '0');
  const thickness = parseInt(el.getAttribute('thickness') ?? '2');
  return {
    dash:        type === 15 ? 2 : 0,
    strokeWidth: Math.max(0.5, thickness / 2),
  };
}

// ── Парсинг XML ────────────────────────────────────────────────────────────────

function parseXml(xmlString) {
  const doc = new DOMParser().parseFromString(xmlString, 'text/xml');

  // ── Координатная система ────────────────────────────────────────────────────
  const csEl   = doc.querySelector('euclidianView coordSystem');
  const sizeEl = doc.querySelector('euclidianView size');
  const xZero  = parseFloat(csEl?.getAttribute('xZero')  ?? '300');
  const yZero  = parseFloat(csEl?.getAttribute('yZero')  ?? '300');
  const scale  = parseFloat(csEl?.getAttribute('scale')  ?? '50');
  // GeoGebra может хранить разный масштаб по X и Y (обычно совпадают, но не всегда)
  const yscale = parseFloat(csEl?.getAttribute('yscale') ?? String(scale));
  const viewW  = parseInt(sizeEl?.getAttribute('width')  ?? '600');
  const viewH  = parseInt(sizeEl?.getAttribute('height') ?? '500');

  // JSXGraph boundingbox: [xMin, yMax, xMax, yMin] в математических координатах
  const bbox = [
    -xZero / scale,
    yZero  / yscale,
    (viewW - xZero) / scale,
    -(viewH - yZero) / yscale,
  ];

  // ── Свойства элементов ──────────────────────────────────────────────────────
  const elProps = {};
  doc.querySelectorAll('construction > element').forEach((el) => {
    const label = el.getAttribute('label');
    if (!label) return;

    const showEl  = el.querySelector('show');
    const colorEl = el.querySelector('objColor');
    const lsEl    = el.querySelector('lineStyle');
    const coordEl = el.querySelector('coords');
    const psEl    = el.querySelector('pointSize');
    const arcEl   = el.querySelector('arcSize');
    const decEl   = el.querySelector('decoration');
    const loEl    = el.querySelector('labelOffset');

    const lmEl = el.querySelector('labelMode');
    const asEl = el.querySelector('angleStyle');
    elProps[label] = {
      type:       el.getAttribute('type'),
      visible:    showEl?.getAttribute('object') === 'true',
      showLabel:  showEl?.getAttribute('label')  === 'true',
      labelMode:  parseInt(lmEl?.getAttribute('val') ?? '0'),  // 0=name,1=name+val,2=val,3=caption
      // angleStyle: 0=CCW (по умолч.), 1=CW (меняем местами from/to при рендере)
      angleStyle: parseInt(asEl?.getAttribute('val') ?? '0'),
      color:      parseColor(colorEl),
      alpha:      parseFloat(colorEl?.getAttribute('alpha') ?? '0'),
      lineStyle:  parseLineStyle(lsEl),
      pointSize:  parseInt(psEl?.getAttribute('val') ?? '5'),
      arcSize:    parseInt(arcEl?.getAttribute('val') ?? '30'),
      decoration: parseInt(decEl?.getAttribute('type') ?? '0'),
      labelOffset: loEl
        ? { x: parseInt(loEl.getAttribute('x') ?? '0'), y: parseInt(loEl.getAttribute('y') ?? '0') }
        : { x: 5, y: -16 },  // GeoGebra default: над точкой справа
      coords: coordEl
        ? {
            x: parseFloat(coordEl.getAttribute('x') ?? '0'),
            y: parseFloat(coordEl.getAttribute('y') ?? '0'),
            z: parseFloat(coordEl.getAttribute('z') ?? '1'),
          }
        : null,
    };
  });

  // ── Карта <expression>: label → exp (GeoGebra 6 хранит текст так) ────────────
  // Пример: <expression label="text1" exp="&quot;7{,}8&quot;"/>
  const exprByLabel = {};
  doc.querySelectorAll('construction > expression').forEach((ex) => {
    const label = ex.getAttribute('label');
    const exp   = ex.getAttribute('exp') ?? '';
    if (label) exprByLabel[label] = exp;
  });

  // ── Команды: output label → { name, inputs, idx } ──────────────────────────
  const cmdByOutput = {};
  doc.querySelectorAll('construction > command').forEach((cmd) => {
    const name   = cmd.getAttribute('name');
    const inEl   = cmd.querySelector('input');
    const outEl  = cmd.querySelector('output');
    if (!inEl || !outEl) return;

    const inputs = [];
    for (let i = 0; inEl.hasAttribute(`a${i}`); i++) inputs.push(inEl.getAttribute(`a${i}`));

    for (let j = 0; outEl.hasAttribute(`a${j}`); j++) {
      cmdByOutput[outEl.getAttribute(`a${j}`)] = { name, inputs, idx: j };
    }
  });

  // Стороны полигонов (output idx > 0 у Polygon) — не рисовать отдельно
  const polyonSides = new Set(
    Object.entries(cmdByOutput)
      .filter(([, c]) => c.name === 'Polygon' && c.idx > 0)
      .map(([label]) => label),
  );

  // ── Текстовые метки: свободные объекты + подписи значений объектов ──────
  const freeTexts = [];

  // 1. Свободные текстовые объекты (type="text")
  // GeoGebra 6 (веб): текст хранится в <expression label="..." exp="&quot;7{,}8&quot;"/>
  // GeoGebra 5 (десктоп): текст в дочернем <textExpression val="..."/>
  // Позиция всегда в дочернем <startPoint> элемента.
  doc.querySelectorAll('construction > element[type="text"]').forEach((el) => {
    const label = el.getAttribute('label') ?? '';
    const showEl = el.querySelector('show');
    if (showEl?.getAttribute('object') === 'false') return;  // явно скрыт

    // Источники текста (в порядке приоритета):
    // 1. <expression label="..." exp="..."> — GeoGebra 6
    // 2. <textExpression val="..."> внутри элемента — GeoGebra 5
    let raw = exprByLabel[label] ?? '';
    if (!raw) {
      const exprEl = el.querySelector('textExpression');
      raw = exprEl ? (exprEl.getAttribute('val') ?? '') : '';
    }

    // Строковый литерал в кавычках: "7{,}8" → 7{,}8 → 7,8
    let text = (raw.startsWith('"') && raw.endsWith('"')) ? raw.slice(1, -1) : raw;
    // LaTeX-запятая {,} → обычная запятая
    text = text.replace(/\{,\}/g, ',');
    if (!text.trim()) return;

    const color = parseColor(el.querySelector('objColor'));

    // Позиция: абсолютные пиксели или математические координаты
    const absEl = el.querySelector('absoluteScreenLocation');
    if (absEl) {
      freeTexts.push({ text, color,
        px: parseFloat(absEl.getAttribute('x') ?? '0'),
        py: parseFloat(absEl.getAttribute('y') ?? '0') });
      return;
    }
    const spEl = el.querySelector('startPoint');
    if (spEl) {
      const spName = spEl.getAttribute('exp') || spEl.getAttribute('name');
      if (spName && elProps[spName]?.coords) {
        const rc = elProps[spName].coords;
        const z = rc.z || 1;
        freeTexts.push({ text, color, mx: rc.x / z, my: rc.y / z });
      } else if (spEl.hasAttribute('x')) {
        const z = parseFloat(spEl.getAttribute('z') ?? '1') || 1;
        freeTexts.push({ text, color,
          mx: parseFloat(spEl.getAttribute('x') ?? '0') / z,
          my: parseFloat(spEl.getAttribute('y') ?? '0') / z });
      }
    }
  });

  // 2. Подписи значений отрезков (labelMode=2 → длина)
  Object.entries(cmdByOutput).forEach(([label, cmd]) => {
    if (cmd.name !== 'Segment') return;
    const ep = elProps[label];
    if (!ep?.visible || !ep.showLabel || ep.labelMode !== 2) return;
    const ep1 = elProps[cmd.inputs[0]], ep2 = elProps[cmd.inputs[1]];
    if (!ep1?.coords || !ep2?.coords) return;
    const z1 = ep1.coords.z || 1, z2 = ep2.coords.z || 1;
    const x1 = ep1.coords.x / z1, y1 = ep1.coords.y / z1;
    const x2 = ep2.coords.x / z2, y2 = ep2.coords.y / z2;
    const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const text = parseFloat(dist.toFixed(2)).toString().replace('.', ',');
    // Позиция: середина отрезка + labelOffset в пикселях
    freeTexts.push({ text, color: ep.color,
      px: xZero + ((x1 + x2) / 2) * scale + ep.labelOffset.x,
      py: yZero - ((y1 + y2) / 2) * yscale + ep.labelOffset.y });
  });

  // 3. Подписи значений углов (labelMode=2 → градусы)
  Object.entries(cmdByOutput).forEach(([label, cmd]) => {
    if (cmd.name !== 'Angle' || cmd.inputs.length !== 3) return;
    const ep = elProps[label];
    if (!ep?.visible || !ep.showLabel || ep.labelMode !== 2) return;
    const epF = elProps[cmd.inputs[0]], epV = elProps[cmd.inputs[1]], epT = elProps[cmd.inputs[2]];
    if (!epF?.coords || !epV?.coords || !epT?.coords) return;
    const zF = epF.coords.z || 1, zV = epV.coords.z || 1, zT = epT.coords.z || 1;
    const ax = epF.coords.x / zF - epV.coords.x / zV, ay = epF.coords.y / zF - epV.coords.y / zV;
    const bx = epT.coords.x / zT - epV.coords.x / zV, by = epT.coords.y / zT - epV.coords.y / zV;
    const cosA = (ax * bx + ay * by) / (Math.sqrt(ax*ax+ay*ay) * Math.sqrt(bx*bx+by*by));
    const deg = Math.round(Math.acos(Math.max(-1, Math.min(1, cosA))) * 180 / Math.PI);
    const text = `${deg}°`;
    // Позиция: рядом с вершиной угла + радиус дуги
    const r = ep.arcSize / scale;
    const midAngle = Math.atan2(ay + by, ax + bx);
    freeTexts.push({ text, color: ep.color,
      px: xZero + (epV.coords.x / zV + Math.cos(midAngle) * r * 1.4) * scale + ep.labelOffset.x,
      py: yZero - (epV.coords.y / zV + Math.sin(midAngle) * r * 1.4) * yscale + ep.labelOffset.y });
  });

  return { bbox, viewW, viewH, scale, yscale, xZero, yZero, elProps, cmdByOutput, polyonSides, freeTexts };
}

// ── Основная функция ───────────────────────────────────────────────────────────

export function ggbXmlToSvg(xmlString) {
  // Проверяем что JSXGraph правильно импортирован
  const jxg = JXG?.JSXGraph ? JXG : (typeof window !== 'undefined' ? window.JXG : null);
  if (!jxg?.JSXGraph?.initBoard) {
    throw new Error('JSXGraph не загружен. Проверьте импорт jsxgraph.');
  }

  const { bbox, viewW, viewH, scale, yscale, xZero, yZero, elProps, cmdByOutput, polyonSides, freeTexts } = parseXml(xmlString);

  const tmpId = `ggb2svg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const wrap  = document.createElement('div');
  wrap.id     = tmpId;
  // visibility:hidden → сохраняет layout-размеры (нужны JSXGraph для инициализации)
  wrap.style.cssText = `position:fixed;left:-9999px;top:-9999px;width:${viewW}px;height:${viewH}px;visibility:hidden;overflow:hidden;`;
  document.body.appendChild(wrap);

  let board;
  try {
    board = jxg.JSXGraph.initBoard(tmpId, {
      boundingbox:     bbox,
      axis:            false,
      showNavigation:  false,
      showCopyright:   false,
      pan:             { enabled: false },
      zoom:            { enabled: false },
      renderer:        'svg',
      keepaspectratio: false,
    });

    const svgEl = wrap.querySelector('svg');

    // ── Кеш JSXGraph-точек ────────────────────────────────────────────────────
    const jxgPts = {};
    // JSXGraph рисует подписи точек как HTML-div, а не SVG-текст →
    // собираем их отдельно и вставим в SVG-строку после сериализации.
    const labeledPts = [];

    const getJxgPt = (label) => {
      if (jxgPts[label]) return jxgPts[label];
      const ep = elProps[label];
      if (!ep?.coords) return null;
      const z  = ep.coords.z || 1;
      const mx = ep.coords.x / z;
      const my = ep.coords.y / z;
      jxgPts[label] = board.create('point', [mx, my], {
        visible:     ep.visible,
        name:        '',
        size:        ep.pointSize,
        strokeColor: ep.color,
        fillColor:   ep.color,
        fixed:       true,
        highlight:   false,
      });
      if (ep.visible && ep.showLabel) {
        // GeoGebra хранит labelOffset как смещение baseline относительно центра точки
        // (Java Graphics2D.drawString: y — это baseline, y>0 = ниже точки на экране).
        // Доверяем значениям GeoGebra напрямую; дефолт {x:5,y:-16} уже учтён выше.
        labeledPts.push({
          text: normalizeLabel(label),
          px: xZero + mx * scale + ep.labelOffset.x,
          py: yZero - my * yscale + ep.labelOffset.y,
          color: ep.color,
        });
      }
      return jxgPts[label];
    };

    // ── 1. Полигоны ───────────────────────────────────────────────────────────
    Object.entries(cmdByOutput).forEach(([label, cmd]) => {
      if (cmd.name !== 'Polygon' || cmd.idx !== 0) return;
      const ep = elProps[label];
      if (!ep?.visible) return;
      const pts = cmd.inputs.map(getJxgPt).filter(Boolean);
      if (pts.length < 3) return;
      board.create('polygon', pts, {
        fillColor:    ep.color,
        fillOpacity:  ep.alpha > 0 ? ep.alpha : 0,
        strokeColor:  ep.color,
        strokeWidth:  ep.lineStyle.strokeWidth,
        dash:         ep.lineStyle.dash,
        highlight:    false,
        hasInnerPoints: false,
        borders: {
          strokeColor: ep.color,
          strokeWidth: ep.lineStyle.strokeWidth,
          dash:        ep.lineStyle.dash,
          highlight:   false,
        },
      });
    });

    // ── 2. Отрезки (кроме сторон полигонов) ──────────────────────────────────
    Object.entries(cmdByOutput).forEach(([label, cmd]) => {
      if (cmd.name !== 'Segment' || polyonSides.has(label)) return;
      const ep = elProps[label];
      if (!ep?.visible) return;
      const p1 = getJxgPt(cmd.inputs[0]);
      const p2 = getJxgPt(cmd.inputs[1]);
      if (!p1 || !p2) return;
      board.create('segment', [p1, p2], {
        strokeColor: ep.color,
        strokeWidth: ep.lineStyle.strokeWidth,
        dash:        ep.lineStyle.dash,
        fixed:       true,
        highlight:   false,
      });
    });

    // ── 3. Лучи ───────────────────────────────────────────────────────────────
    Object.entries(cmdByOutput).forEach(([label, cmd]) => {
      if (cmd.name !== 'Ray') return;
      const ep = elProps[label];
      if (!ep?.visible) return;
      const p1 = getJxgPt(cmd.inputs[0]);
      const p2 = getJxgPt(cmd.inputs[1]);
      if (!p1 || !p2) return;
      board.create('line', [p1, p2], {
        straightFirst: false,
        straightLast:  true,
        strokeColor:   ep.color,
        strokeWidth:   ep.lineStyle.strokeWidth,
        dash:          ep.lineStyle.dash,
        fixed:         true,
        highlight:     false,
      });
    });

    // ── 4. Прямые ─────────────────────────────────────────────────────────────
    Object.entries(cmdByOutput).forEach(([label, cmd]) => {
      if (cmd.name !== 'Line') return;
      const ep = elProps[label];
      if (!ep?.visible) return;
      const p1 = getJxgPt(cmd.inputs[0]);
      const p2 = getJxgPt(cmd.inputs[1]);
      if (!p1 || !p2) return;
      board.create('line', [p1, p2], {
        straightFirst: true,
        straightLast:  true,
        strokeColor:   ep.color,
        strokeWidth:   ep.lineStyle.strokeWidth,
        dash:          ep.lineStyle.dash,
        fixed:         true,
        highlight:     false,
      });
    });

    // ── 5. Точки (все видимые, включая свободные без команды) ─────────────────
    Object.entries(elProps).forEach(([label, ep]) => {
      if (ep.type !== 'point' || !ep.visible) return;
      getJxgPt(label);
    });

    // ── 6. Углы ───────────────────────────────────────────────────────────────
    Object.entries(cmdByOutput).forEach(([label, cmd]) => {
      if (cmd.name !== 'Angle' || cmd.inputs.length !== 3) return;
      const ep = elProps[label];
      if (!ep?.visible) return;
      const ptFrom   = getJxgPt(cmd.inputs[0]);
      const ptVertex = getJxgPt(cmd.inputs[1]);
      const ptTo     = getJxgPt(cmd.inputs[2]);
      if (!ptFrom || !ptVertex || !ptTo) return;

      const radius = ep.arcSize / scale;

      // Проверяем прямой угол через скалярное произведение направлений
      const epF = elProps[cmd.inputs[0]], epV = elProps[cmd.inputs[1]], epT = elProps[cmd.inputs[2]];
      let isRightAngle = false;
      if (epF?.coords && epV?.coords && epT?.coords) {
        const zF = epF.coords.z || 1, zV = epV.coords.z || 1, zT = epT.coords.z || 1;
        const ax = epF.coords.x / zF - epV.coords.x / zV;
        const ay = epF.coords.y / zF - epV.coords.y / zV;
        const bx = epT.coords.x / zT - epV.coords.x / zV;
        const by = epT.coords.y / zT - epV.coords.y / zV;
        const lenA = Math.sqrt(ax * ax + ay * ay);
        const lenB = Math.sqrt(bx * bx + by * by);
        if (lenA > 0 && lenB > 0) {
          const cosA = (ax * bx + ay * by) / (lenA * lenB);
          isRightAngle = Math.abs(cosA) < 0.05; // ≈ 87°–93°
        }
      }

      if (isRightAngle) {
        // Квадратик прямого угла
        const epV2 = elProps[cmd.inputs[1]];
        const zV2  = epV2.coords.z || 1;
        const ox = epV2.coords.x / zV2, oy = epV2.coords.y / zV2;
        const epF2 = elProps[cmd.inputs[0]], epT2 = elProps[cmd.inputs[2]];
        const zF2 = epF2.coords.z || 1, zT2 = epT2.coords.z || 1;
        const ax2 = epF2.coords.x / zF2 - ox, ay2 = epF2.coords.y / zF2 - oy;
        const bx2 = epT2.coords.x / zT2 - ox, by2 = epT2.coords.y / zT2 - oy;
        const lenA2 = Math.sqrt(ax2 * ax2 + ay2 * ay2);
        const lenB2 = Math.sqrt(bx2 * bx2 + by2 * by2);
        const ux = ax2 / lenA2, uy = ay2 / lenA2;
        const vx = bx2 / lenB2, vy = by2 / lenB2;
        const s = radius;
        const mkPt = (x, y) => board.create('point', [x, y], { visible: false, fixed: true, highlight: false, withLabel: false });
        board.create('polygon', [
          mkPt(ox + s * ux,            oy + s * uy),
          mkPt(ox + s * ux + s * vx,   oy + s * uy + s * vy),
          mkPt(ox + s * vx,            oy + s * vy),
          mkPt(ox,                     oy),
        ], {
          fillColor:      'none',
          fillOpacity:    0,
          strokeColor:    ep.color,
          strokeWidth:    1,
          highlight:      false,
          hasInnerPoints: false,
          borders:        { strokeColor: ep.color, strokeWidth: 1, highlight: false },
          vertices:       { visible: false },
        });
      } else {
        const base = {
          radius,
          fillColor:   ep.color,
          fillOpacity: ep.alpha > 0 ? ep.alpha : 0.15,
          strokeColor: ep.color,
          strokeWidth: 1,
          name:        '',
          highlight:   false,
          label:       { visible: false },
        };
        // angleStyle=1 → угол по часовой стрелке (CW).
        // JSXGraph рисует угол всегда CCW от ptFrom к ptTo,
        // поэтому для CW-угла меняем местами from и to.
        const [pFrom, pTo] = ep.angleStyle === 1 ? [ptTo, ptFrom] : [ptFrom, ptTo];
        board.create('angle', [pFrom, ptVertex, pTo], base);

        if (ep.decoration === 1) {
          board.create('angle', [pFrom, ptVertex, pTo], {
            ...base,
            radius:      radius * 0.75,
            fillOpacity: 0,
          });
        }
      }
    });

    // ── Засечки на отрезках (decoration type 1/2/3 → 1/2/3 черточки) ─────────
    // Собираем данные ДО board.update(), чтобы coord-объекты уже существовали.
    // Рисуем засечки как SVG <line> в инжекции после сериализации.
    const segmentTicks = [];
    Object.entries(cmdByOutput).forEach(([label, cmd]) => {
      if (cmd.name !== 'Segment' || polyonSides.has(label)) return;
      const ep = elProps[label];
      if (!ep?.visible || !ep.decoration) return;
      const ep1 = elProps[cmd.inputs[0]], ep2 = elProps[cmd.inputs[1]];
      if (!ep1?.coords || !ep2?.coords) return;
      const z1 = ep1.coords.z || 1, z2 = ep2.coords.z || 1;
      segmentTicks.push({
        px1: xZero + (ep1.coords.x / z1) * scale,
        py1: yZero - (ep1.coords.y / z1) * yscale,
        px2: xZero + (ep2.coords.x / z2) * scale,
        py2: yZero - (ep2.coords.y / z2) * yscale,
        count: ep.decoration,   // 1 | 2 | 3
        color: ep.color,
        sw:    ep.lineStyle.strokeWidth,
      });
    });

    // Принудительный ре-рендер перед экспортом
    board.update();

    // ── Экспорт SVG ───────────────────────────────────────────────────────────
    if (!svgEl) throw new Error('JSXGraph не создал SVG-элемент');

    // Tight bounding box по пиксельным координатам всех видимых объектов
    let bxMin = Infinity, byMin = Infinity, bxMax = -Infinity, byMax = -Infinity;
    const expand = (px, py, r = 0) => {
      bxMin = Math.min(bxMin, px - r); byMin = Math.min(byMin, py - r);
      bxMax = Math.max(bxMax, px + r); byMax = Math.max(byMax, py + r);
    };
    Object.values(elProps).forEach((ep) => {
      if (!ep.visible || !ep.coords) return;
      const z  = ep.coords.z || 1;
      const px = xZero + (ep.coords.x / z) * scale;
      const py = yZero - (ep.coords.y / z) * yscale;
      expand(px, py, ep.pointSize + 4);
    });
    labeledPts.forEach(({ px, py }) => expand(px, py, 16));
    freeTexts.forEach(({ mx, my, px: fpx, py: fpy }) => {
      expand(
        fpx !== undefined ? fpx : xZero + mx * scale,
        fpy !== undefined ? fpy : yZero - my * yscale,
        30,
      );
    });
    const PAD = 20;
    const cropX = bxMin === Infinity ? 0           : Math.max(0,       Math.floor(bxMin - PAD));
    const cropY = bxMin === Infinity ? 0           : Math.max(0,       Math.floor(byMin - PAD));
    const cropW = bxMin === Infinity ? viewW       : Math.min(viewW,   Math.ceil(bxMax + PAD)) - cropX;
    const cropH = bxMin === Infinity ? viewH       : Math.min(viewH,   Math.ceil(byMax + PAD)) - cropY;

    svgEl.setAttribute('viewBox', `${cropX} ${cropY} ${cropW} ${cropH}`);
    svgEl.setAttribute('width',   '100%');
    svgEl.removeAttribute('height');
    svgEl.setAttribute('style',   'width:100%;height:auto;display:block;');

    let result = new XMLSerializer().serializeToString(svgEl);
    // Убираем белый фон JSXGraph (rect с fill="#ffffff" на весь viewBox)
    result = result.replace(/(<rect[^>]*)\bfill="#ffffff"([^>]*>)/gi, '$1fill="none"$2');

    // ── Вспомогательные генераторы SVG-элементов ─────────────────────────────

    // SVG <text> для подписей точек и свободных текстов
    const mkText = (text, px, py, color, fontSize = 14, bold = false) => {
      const safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const weight = bold ? ' font-weight="bold"' : '';
      return `<text x="${px.toFixed(1)}" y="${py.toFixed(1)}" font-size="${fontSize}" font-family="serif"${weight} fill="${color}">${safe}</text>`;
    };

    // Засечки на отрезке: count черточек перпендикулярно в середине
    const mkTicks = ({ px1, py1, px2, py2, count, color, sw }) => {
      const dx = px2 - px1, dy = py2 - py1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1) return '';
      const ux = -dy / len, uy = dx / len; // перпендикуляр (единичный)
      const vx =  dx / len, vy = dy / len; // вдоль отрезка  (единичный)
      const mx = (px1 + px2) / 2, my = (py1 + py2) / 2;
      const TL = 6;   // полудлина засечки, px
      const TG = 4.5; // расстояние между засечками, px
      const offsets = count === 1 ? [0]
                    : count === 2 ? [-TG / 2, TG / 2]
                    :               [-TG, 0, TG];
      return offsets.map((o) => {
        const cx = mx + vx * o, cy = my + vy * o;
        return `<line x1="${(cx + ux * TL).toFixed(1)}" y1="${(cy + uy * TL).toFixed(1)}" `
             + `x2="${(cx - ux * TL).toFixed(1)}" y2="${(cy - uy * TL).toFixed(1)}" `
             + `stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`;
      }).join('');
    };

    const injected = [
      ...segmentTicks.map(mkTicks),
      ...labeledPts.map(({ text, px, py, color }) => mkText(text, px, py, color, 15, true)),
      ...freeTexts.map(({ text, color, px, py, mx, my }) => {
        const spx = px !== undefined ? px : xZero + mx * scale;
        const spy = py !== undefined ? py : yZero - my * yscale;
        return mkText(text, spx, spy, color);
      }),
    ].join('');
    if (injected) result = result.replace('</svg>', `${injected}</svg>`);
    return result;

  } finally {
    if (board) jxg.JSXGraph.freeBoard(board);
    document.body.removeChild(wrap);
  }
}
