import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
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

// Моноширинный шрифт + растягивание на всю высоту панели редактора.
const editorTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '14px' },
  '.cm-scroller': { fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace" },
});

/**
 * Редактор markdown+LaTeX для раздела «Теория» (CodeMirror 6).
 * Пришёл на смену Monaco: тот же markdown-ввод, но без 8.7 МБ языковых
 * воркеров; KaTeX-линтер подчёркивает битые формулы прямо в коде.
 *
 * Наружу (через `ref`) отдаёт компактный императивный хэндл, не зависящий
 * от конкретной библиотеки:
 *   - `insert({ before, after, text, newLine })` — вставка/обёртка выделения
 *     (тот же контракт, что был у Monaco-тулбара);
 *   - `focus()` — вернуть фокус в редактор.
 */
function applyInsert(view, { before = '', after = '', text = '', newLine = false }) {
  const { state } = view;
  const { from, to } = state.selection.main;
  const selected = state.sliceDoc(from, to);

  let insertText;
  let cursorPos;
  if (text) {
    // Полная вставка (таблицы, разделитель, картинка, ссылка).
    insertText = text;
    cursorPos = from + text.length;
  } else if (newLine) {
    // Блочный элемент с новой строки (заголовки, списки, цитата, код).
    const line = state.doc.lineAt(from);
    const prefix = line.text.trim().length > 0 ? '\n' : '';
    insertText = `${prefix}${before}${selected}${after}`;
    cursorPos = selected ? from + insertText.length : from + insertText.length - after.length;
  } else {
    // Inline-обёртка выделения (жирный, курсив, формула).
    insertText = `${before}${selected}${after}`;
    cursorPos = selected ? from + insertText.length : from + before.length;
  }

  view.dispatch({
    changes: { from, to, insert: insertText },
    selection: { anchor: cursorPos },
  });
  view.focus();
}

const TheoryMarkdownEditor = forwardRef(function TheoryMarkdownEditor({ value, onChange }, ref) {
  const viewRef = useRef(null);
  const extensions = useMemo(
    () => [markdown(), EditorView.lineWrapping, editorTheme, katexLinter, lintGutter()],
    [],
  );

  useImperativeHandle(ref, () => ({
    insert(opts) {
      const view = viewRef.current;
      if (view) applyInsert(view, opts);
    },
    focus() {
      viewRef.current?.focus();
    },
    get view() {
      return viewRef.current;
    },
  }), []);

  return (
    <CodeMirror
      className="theory-cm-editor"
      value={value}
      height="100%"
      onChange={onChange}
      onCreateEditor={(view) => { viewRef.current = view; }}
      extensions={extensions}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: true,
        highlightActiveLineGutter: true,
        searchKeymap: true,
      }}
    />
  );
});

export default TheoryMarkdownEditor;
