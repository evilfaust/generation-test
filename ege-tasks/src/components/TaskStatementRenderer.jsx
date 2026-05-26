// TaskStatementRenderer — рендерер текста задачи (statement_md / solution_md /
// criteria_md) с подменой ![image](внешний_url) на ссылку на локальный
// файл из коллекции task_images (если есть совпадение по original_url
// или по извлечённому sdamgia file_id из URL).
//
// Старые задачи (без task_images) — внешний URL остаётся как был → продолжают
// работать как раньше.
//
// Props:
//   text     — string, markdown с inline ![image](url) и $LaTeX$
//   images   — массив записей task_images для этой задачи (всех ролей или
//              отфильтрованный по нужной). Каждая запись: { id, file,
//              original_url, sdamgia_file_id, role, order, ... }
//              Можно передать пустой массив — рендерер просто отрендерит как есть.
//   inline   — bool, см. MathRenderer
//
// Использование:
//   <TaskStatementRenderer text={task.statement_md} images={images.condition} />
import { useMemo } from 'react';
import MathRenderer from './MathRenderer';
import { api } from '../services/pocketbase';

/**
 * Извлечь sdamgia file_id из URL: /get_file?id=145381 → "145381"
 */
function extractSdamgiaFileId(url) {
  const m = String(url || '').match(/[?&]id=(\d+)/);
  return m ? m[1] : '';
}

/**
 * Заменить в markdown все ![image](url) с внешними URL на локальные
 * task_images.file URL, если для них есть запись.
 */
function rewriteImageUrls(md, images) {
  if (!md) return '';
  if (!Array.isArray(images) || images.length === 0) return md;

  // Строим две индексные таблицы для быстрого поиска
  const byOriginalUrl = new Map();
  const byFileId = new Map();
  for (const rec of images) {
    if (rec.original_url) byOriginalUrl.set(rec.original_url, rec);
    if (rec.sdamgia_file_id) byFileId.set(String(rec.sdamgia_file_id), rec);
  }

  // ![image](url) — захватываем URL, проверяем подмену
  return md.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (full, alt, url) => {
    let rec = byOriginalUrl.get(url);
    if (!rec) {
      const fid = extractSdamgiaFileId(url);
      if (fid) rec = byFileId.get(fid);
    }
    if (!rec) return full; // нет совпадения — оставляем внешний URL
    const localUrl = api.getTaskImageRecordUrl(rec);
    if (!localUrl) return full;
    return `![${alt || 'image'}](${localUrl})`;
  });
}

export default function TaskStatementRenderer({ text, images = [], inline = true, answerBoxes = false }) {
  const rewritten = useMemo(() => rewriteImageUrls(text, images), [text, images]);
  return <MathRenderer text={rewritten} inline={inline} answerBoxes={answerBoxes} />;
}

// Экспорт чистой функции для использования вне React (тесты, печать и пр.)
export { rewriteImageUrls };
