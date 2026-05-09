/**
 * Конвертер GeoGebra XML → SVG.
 * Чистая реализация без внешних зависимостей — прямая генерация SVG-элементов.
 *
 * Принимает строку XML из ggbApi.getXML().
 * Возвращает SVG-строку, готовую к хранению в drawing_svg.
 *
 * Поддерживаемые объекты: point, segment, ray, line, polygon, angle.
 * Скрытые объекты (show object="false") игнорируются.
 */

// ── Вспомогательные утилиты ───────────────────────────────────────────────────

const SUB_DIGITS = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
                     '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };

function toUnicodeSub(s) {
  return s.split('').map((c) => SUB_DIGITS[c] ?? c).join('');
}

function normalizeLabel(label) {
  return label
    .replace(/_{([^}]+)}/g, (_, g) => toUnicodeSub(g))
    .replace(/_(\w)/g,      (_, g) => toUnicodeSub(g));
}

function parseColor(el) {
  if (!el) return 'rgb(0,0,0)';
  return `rgb(${el.getAttribute('r') ?? 0},${el.getAttribute('g') ?? 0},${el.getAttribute('b') ?? 0})`;
}

function parseLineStyle(el) {
  if (!el) return { dash: 0, strokeWidth: 1 };
  const type      = parseInt(el.getAttribute('type')      ?? '0');
  const thickness = parseInt(el.getAttribute('thickness') ?? '2');
  return { dash: type === 15 ? 2 : 0, strokeWidth: Math.max(0.5, thickness / 2) };
}

/** Форматтер числа с 1 знаком после запятой */
function f(n) { return Number(n).toFixed(1); }

// ── SVG-примитивы ─────────────────────────────────────────────────────────────

/** Засечки равенства: 1/2/3 черточки перпендикулярно посередине отрезка */
function mkTicks({ px1, py1, px2, py2, count, color, sw }) {
  const dx = px2 - px1, dy = py2 - py1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return '';
  const ux = -dy / len, uy = dx / len; // перпендикуляр (единичный)
  const vx =  dx / len, vy = dy / len; // вдоль отрезка  (единичный)
  const mx = (px1 + px2) / 2, my = (py1 + py2) / 2;
  const TL = 6, TG = 4.5;
  const offsets = count === 1 ? [0] : count === 2 ? [-TG / 2, TG / 2] : [-TG, 0, TG];
  return offsets.map((o) => {
    const cx = mx + vx * o, cy = my + vy * o;
    return `<line x1="${f(cx + ux * TL)}" y1="${f(cy + uy * TL)}" ` +
           `x2="${f(cx - ux * TL)}" y2="${f(cy - uy * TL)}" ` +
           `stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`;
  }).join('');
}

/** SVG-текст */
function mkText(text, px, py, color, fontSize = 14, bold = false) {
  const safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const w = bold ? ' font-weight="bold"' : '';
  return `<text x="${f(px)}" y="${f(py)}" font-size="${fontSize}" font-family="serif"${w} fill="${color}">${safe}</text>`;
}

/**
 * Заполненный сектор дуги угла.
 *
 * GeoGebra хранит inputs в порядке CCW от ptFrom к ptTo (в математических
 * координатах y-вверх). В SVG (y-вниз) тот же визуальный поворот соответствует
 * уменьшению screen-угла (atan2), что даёт sweep=0 (CCW на экране).
 *
 * span = a1 − a2 (mod 2π) — это размах дуги при sweep=0.
 * angleStyle не меняет порядок ptFrom/ptTo, только сигнализирует о рефлекс-угле.
 */
function mkArcSector(pxF, pyF, pxV, pyV, pxT, pyT, r, color, fillOpacity, sw) {
  const a1 = Math.atan2(pyF - pyV, pxF - pxV);
  const a2 = Math.atan2(pyT - pyV, pxT - pxV);

  const ax1 = pxV + r * Math.cos(a1), ay1 = pyV + r * Math.sin(a1);
  const ax2 = pxV + r * Math.cos(a2), ay2 = pyV + r * Math.sin(a2);

  // Размах: от a1 до a2 уменьшая угол (CCW на экране = CCW в математике)
  let span = a1 - a2;
  if (span <= 0) span += 2 * Math.PI;
  const large = span > Math.PI ? 1 : 0;

  const d = `M ${f(pxV)} ${f(pyV)} L ${f(ax1)} ${f(ay1)} ` +
            `A ${f(r)} ${f(r)} 0 ${large} 0 ${f(ax2)} ${f(ay2)} Z`;
  return `<path d="${d}" fill="${color}" fill-opacity="${fillOpacity}" ` +
         `stroke="${color}" stroke-width="${sw}"/>`;
}

/** Квадратик прямого угла */
function mkRightSquare(pxF, pyF, pxV, pyV, pxT, pyT, r, color) {
  const ax = pxF - pxV, ay = pyF - pyV;
  const bx = pxT - pxV, by = pyT - pyV;
  const lA = Math.sqrt(ax * ax + ay * ay), lB = Math.sqrt(bx * bx + by * by);
  if (lA < 1 || lB < 1) return '';
  const ux = ax / lA, uy = ay / lA;
  const vx = bx / lB, vy = by / lB;
  const pts = [
    `${f(pxV + r * ux)},${f(pyV + r * uy)}`,
    `${f(pxV + r * ux + r * vx)},${f(pyV + r * uy + r * vy)}`,
    `${f(pxV + r * vx)},${f(pyV + r * vy)}`,
    `${f(pxV)},${f(pyV)}`,
  ].join(' ');
  return `<polygon points="${pts}" fill="none" stroke="${color}" stroke-width="1"/>`;
}

// ── Парсинг XML ───────────────────────────────────────────────────────────────

function parseXml(xmlString) {
  const doc = new DOMParser().parseFromString(xmlString, 'text/xml');

  // ── Координатная система ──────────────────────────────────────────────────
  const csEl   = doc.querySelector('euclidianView coordSystem');
  const sizeEl = doc.querySelector('euclidianView size');
  const xZero  = parseFloat(csEl?.getAttribute('xZero')  ?? '300');
  const yZero  = parseFloat(csEl?.getAttribute('yZero')  ?? '300');
  const scale  = parseFloat(csEl?.getAttribute('scale')  ?? '50');
  const yscale = parseFloat(csEl?.getAttribute('yscale') ?? String(scale));
  const viewW  = parseInt(sizeEl?.getAttribute('width')  ?? '600');
  const viewH  = parseInt(sizeEl?.getAttribute('height') ?? '500');

  // ── Свойства элементов ────────────────────────────────────────────────────
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
    const lmEl    = el.querySelector('labelMode');
    const asEl    = el.querySelector('angleStyle');

    elProps[label] = {
      type:        el.getAttribute('type'),
      visible:     showEl?.getAttribute('object') === 'true',
      showLabel:   showEl?.getAttribute('label')  === 'true',
      labelMode:   parseInt(lmEl?.getAttribute('val') ?? '0'),
      // angleStyle: 0=CCW (по умолч.), 1=CW (меняем from/to при рендере)
      angleStyle:  parseInt(asEl?.getAttribute('val') ?? '0'),
      color:       parseColor(colorEl),
      alpha:       parseFloat(colorEl?.getAttribute('alpha') ?? '0'),
      lineStyle:   parseLineStyle(lsEl),
      pointSize:   parseInt(psEl?.getAttribute('val') ?? '5'),
      arcSize:     parseInt(arcEl?.getAttribute('val') ?? '30'), // пиксели
      decoration:  parseInt(decEl?.getAttribute('type') ?? '0'),
      labelOffset: loEl
        ? { x: parseInt(loEl.getAttribute('x') ?? '0'), y: parseInt(loEl.getAttribute('y') ?? '0') }
        : { x: 5, y: -16 },
      coords: coordEl ? {
        x: parseFloat(coordEl.getAttribute('x') ?? '0'),
        y: parseFloat(coordEl.getAttribute('y') ?? '0'),
        z: parseFloat(coordEl.getAttribute('z') ?? '1'),
      } : null,
    };
  });

  // ── Карта <expression>: label → exp (GeoGebra 6 хранит текст так) ─────────
  const exprByLabel = {};
  doc.querySelectorAll('construction > expression').forEach((ex) => {
    const label = ex.getAttribute('label');
    const exp   = ex.getAttribute('exp') ?? '';
    if (label) exprByLabel[label] = exp;
  });

  // ── Команды: output label → { name, inputs, idx } ────────────────────────
  const cmdByOutput = {};
  doc.querySelectorAll('construction > command').forEach((cmd) => {
    const name  = cmd.getAttribute('name');
    const inEl  = cmd.querySelector('input');
    const outEl = cmd.querySelector('output');
    if (!inEl || !outEl) return;

    const inputs = [];
    for (let i = 0; inEl.hasAttribute(`a${i}`); i++) inputs.push(inEl.getAttribute(`a${i}`));
    for (let j = 0; outEl.hasAttribute(`a${j}`); j++) {
      cmdByOutput[outEl.getAttribute(`a${j}`)] = { name, inputs, idx: j };
    }
  });

  // Стороны полигонов — не рисовать отдельно как отрезки
  const polyonSides = new Set(
    Object.entries(cmdByOutput)
      .filter(([, c]) => c.name === 'Polygon' && c.idx > 0)
      .map(([label]) => label),
  );

  // ── Свободные тексты + подписи значений ──────────────────────────────────
  const freeTexts = [];

  // 1. Текстовые объекты (type="text")
  // GeoGebra 6: текст в <expression exp="...">, GeoGebra 5: в <textExpression val="...">
  doc.querySelectorAll('construction > element[type="text"]').forEach((el) => {
    const label = el.getAttribute('label') ?? '';
    if (el.querySelector('show')?.getAttribute('object') === 'false') return;

    let raw = exprByLabel[label] ?? '';
    if (!raw) {
      const exprEl = el.querySelector('textExpression');
      raw = exprEl ? (exprEl.getAttribute('val') ?? '') : '';
    }
    let text = (raw.startsWith('"') && raw.endsWith('"')) ? raw.slice(1, -1) : raw;
    text = text.replace(/\{,\}/g, ','); // LaTeX-запятая → обычная
    if (!text.trim()) return;

    const color = parseColor(el.querySelector('objColor'));
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
        const rc = elProps[spName].coords, z = rc.z || 1;
        freeTexts.push({ text, color, mx: rc.x / z, my: rc.y / z });
      } else if (spEl.hasAttribute('x')) {
        const z = parseFloat(spEl.getAttribute('z') ?? '1') || 1;
        freeTexts.push({ text, color,
          mx: parseFloat(spEl.getAttribute('x') ?? '0') / z,
          my: parseFloat(spEl.getAttribute('y') ?? '0') / z });
      }
    }
  });

  // 2. Подписи длин отрезков (labelMode=2)
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
    freeTexts.push({ text, color: ep.color,
      px: xZero + ((x1 + x2) / 2) * scale  + ep.labelOffset.x,
      py: yZero - ((y1 + y2) / 2) * yscale + ep.labelOffset.y });
  });

  // 3. Подписи углов (labelMode=2)
  Object.entries(cmdByOutput).forEach(([label, cmd]) => {
    if (cmd.name !== 'Angle' || cmd.inputs.length !== 3) return;
    const ep = elProps[label];
    if (!ep?.visible || !ep.showLabel || ep.labelMode !== 2) return;
    const epF = elProps[cmd.inputs[0]], epV = elProps[cmd.inputs[1]], epT = elProps[cmd.inputs[2]];
    if (!epF?.coords || !epV?.coords || !epT?.coords) return;
    const zF = epF.coords.z || 1, zV = epV.coords.z || 1, zT = epT.coords.z || 1;
    const ax = epF.coords.x / zF - epV.coords.x / zV;
    const ay = epF.coords.y / zF - epV.coords.y / zV;
    const bx = epT.coords.x / zT - epV.coords.x / zV;
    const by = epT.coords.y / zT - epV.coords.y / zV;
    const cosA = (ax * bx + ay * by) / (Math.sqrt(ax*ax+ay*ay) * Math.sqrt(bx*bx+by*by));
    const deg = Math.round(Math.acos(Math.max(-1, Math.min(1, cosA))) * 180 / Math.PI);
    // Позиция: вдоль биссектрисы на расстоянии arcSize * 1.4 от вершины
    const r = ep.arcSize / scale; // math units
    const midAngle = Math.atan2(ay + by, ax + bx);
    freeTexts.push({ text: `${deg}°`, color: ep.color,
      px: xZero + (epV.coords.x / zV + Math.cos(midAngle) * r * 1.4) * scale  + ep.labelOffset.x,
      py: yZero - (epV.coords.y / zV + Math.sin(midAngle) * r * 1.4) * yscale + ep.labelOffset.y });
  });

  return { viewW, viewH, scale, yscale, xZero, yZero, elProps, cmdByOutput, polyonSides, freeTexts };
}

// ── Основная функция ──────────────────────────────────────────────────────────

export function ggbXmlToSvg(xmlString) {
  const { viewW, viewH, scale, yscale, xZero, yZero,
          elProps, cmdByOutput, polyonSides, freeTexts } = parseXml(xmlString);

  // Математические координаты → пиксели
  const toPixel = (label) => {
    const ep = elProps[label];
    if (!ep?.coords) return null;
    const z = ep.coords.z || 1;
    return {
      px: xZero + (ep.coords.x / z) * scale,
      py: yZero - (ep.coords.y / z) * yscale,
    };
  };

  const dashAttr = (ep) => ep.lineStyle.dash ? ' stroke-dasharray="8,4"' : '';
  const BIG = Math.max(viewW, viewH) * 3; // для лучей и прямых
  const parts = [];

  // ── 1. Полигоны ────────────────────────────────────────────────────────────
  Object.entries(cmdByOutput).forEach(([label, cmd]) => {
    if (cmd.name !== 'Polygon' || cmd.idx !== 0) return;
    const ep = elProps[label];
    if (!ep?.visible) return;
    const pts = cmd.inputs.map(toPixel).filter(Boolean);
    if (pts.length < 3) return;
    const ptStr = pts.map((p) => `${f(p.px)},${f(p.py)}`).join(' ');
    const fa = ep.alpha > 0 ? ep.alpha : 0;
    parts.push(
      `<polygon points="${ptStr}" fill="${ep.color}" fill-opacity="${fa}" ` +
      `stroke="${ep.color}" stroke-width="${ep.lineStyle.strokeWidth}"${dashAttr(ep)}/>`,
    );
  });

  // ── 2. Отрезки (кроме сторон полигонов) ───────────────────────────────────
  Object.entries(cmdByOutput).forEach(([label, cmd]) => {
    if (cmd.name !== 'Segment' || polyonSides.has(label)) return;
    const ep = elProps[label];
    if (!ep?.visible) return;
    const p1 = toPixel(cmd.inputs[0]), p2 = toPixel(cmd.inputs[1]);
    if (!p1 || !p2) return;
    parts.push(
      `<line x1="${f(p1.px)}" y1="${f(p1.py)}" x2="${f(p2.px)}" y2="${f(p2.py)}" ` +
      `stroke="${ep.color}" stroke-width="${ep.lineStyle.strokeWidth}"${dashAttr(ep)} stroke-linecap="round"/>`,
    );
  });

  // ── 3. Лучи ────────────────────────────────────────────────────────────────
  Object.entries(cmdByOutput).forEach(([label, cmd]) => {
    if (cmd.name !== 'Ray') return;
    const ep = elProps[label];
    if (!ep?.visible) return;
    const p1 = toPixel(cmd.inputs[0]), p2 = toPixel(cmd.inputs[1]);
    if (!p1 || !p2) return;
    const dx = p2.px - p1.px, dy = p2.py - p1.py;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;
    parts.push(
      `<line x1="${f(p1.px)}" y1="${f(p1.py)}" ` +
      `x2="${f(p1.px + (dx / len) * BIG)}" y2="${f(p1.py + (dy / len) * BIG)}" ` +
      `stroke="${ep.color}" stroke-width="${ep.lineStyle.strokeWidth}"${dashAttr(ep)}/>`,
    );
  });

  // ── 4. Прямые ──────────────────────────────────────────────────────────────
  Object.entries(cmdByOutput).forEach(([label, cmd]) => {
    if (cmd.name !== 'Line') return;
    const ep = elProps[label];
    if (!ep?.visible) return;
    const p1 = toPixel(cmd.inputs[0]), p2 = toPixel(cmd.inputs[1]);
    if (!p1 || !p2) return;
    const dx = p2.px - p1.px, dy = p2.py - p1.py;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;
    const ux = dx / len, uy = dy / len;
    parts.push(
      `<line x1="${f(p1.px - ux * BIG)}" y1="${f(p1.py - uy * BIG)}" ` +
      `x2="${f(p1.px + ux * BIG)}" y2="${f(p1.py + uy * BIG)}" ` +
      `stroke="${ep.color}" stroke-width="${ep.lineStyle.strokeWidth}"${dashAttr(ep)}/>`,
    );
  });

  // ── 5. Углы ────────────────────────────────────────────────────────────────
  Object.entries(cmdByOutput).forEach(([label, cmd]) => {
    if (cmd.name !== 'Angle' || cmd.inputs.length !== 3) return;
    const ep = elProps[label];
    if (!ep?.visible) return;

    const pF = toPixel(cmd.inputs[0]);
    const pV = toPixel(cmd.inputs[1]);
    const pT = toPixel(cmd.inputs[2]);
    if (!pF || !pV || !pT) return;

    const r = ep.arcSize; // arcSize хранится в пикселях

    // Определяем прямой угол через скалярное произведение (в математических координатах)
    const epF = elProps[cmd.inputs[0]], epV = elProps[cmd.inputs[1]], epT = elProps[cmd.inputs[2]];
    let isRight = false;
    if (epF?.coords && epV?.coords && epT?.coords) {
      const zF = epF.coords.z || 1, zV = epV.coords.z || 1, zT = epT.coords.z || 1;
      const ax = epF.coords.x / zF - epV.coords.x / zV, ay = epF.coords.y / zF - epV.coords.y / zV;
      const bx = epT.coords.x / zT - epV.coords.x / zV, by = epT.coords.y / zT - epV.coords.y / zV;
      const lA = Math.sqrt(ax * ax + ay * ay), lB = Math.sqrt(bx * bx + by * by);
      if (lA > 0 && lB > 0) isRight = Math.abs((ax * bx + ay * by) / (lA * lB)) < 0.05;
    }

    if (isRight) {
      parts.push(mkRightSquare(pF.px, pF.py, pV.px, pV.py, pT.px, pT.py, r, ep.color));
    } else {
      const fa = ep.alpha > 0 ? ep.alpha : 0.15;
      parts.push(mkArcSector(pF.px, pF.py, pV.px, pV.py, pT.px, pT.py, r, ep.color, fa, 1));

      if (ep.decoration === 1) {
        // Двойная дуга: второй контурный arc меньшего радиуса
        parts.push(mkArcSector(pF.px, pF.py, pV.px, pV.py, pT.px, pT.py, r * 0.75, ep.color, 0, 1));
      }
    }
  });

  // ── 6. Точки ───────────────────────────────────────────────────────────────
  const labeledPts = [];
  Object.entries(elProps).forEach(([label, ep]) => {
    if (ep.type !== 'point' || !ep.visible || !ep.coords) return;
    const p = toPixel(label);
    if (!p) return;
    parts.push(
      `<circle cx="${f(p.px)}" cy="${f(p.py)}" r="${ep.pointSize}" ` +
      `fill="${ep.color}" stroke="${ep.color}"/>`,
    );
    if (ep.showLabel) {
      labeledPts.push({
        text:  normalizeLabel(label),
        px:    p.px + ep.labelOffset.x,
        py:    p.py + ep.labelOffset.y,
        color: ep.color,
      });
    }
  });

  // ── 7. Засечки (поверх отрезков) ──────────────────────────────────────────
  Object.entries(cmdByOutput).forEach(([label, cmd]) => {
    if (cmd.name !== 'Segment' || polyonSides.has(label)) return;
    const ep = elProps[label];
    if (!ep?.visible || !ep.decoration) return;
    const p1 = toPixel(cmd.inputs[0]), p2 = toPixel(cmd.inputs[1]);
    if (!p1 || !p2) return;
    parts.push(mkTicks({
      px1: p1.px, py1: p1.py, px2: p2.px, py2: p2.py,
      count: ep.decoration, color: ep.color, sw: ep.lineStyle.strokeWidth,
    }));
  });

  // ── 8. Подписи вершин (жирные, 15px) ──────────────────────────────────────
  labeledPts.forEach(({ text, px, py, color }) => {
    parts.push(mkText(text, px, py, color, 15, true));
  });

  // ── 9. Свободные тексты и подписи значений ────────────────────────────────
  freeTexts.forEach(({ text, color, px, py, mx, my }) => {
    const spx = px !== undefined ? px : xZero + mx * scale;
    const spy = py !== undefined ? py : yZero - my * yscale;
    parts.push(mkText(text, spx, spy, color));
  });

  // ── Tight crop: viewBox по bounding box всех видимых объектов ─────────────
  let bxMin = Infinity, byMin = Infinity, bxMax = -Infinity, byMax = -Infinity;
  const expand = (px, py, r = 0) => {
    bxMin = Math.min(bxMin, px - r); byMin = Math.min(byMin, py - r);
    bxMax = Math.max(bxMax, px + r); byMax = Math.max(byMax, py + r);
  };
  Object.values(elProps).forEach((ep) => {
    if (!ep.visible || !ep.coords) return;
    const z = ep.coords.z || 1;
    expand(xZero + (ep.coords.x / z) * scale, yZero - (ep.coords.y / z) * yscale, ep.pointSize + 4);
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
  const cropX = bxMin === Infinity ? 0     : Math.max(0,     Math.floor(bxMin - PAD));
  const cropY = bxMin === Infinity ? 0     : Math.max(0,     Math.floor(byMin - PAD));
  const cropW = bxMin === Infinity ? viewW : Math.min(viewW, Math.ceil(bxMax + PAD)) - cropX;
  const cropH = bxMin === Infinity ? viewH : Math.min(viewH, Math.ceil(byMax + PAD)) - cropY;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg"`,
    `     viewBox="${cropX} ${cropY} ${cropW} ${cropH}"`,
    `     width="100%" style="width:100%;height:auto;display:block;" overflow="hidden">`,
    ...parts,
    `</svg>`,
  ].join('\n');
}

// ── Вспомогательные экспорты для SVG-редактора ───────────────────────────────

/**
 * Парсит видимые точки из GeoGebra XML и возвращает их координаты
 * в обоих пространствах: математических (GeoGebra) и пиксельных (SVG).
 *
 * @param {string} xmlString — строка GeoGebra XML
 * @returns {{ points: Array<{label,x,y,px,py}>, coordSys: {xZero,yZero,scale,yscale} }}
 */
export function parseGgbPoints(xmlString) {
  const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
  const csEl   = doc.querySelector('euclidianView coordSystem');
  const xZero  = parseFloat(csEl?.getAttribute('xZero')  ?? '300');
  const yZero  = parseFloat(csEl?.getAttribute('yZero')  ?? '300');
  const scale  = parseFloat(csEl?.getAttribute('scale')  ?? '50');
  const yscale = parseFloat(csEl?.getAttribute('yscale') ?? String(scale));
  const coordSys = { xZero, yZero, scale, yscale };

  const points = [];
  doc.querySelectorAll('construction > element[type="point"]').forEach((el) => {
    if (el.querySelector('show')?.getAttribute('object') === 'false') return;
    const label  = el.getAttribute('label');
    const coords = el.querySelector('coords');
    if (!label || !coords) return;
    const z = parseFloat(coords.getAttribute('z') || '1') || 1;
    const x = parseFloat(coords.getAttribute('x') || '0') / z;
    const y = parseFloat(coords.getAttribute('y') || '0') / z;
    const px = xZero + x * scale;
    const py = yZero - y * yscale;

    const showEl  = el.querySelector('show');
    const showLabel = showEl?.getAttribute('label') === 'true';
    const loEl    = el.querySelector('labelOffset');
    const loX     = loEl ? parseInt(loEl.getAttribute('x') || '0') : 5;
    const loY     = loEl ? parseInt(loEl.getAttribute('y') || '0') : -16;

    points.push({
      label, x, y, px, py,
      showLabel,
      labelOffset: { x: loX, y: loY },
      labelPx: px + loX,
      labelPy: py + loY,
    });
  });

  return { points, coordSys };
}

/**
 * Обновляет <coords> для указанных точек в GeoGebra XML и возвращает новую XML-строку.
 *
 * @param {string} xmlString — исходный XML
 * @param {Record<string, {x: number, y: number}>} overrides — {label: {x, y}} в координатах GeoGebra
 * @returns {string} — обновлённый XML
 */
export function applyPointOverrides(xmlString, overrides) {
  if (!overrides || !Object.keys(overrides).length) return xmlString;
  const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
  for (const [label, { x, y }] of Object.entries(overrides)) {
    const el = [...doc.querySelectorAll('element[type="point"]')].find(e => e.getAttribute('label') === label);
    if (!el) continue;
    const coords = el.querySelector('coords');
    if (!coords) continue;
    coords.setAttribute('x', String(x));
    coords.setAttribute('y', String(y));
    coords.setAttribute('z', '1');
  }
  return new XMLSerializer().serializeToString(doc);
}

/**
 * Обновляет <labelOffset> для указанных точек в GeoGebra XML.
 * overrides: { [label]: { x, y } } — смещение в SVG-пикселях (те же значения, что хранит GeoGebra)
 * Возвращает новую XML-строку.
 */
export function applyLabelOffsets(xmlString, overrides) {
  if (!overrides || !Object.keys(overrides).length) return xmlString;
  const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
  for (const [label, { x, y }] of Object.entries(overrides)) {
    const el = [...doc.querySelectorAll('element[type="point"]')].find(e => e.getAttribute('label') === label);
    if (!el) continue;
    let loEl = el.querySelector('labelOffset');
    if (!loEl) {
      loEl = doc.createElement('labelOffset');
      // Вставляем после <show> или в начало элемента
      const showEl = el.querySelector('show');
      if (showEl?.nextSibling) {
        el.insertBefore(loEl, showEl.nextSibling);
      } else {
        el.appendChild(loEl);
      }
    }
    loEl.setAttribute('x', String(Math.round(x)));
    loEl.setAttribute('y', String(Math.round(y)));
  }
  return new XMLSerializer().serializeToString(doc);
}
