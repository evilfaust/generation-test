import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { EditorView } from '@codemirror/view';
import { linter, lintGutter } from '@codemirror/lint';
import { katexDiagnostics } from '../../utils/katexLint';

// Линтер: на каждое изменение (с задержкой) ищет битые $…$ формулы через KaTeX.
const katexLinter = linter(
  (view) => katexDiagnostics(view.state.doc.toString()),
  { delay: 400 },
);

/**
 * Внутренний редактор кода для LaTeX/markdown-полей.
 * Грузится ЛЕНИВО (через LatexField → React.lazy), поэтому весь CodeMirror
 * попадает в отдельный чанк и не утяжеляет основной бандл.
 *
 * Наружу выглядит как контролируемое поле: props value / onChange(value).
 * basicSetup у @uiw/react-codemirror включает searchKeymap → Ctrl+F (поиск)
 * и Ctrl+H (замена) работают из коробки.
 */
export default function LatexCodeMirror({ value = '', onChange, placeholder = '', minRows = 4, maxRows = 24 }) {
  const lineHeightPx = 21; // примерная высота строки CM при дефолтном шрифте
  const extensions = useMemo(
    () => [markdown(), EditorView.lineWrapping, katexLinter, lintGutter()],
    [],
  );

  return (
    <CodeMirror
      value={value}
      onChange={(val) => onChange?.(val)}
      placeholder={placeholder}
      extensions={extensions}
      minHeight={`${minRows * lineHeightPx}px`}
      maxHeight={`${maxRows * lineHeightPx}px`}
      basicSetup={{
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
        searchKeymap: true,
      }}
      style={{
        border: '1px solid #d9d9d9',
        borderRadius: 6,
        fontSize: 14,
        overflow: 'hidden',
      }}
    />
  );
}
