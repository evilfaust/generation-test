import katex from 'katex';

/**
 * Чистый детектор «сломанного» LaTeX в markdown-тексте задачи.
 *
 * НЕ пытается понимать LaTeX целиком — лишь находит формулы между `$…$` / `$$…$$`
 * и проверяет, что KaTeX вообще способен их отрендерить. Этого достаточно, чтобы
 * подсветить учителю место, где разметка битая.
 *
 * @param {string} text
 * @returns {Array<{from:number, to:number, severity:'error'|'warning', message:string}>}
 */
export function katexDiagnostics(text) {
  if (!text) return [];
  const diags = [];
  const matched = [];

  // $$…$$ (display) проверяется раньше, чем $…$ (inline) — порядок в альтернации важен.
  const re = /\$\$([\s\S]*?)\$\$|\$([^\n$]*?)\$/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const from = m.index;
    const to = from + m[0].length;
    matched.push([from, to]);

    const display = m[1] !== undefined;
    const body = display ? m[1] : m[2];
    if (!body || !body.trim()) continue; // пустая формула — не считаем ошибкой

    try {
      katex.renderToString(body, { displayMode: display, throwOnError: true, strict: false });
    } catch (err) {
      diags.push({
        from,
        to,
        severity: 'error',
        message: cleanMessage(err?.message),
      });
    }
  }

  // Непарный `$` вне распознанных формул → формула не закрыта.
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '$') continue;
    if (i > 0 && text[i - 1] === '\\') continue; // экранированный \$
    const inside = matched.some(([a, b]) => i >= a && i < b);
    if (!inside) {
      diags.push({
        from: i,
        to: i + 1,
        severity: 'warning',
        message: 'Непарный $ — формула не закрыта',
      });
    }
  }

  return diags;
}

function cleanMessage(msg) {
  if (!msg) return 'KaTeX не смог разобрать формулу';
  return String(msg).replace(/^KaTeX parse error:\s*/, '').trim();
}
