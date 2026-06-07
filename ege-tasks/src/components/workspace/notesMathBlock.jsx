import { useEffect, useMemo, useRef, useState } from 'react';
import { createReactBlockSpec } from '@blocknote/react';
import { insertOrUpdateBlock } from '@blocknote/core';
import katex from 'katex';

// Блок-формула для BlockNote: при фокусе — редактируется как LaTeX-текст,
// при уходе курсора — рендерится в красивую формулу KaTeX.
function MathBlockView({ block, editor }) {
  const editable = editor.isEditable !== false;
  const formula = block.props.formula || '';
  const [editing, setEditing] = useState(editable && !formula);
  const [draft, setDraft] = useState(formula);
  const taRef = useRef();

  useEffect(() => { setDraft(formula); }, [formula]);
  useEffect(() => {
    if (editing && taRef.current) {
      taRef.current.focus();
      taRef.current.select?.();
    }
  }, [editing]);

  const html = useMemo(() => {
    try {
      return katex.renderToString(formula || '\\,', { throwOnError: false, displayMode: true });
    } catch {
      return `<span style="color:#cf1322">${formula}</span>`;
    }
  }, [formula]);

  const commit = () => {
    if (draft !== formula) {
      editor.updateBlock(block, { type: 'math', props: { formula: draft } });
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <textarea
        ref={taRef}
        className="bn-math-input"
        value={draft}
        placeholder="LaTeX, напр. \frac{a}{b} или x^2+y^2=r^2"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { setDraft(formula); setEditing(false); }
        }}
        rows={Math.max(1, draft.split('\n').length)}
      />
    );
  }

  return (
    <div
      className="bn-math"
      title={editable ? 'Нажмите, чтобы редактировать формулу' : undefined}
      onClick={editable ? () => { setDraft(formula); setEditing(true); } : undefined}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export const MathBlock = createReactBlockSpec(
  { type: 'math', propSchema: { formula: { default: '' } }, content: 'none' },
  { render: (props) => <MathBlockView block={props.block} editor={props.editor} /> },
);

// Пункт slash-меню для вставки формулы.
export function mathSlashItem(editor) {
  return {
    title: 'Формула (LaTeX)',
    subtext: 'Блок с формулой KaTeX',
    aliases: ['latex', 'math', 'формула', 'tex', 'формулу'],
    group: 'Дополнительно',
    onItemClick: () => insertOrUpdateBlock(editor, { type: 'math', props: { formula: '' } }),
  };
}
