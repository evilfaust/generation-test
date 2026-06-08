// Импорт ОДНОЙ задачи с решу.ЕГЭ (базовый) в банк Лемма — для on-demand связки
// внешних результатов с задачами Лемме. Переиспользует серверный парсер + born-local.
import { api } from '../shared/services/pocketbase';
import { parseSdamgiaResult } from './markdownTaskParser';
import { rewriteImageUrls } from '../components/TaskStatementRenderer';

const PDF = import.meta.env.VITE_PDF_SERVICE_URL || '/pdf';

async function fetchImageAsFile(url, name) {
  const resp = await fetch(`${PDF}/fetch-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!resp.ok) return null;
  const blob = await resp.blob();
  if (!blob.size) return null;
  const ext = (blob.type.split('/')[1] || 'png').replace('+xml', '');
  return new File([blob], `${name}.${ext}`, { type: blob.type || 'image/png' });
}

// problemId — решу id; taskNumber — № задания (1..21); topicId — тема ege_base.
export async function importReshuProblem({ problemId, taskNumber, topicId }) {
  const url = `https://mathb-ege.sdamgia.ru/problem?id=${problemId}`;
  const resp = await fetch(`${PDF}/parse-sdamgia`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!resp.ok) throw new Error('Парсер недоступен');
  const data = await resp.json();
  const probs = data.problems || [];
  if (!probs.length) throw new Error('Задача не найдена на решу');

  const parsed = parseSdamgiaResult(probs, {
    taskNumber, sourceType: 'ege_base', examPart: 1, difficulty: '1',
  });
  const task = parsed.tasks[0];
  if (!task) throw new Error('Пустой результат парсинга');

  const multiImage = (task.condition_images?.length || 0) >= 2;
  const payload = {
    code: `${taskNumber}-r${problemId}`,
    topic: topicId,
    difficulty: task.difficulty || '1',
    statement_md: task.statement_md,
    answer: task.answer || '',
    solution_md: task.solution_md || '',
    explanation_md: '',
    source: parsed.metadata.source || 'РЕШУ ЕГЭ — математика базовая',
    year: parsed.metadata.year || null,
    has_image: multiImage ? false : Boolean(task.imageUrl),
    image_url: multiImage ? '' : (task.imageUrl || ''),
    sdamgia_id: task.sdamgiaId || String(problemId),
    sdamgia_url: task.sdamgia_url || url,
    exam_part: 1,
    latex_needs_review: !!task.latex_needs_review,
  };
  const created = await api.createTask(payload);

  // Картинки → task_images (через прокси), затем born-local rewrite md.
  const roles = [
    ['condition', task.condition_images || []],
    ['solution', task.solution_images || []],
  ];
  const uploaded = [];
  for (const [role, imgs] of roles) {
    for (const img of imgs) {
      try {
        const f = await fetchImageAsFile(img.url, img.file_id || `${role}_${img.order || 1}`);
        if (!f) continue;
        const rec = await api.createTaskImage({
          task: created.id, role, order: img.order,
          fileBlob: f, fileName: f.name,
          sdamgia_file_id: img.file_id, original_url: img.url,
        });
        if (rec) uploaded.push(rec);
      } catch (e) {
        console.warn('[importReshu] image:', e?.message);
      }
    }
  }
  if (uploaded.length) {
    const patch = {};
    for (const field of ['statement_md', 'solution_md']) {
      const src = created[field];
      if (!src) continue;
      const next = rewriteImageUrls(src, uploaded);
      if (next !== src) patch[field] = next;
    }
    if (Object.keys(patch).length) {
      const upd = await api.updateTask(created.id, patch);
      return upd || created;
    }
  }
  return created;
}
