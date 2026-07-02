import { pb, _logAudit, aiHeaders } from './client.js';
import { shuffleArray } from '../../utils/shuffle';
import { escapeFilter } from '../../utils/escapeFilter';

export const extrasApi = {
  // Прямой экспорт хелпера для случаев, когда нужно залогировать кастомное
  // действие из компонента (редко; обычно логируется автоматически).
  logAudit: _logAudit,

  // ── Audit log: чтение (только superadmin) ───────────────────────────────
  async getAuditLog({ page = 1, perPage = 50, filter = '' } = {}) {
    try {
      return await pb.collection('audit_log').getList(page, perPage, {
        sort: '-created',
        filter,
      });
    } catch (error) {
      console.error('Error fetching audit log:', error);
      throw error;
    }
  },

  // ── Векторный дедуп (B2) ─────────────────────────────────────────────────
  // Кластеры считаются pdf-service'ом (sqlite-vec), помечаются в task_families.

  // Получить дедуп-кластеры на ревью с pdf-service.
  async getDuplicateClusters({ type = 'exact_dup', page = 1, perPage = 20 } = {}) {
    const base = import.meta.env.VITE_PDF_SERVICE_URL || 'http://localhost:3001';
    const res = await fetch(`${base}/duplicates?type=${type}&page=${page}&perPage=${perPage}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Сервис дублей ответил ${res.status}`);
    return res.json();
  },

  // Пометить кластер как dedup_cluster: создать task_families + members.
  // members: [{ id, similarity? }]. Задачи НЕ удаляются — только помечаются.
  async markDedupCluster(members, label = '') {
    const family = await pb.collection('task_families').create({
      type: 'dedup_cluster',
      label: label.slice(0, 200),
    });
    for (const m of members) {
      try {
        await pb.collection('task_family_members').create({
          family: family.id,
          task: m.id,
          ...(m.similarity != null ? { similarity: m.similarity } : {}),
        });
      } catch (e) {
        console.debug('[dedup] member skip:', e?.message);
      }
    }
    _logAudit('create', 'task_families', family.id, `dedup ${members.length} задач: ${label}`.slice(0, 500));
    return family;
  },

  // Пометить кластер как «не дубли» (просмотрено) — больше не в очереди ревью.
  async markNotDuplicate(members, label = '') {
    const family = await pb.collection('task_families').create({
      type: 'reviewed_not_dup',
      label: label.slice(0, 200),
    });
    for (const m of members) {
      try {
        await pb.collection('task_family_members').create({ family: family.id, task: m.id });
      } catch (e) { console.debug('[not-dup] member skip:', e?.message); }
    }
    _logAudit('create', 'task_families', family.id, `not_dup ${members.length} задач`.slice(0, 500));
    return family;
  },

  // Сохранить семейство вариантов (A4): образец + параллели.
  // base: [{id}]; parallels: [[{id, cos?}], ...] (массив вариантов).
  async markVariantFamily(base, parallels, label = '') {
    const family = await pb.collection('task_families').create({
      type: 'variant_family',
      label: label.slice(0, 200),
    });
    const add = async (taskId, role, similarity) => {
      try {
        await pb.collection('task_family_members').create({
          family: family.id, task: taskId, role,
          ...(similarity != null ? { similarity } : {}),
        });
      } catch (e) { console.debug('[variant-family] member skip:', e?.message); }
    };
    for (const m of base) await add(m.id, 'base');
    for (let vi = 0; vi < parallels.length; vi++) {
      for (const m of parallels[vi]) {
        if (m?.task_id || m?.id) await add(m.task_id || m.id, `parallel_${vi + 1}`, m.cos);
      }
    }
    const cnt = base.length + parallels.reduce((s, v) => s + v.filter((m) => m?.task_id || m?.id).length, 0);
    _logAudit('create', 'task_families', family.id, `variant_family ${cnt} задач: ${label}`.slice(0, 500));
    return family;
  },

  // ── Сканирование бумажных бланков ответов №1 (v3.9.116) ────────────────
  // Фото заполненного бланка → pdf-service /scan-blank (vision-LLM) →
  // { fields: {"1": "17", ...}, replacements, uncertain }. Замены уже применены.
  // Результат обязательно проходит верификацию учителем перед записью.
  async scanBlank({ imageBase64, tasksCount }) {
    const base = import.meta.env.VITE_PDF_SERVICE_URL || 'http://localhost:3001';
    const res = await fetch(`${base}/scan-blank`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...aiHeaders() },
      body: JSON.stringify({ image: imageBase64, tasks_count: tasksCount }),
      signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) {
      let msg = `Сервис распознавания ответил ${res.status}`;
      try { msg = (await res.json()).error || msg; } catch { /* не-JSON */ }
      throw new Error(msg);
    }
    return res.json();
  },
};
