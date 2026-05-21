import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// Unicode-символы вне ASCII, которых нет в дефолтных шрифтах KaTeX
// (кружковые цифры из маршрутных листов и т.п.). Внутри $...$ KaTeX падает
// в strict mode с "Unrecognized Unicode character" + "No character metrics".
// Оборачиваем их в \text{…} перед передачей в rehype-katex.
const UNICODE_TEXT_CHARS = /[①②③④⑤⑥⑦⑧⑨⑩❶❷❸❹❺❻❼❽❾❿]/g;

/**
 * Препроцессинг: внутри $...$ и $$...$$ оборачивает «неизвестные» символы
 * в \text{…}, чтобы KaTeX мог их корректно отрисовать.
 */
function preprocessLatex(text) {
  if (!text || typeof text !== 'string') return text;
  if (!UNICODE_TEXT_CHARS.test(text)) return text;
  UNICODE_TEXT_CHARS.lastIndex = 0;

  // Сначала $$...$$ (жадно по содержимому, но не пересекая блоки),
  // затем $...$. Текст вне математических разделителей не трогаем.
  const wrap = (mathBody) =>
    mathBody.replace(UNICODE_TEXT_CHARS, (ch) => `\\text{${ch}}`);

  return text
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, body) => `$$${wrap(body)}$$`)
    .replace(/\$([^$\n]+?)\$/g, (_, body) => `$${wrap(body)}$`);
}

// strict: 'ignore' — пропускать неизвестные символы без warnings в консоль.
// trust: true — разрешает \textcolor и подобные команды (плейсхолдеры маршрут. листов).
const rehypeKatexOptions = {
  strict: 'ignore',
  trust: true,
  throwOnError: false,
};

/**
 * Универсальный компонент для рендеринга текста с Markdown и LaTeX формулами
 * Поддерживает:
 * - Markdown разметку (заголовки, списки, таблицы, жирный текст и т.д.)
 * - Inline формулы $...$
 * - Блочные формулы $$...$$
 * - answerBoxes=true: пустые ячейки таблицы рендерятся как поля для записи ответа
 */
const MathRenderer = ({ text, content, inline = true, answerBoxes = false }) => {
  const sourceText = text ?? content;
  if (!sourceText) return null;

  const processedText = preprocessLatex(sourceText);

  // Кастомные компоненты для react-markdown
  const components = {
    p: ({ children, ...props }) => (
      <p {...props} style={{ margin: 0 }}>
        {children}
      </p>
    ),
    table: ({ children, ...props }) => (
      <table {...props} style={{
        borderCollapse: 'collapse',
        width: '100%',
        marginBottom: '1em',
        border: '1px solid #ddd'
      }}>
        {children}
      </table>
    ),
    thead: ({ children, ...props }) => (
      <thead {...props} style={{ backgroundColor: '#f5f5f5' }}>
        {children}
      </thead>
    ),
    td: ({ children, ...props }) => {
      const isEmpty = answerBoxes && (
        !children ||
        (Array.isArray(children) && children.every(
          c => c == null || (typeof c === 'string' && !c.trim())
        ))
      );
      if (isEmpty) {
        return (
          <td {...props} style={{
            border: '1px solid #bbb',
            padding: '2px 4px',
            minWidth: '2.8em',
            height: '2.2em',
            verticalAlign: 'middle',
          }}>
            <span style={{
              display: 'block',
              minWidth: '2.8em',
              height: '1.6em',
              border: '1.5px solid #555',
              borderRadius: 2,
            }} />
          </td>
        );
      }
      return (
        <td {...props} style={{ border: '1px solid #ddd', padding: '4px 8px' }}>
          {children}
        </td>
      );
    },
    th: ({ children, ...props }) => (
      <th {...props} style={{
        border: '1px solid #ddd',
        padding: '6px 8px',
        backgroundColor: '#f5f5f5',
        fontWeight: 600,
      }}>
        {children}
      </th>
    ),
  };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[[rehypeKatex, rehypeKatexOptions]]}
      components={components}
    >
      {processedText}
    </ReactMarkdown>
  );
};

export default MathRenderer;
