import { forwardRef, lazy, Suspense } from 'react';
import { Input } from 'antd';

const { TextArea } = Input;

// CodeMirror и его расширения тянутся отдельным чанком только когда
// учитель реально включил «Расширенный редактор» (mode='code').
const LatexCodeMirror = lazy(() => import('./LatexCodeMirror'));

/**
 * Единое поле ввода LaTeX/markdown с двумя режимами:
 *  - mode='plain' (по умолчанию) — обычный Ant Input.TextArea (привычное поведение);
 *  - mode='code'  — CodeMirror 6 c подсветкой markdown, переносом строк,
 *                   авторазмером и встроенным поиском/заменой (Ctrl+F / Ctrl+H).
 *
 * Используется внутри Form.Item: Form инжектит `value` и `onChange`.
 * `onTextChange(value)` — отдельный колбэк для побочных эффектов (предпросмотр),
 * не конфликтует с Form (тот управляет своим onChange).
 *
 * ref форвардится на нативный <textarea> только в plain-режиме — это нужно
 * существующей логике конвертации в таблицу (чтение выделения). В code-режиме
 * ref недоступен → конвертация работает по всему полю (приемлемая деградация).
 */
const LatexField = forwardRef(function LatexField(
  { mode = 'plain', value, onChange, onTextChange, rows = 4, placeholder = '' },
  ref,
) {
  if (mode === 'code') {
    return (
      <Suspense
        fallback={(
          <TextArea rows={rows} value={value} placeholder="Загрузка редактора…" disabled />
        )}
      >
        <LatexCodeMirror
          value={value || ''}
          onChange={(val) => {
            onChange?.(val);
            onTextChange?.(val);
          }}
          placeholder={placeholder}
          minRows={rows}
        />
      </Suspense>
    );
  }

  return (
    <TextArea
      ref={ref}
      rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={(e) => {
        onChange?.(e);
        onTextChange?.(e.target.value);
      }}
    />
  );
});

export default LatexField;
