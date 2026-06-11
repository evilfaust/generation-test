import { useState, useEffect, useRef, useCallback } from 'react'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkRehype from 'remark-rehype'
import rehypeKatex from 'rehype-katex'
import rehypeStringify from 'rehype-stringify'
import DOMPurify from 'dompurify'

// Debounce delay in ms
const DEBOUNCE_DELAY = 150

/**
 * Custom syntax (each on its own line):
 *
 *   :::    → column break (jump to next column)
 *   ~      → empty line (1em)
 *   ~~     → small space (0.5em)
 *   ~~~    → large space (2em)
 *
 * GeoGebra block (однострочный — основной формат):
 *   :::geogebra ggb-triangle-01:::
 *
 * GeoGebra block (многострочный — обратная совместимость):
 *   :::geogebra
 *   id: ggb-triangle-01
 *   app: geometry
 *   height: 520
 *   caption: Треугольник ABC
 *   :::
 *
 * Все данные (app, height, caption, base64) берутся из theme_settings.geogebra_applets.
 * В HTML остаётся только data-geogebra-id.
 */

const MARKERS = {
  colBreak: 'COLBREAK_7f3a9b',
  vspace: 'VSPACE_7f3a9b',
  vspaceSm: 'VSPACESM_7f3a9b',
  vspaceLg: 'VSPACELG_7f3a9b',
  geogebraPrefix: 'GGBLOCK_7f3a9b_',
  calloutOpenPrefix: 'CALLOUTOPEN7f3a9b',
  calloutClose: 'CALLOUTCLOSE7f3a9b',
}

// Каллауты теории: блок ":::definition Заголовок \n тело \n :::"
const CALLOUT_LABELS = {
  condition: 'Условие задачи',
  definition: 'Определение',
  theorem: 'Теорема',
  example: 'Пример',
  remark: 'Замечание',
  proof: 'Доказательство',
  answer: 'Ответ',
  qed: 'Что и требовалось доказать',
  note: 'Заметка',
}
const CALLOUT_OPEN_RE = new RegExp(
  `^:::(${Object.keys(CALLOUT_LABELS).join('|')})\\b\\s*(.*)$`,
)

function parseGeoGebraConfig(rawConfig = '') {
  const allowedApps = new Set(['geometry', 'graphing', 'classic', '3d'])
  const cfg = {
    id: '',
    app: 'geometry',
    height: 520,
    caption: '',
  }

  rawConfig
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const idx = line.indexOf(':')
      if (idx === -1) return
      const key = line.slice(0, idx).trim().toLowerCase()
      const value = line.slice(idx + 1).trim()
      if (!value) return

      if (key === 'id') {
        cfg.id = value
        return
      }
      if (key === 'app') {
        const normalized = value.toLowerCase()
        if (allowedApps.has(normalized)) cfg.app = normalized
        return
      }
      if (key === 'height') {
        const num = Number(value)
        if (Number.isFinite(num)) cfg.height = Math.min(900, Math.max(260, Math.round(num)))
        return
      }
      if (key === 'caption') {
        cfg.caption = value.replace(/^"(.*)"$/, '$1')
      }
    })

  return cfg
}

// Однострочный формат: :::geogebra ggb-id:::
const INLINE_GEO_RE = /^:::geogebra\s+(\S+)\s*:::$/

function preprocess(md) {
  const normalized = md.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')
  const outLines = []
  const geogebraBlocks = []
  const callouts = []

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim()

    // Каллаут теории: :::definition Заголовок \n тело \n :::
    const calloutMatch = trimmed.match(CALLOUT_OPEN_RE)
    if (calloutMatch) {
      const type = calloutMatch[1]
      const title = (calloutMatch[2] || '').trim() || CALLOUT_LABELS[type]
      const marker = `${MARKERS.calloutOpenPrefix}${callouts.length}E`
      callouts.push({ marker, type, title })

      const bodyLines = []
      i += 1
      for (; i < lines.length; i += 1) {
        if (lines[i].trim() === ':::') break
        bodyLines.push(lines[i])
      }
      // Маркеры окружаем пустыми строками → становятся отдельными <p>.
      outLines.push('', marker, '', ...bodyLines, '', MARKERS.calloutClose, '')
      continue
    }

    // Однострочный формат: :::geogebra ggb-id:::
    const inlineMatch = trimmed.match(INLINE_GEO_RE)
    if (inlineMatch) {
      const marker = `${MARKERS.geogebraPrefix}${geogebraBlocks.length}`
      geogebraBlocks.push({
        marker,
        config: { id: inlineMatch[1], app: 'geometry', height: 520, caption: '' },
      })
      outLines.push(marker)
      continue
    }

    // Многострочный формат (обратная совместимость): :::geogebra\n...\n:::
    if (trimmed !== ':::geogebra') {
      outLines.push(lines[i])
      continue
    }

    const startIndex = i
    const blockLines = []
    let closed = false
    i += 1

    for (; i < lines.length; i += 1) {
      if (lines[i].trim() === ':::') {
        closed = true
        break
      }
      blockLines.push(lines[i])
    }

    if (!closed) {
      outLines.push(lines[startIndex])
      outLines.push(...blockLines)
      i = startIndex + blockLines.length
      continue
    }

    const marker = `${MARKERS.geogebraPrefix}${geogebraBlocks.length}`
    geogebraBlocks.push({
      marker,
      config: parseGeoGebraConfig(blockLines.join('\n')),
    })
    outLines.push(marker)
  }

  const processed = outLines
    .join('\n')
    .replace(/^:::\s*$/gm, MARKERS.colBreak)
    .replace(/^~~~\s*$/gm, MARKERS.vspaceLg)
    .replace(/^~~\s*$/gm, MARKERS.vspaceSm)
    .replace(/^~\s*$/gm, MARKERS.vspace)

  return {
    text: processed,
    geogebraBlocks,
    callouts,
  }
}

function escapeAttr(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function postprocess(html, columns, geogebraBlocks = [], callouts = []) {
  let result = html
    .replace(new RegExp(`<p>\\s*${MARKERS.vspaceLg}\\s*</p>`, 'g'), '<div class="vspace vspace-lg"></div>')
    .replace(new RegExp(`<p>\\s*${MARKERS.vspaceSm}\\s*</p>`, 'g'), '<div class="vspace vspace-sm"></div>')
    .replace(new RegExp(`<p>\\s*${MARKERS.vspace}\\s*</p>`, 'g'), '<div class="vspace"></div>')
    .replace(new RegExp(MARKERS.vspaceLg, 'g'), '<div class="vspace vspace-lg"></div>')
    .replace(new RegExp(MARKERS.vspaceSm, 'g'), '<div class="vspace vspace-sm"></div>')
    .replace(new RegExp(MARKERS.vspace, 'g'), '<div class="vspace"></div>')

  // Каллауты: маркер-открытие → стилизованный div + лейбл, маркер-закрытие → </div>
  callouts.forEach((c) => {
    const openHtml = `<div class="theory-callout theory-callout--${c.type}"><div class="theory-callout__label">${escapeAttr(c.title)}</div>`
    result = result.replace(new RegExp(`<p>\\s*${c.marker}\\s*</p>|${c.marker}`, 'g'), openHtml)
  })
  result = result.replace(
    new RegExp(`<p>\\s*${MARKERS.calloutClose}\\s*</p>|${MARKERS.calloutClose}`, 'g'),
    '</div>',
  )

  // Размер картинки: ![alt](url){S|M|L|XL} → class на <img>, токен убираем.
  result = result.replace(
    /<img\b([^>]*?)\s*\/?>\s*\{(s|m|l|xl)\}/gi,
    (_, attrs, size) => `<img${attrs} class="theory-img theory-img--${size.toLowerCase()}">`,
  )

  const colBreakPattern = `<p>\\s*${MARKERS.colBreak}\\s*</p>|${MARKERS.colBreak}`
  const hasColBreak = new RegExp(colBreakPattern).test(result)

  if (columns > 1 && hasColBreak) {
    const splitRegex = new RegExp(colBreakPattern, 'g')
    const parts = result.split(splitRegex).filter((p) => p.trim())
    result = parts.map((part) => `<div class="col-section">${part}</div>`).join('')
  } else {
    result = result.replace(new RegExp(colBreakPattern, 'g'), '')
  }

  geogebraBlocks.forEach((item) => {
    const blockHtml = `<div class="geogebra-embed" data-geogebra-id="${escapeAttr(item.config.id)}"></div>`
    const markerPattern = new RegExp(`<p>\\s*${item.marker}\\s*</p>|${item.marker}`, 'g')
    result = result.replace(markerPattern, blockHtml)
  })

  return result
}

export function useMarkdownProcessor(markdown, columns = 1) {
  const [html, setHtml] = useState('')
  const timeoutRef = useRef(null)
  const processorRef = useRef(null)
  const columnsRef = useRef(columns)
  columnsRef.current = columns

  // Create processor once
  if (!processorRef.current) {
    processorRef.current = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkMath)
      .use(remarkRehype)
      .use(rehypeKatex)
      .use(rehypeStringify)
  }

  const processMarkdown = useCallback(async (text) => {
    try {
      const { text: preprocessed, geogebraBlocks, callouts } = preprocess(text)
      const result = await processorRef.current.process(preprocessed)
      const withCustom = postprocess(String(result), columnsRef.current, geogebraBlocks, callouts)

      const cleanHtml = DOMPurify.sanitize(withCustom, {
        ADD_TAGS: ['math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub',
          'mfrac', 'mroot', 'msqrt', 'munder', 'mover', 'mtable', 'mtr',
          'mtd', 'annotation', 'div', 'table', 'thead', 'tbody', 'tr',
          'th', 'td', 'caption', 'colgroup', 'col'],
        ADD_ATTR: ['class', 'style', 'encoding', 'xmlns', 'aria-hidden'],
        ALLOW_DATA_ATTR: true,
      })
      setHtml(cleanHtml)
    } catch (error) {
      console.error('Markdown processing error:', error)
      setHtml('<p style="color: red;">Ошибка рендеринга</p>')
    }
  }, [])

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      processMarkdown(markdown)
    }, DEBOUNCE_DELAY)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [markdown, columns, processMarkdown])

  return html
}
