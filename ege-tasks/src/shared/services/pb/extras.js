import { pb, _logAudit, aiHeaders } from './client.js';
import { getFullListByOr } from './chunked.js';
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
    // Семейство из 5 параллелей по 20 задач — это 120 записей. Последовательный
    // цикл держал модалку сохранения полминуты; шлём пачками по 8.
    const jobs = [
      ...base.map((m) => () => add(m.id, 'base')),
      ...parallels.flatMap((variant, vi) => variant
        .filter((m) => m?.task_id || m?.id)
        .map((m) => () => add(m.task_id || m.id, `parallel_${vi + 1}`, m.cos))),
    ];
    const CHUNK = 8;
    for (let i = 0; i < jobs.length; i += CHUNK) {
      await Promise.all(jobs.slice(i, i + CHUNK).map((run) => run()));
    }
    const cnt = base.length + parallels.reduce((s, v) => s + v.filter((m) => m?.task_id || m?.id).length, 0);
    _logAudit('create', 'task_families', family.id, `variant_family ${cnt} задач: ${label}`.slice(0, 500));
    return family;
  },

  // Семейства параллелей (A4), в которые уже входят эти задачи. Нужно, чтобы
  // повторный подбор по той же работе не выдавал те же самые параллели и чтобы
  // учитель видел: для этого набора семейство уже создавалось.
  // Возвращает [{ id, label, created, taskIds }] — задачи всех участников семейств.
  async getVariantFamiliesByTasks(taskIds = []) {
    if (!taskIds.length) return [];
    try {
      const mine = await getFullListByOr('task_family_members', 'task', taskIds, {
        fields: 'id,family,task', expand: 'family',
      });
      const familyIds = [...new Set(
        mine.filter((m) => m.expand?.family?.type === 'variant_family').map((m) => m.family)
      )];
      if (!familyIds.length) return [];

      const members = await getFullListByOr('task_family_members', 'family', familyIds, {
        fields: 'id,family,task,role',
      });
      const byFamily = new Map();
      for (const m of members) {
        if (!byFamily.has(m.family)) byFamily.set(m.family, []);
        byFamily.get(m.family).push(m.task);
      }
      const meta = new Map(
        mine.filter((m) => m.expand?.family).map((m) => [m.family, m.expand.family])
      );
      return familyIds.map((id) => ({
        id,
        label: meta.get(id)?.label || '',
        created: meta.get(id)?.created || null,
        taskIds: byFamily.get(id) || [],
      }));
    } catch (error) {
      console.error('Error fetching variant families:', error);
      return [];
    }
  },

  // Отклонённая параллель: учитель заменил подобранную задачу вручную — значит
  // пара «образец → эта задача» плохая. Храним как крошечное семейство, чтобы
  // следующий подбор её не предлагал. Требует значения 'rejected_parallel'
  // в task_families.type (миграция 1784000000).
  async markRejectedParallel(baseTaskId, rejectedTaskId) {
    if (!baseTaskId || !rejectedTaskId) return null;
    try {
      const family = await pb.collection('task_families').create({
        type: 'rejected_parallel',
        label: 'отклонено вручную',
      });
      await pb.collection('task_family_members').create({ family: family.id, task: baseTaskId, role: 'base' });
      await pb.collection('task_family_members').create({ family: family.id, task: rejectedTaskId, role: 'rejected' });
      return family;
    } catch (error) {
      // Пока миграция не применена на сервере — молча пропускаем: подбор
      // работает и без памяти об отклонениях.
      console.debug('[rejected-parallel] skip:', error?.message);
      return null;
    }
  },

  // Отклонённые ранее пары для набора задач: { [baseTaskId]: [taskId, ...] }.
  async getRejectedParallels(baseTaskIds = []) {
    if (!baseTaskIds.length) return {};
    try {
      const mine = await getFullListByOr('task_family_members', 'task', baseTaskIds, {
        fields: 'id,family,task,role', expand: 'family',
      });
      const familyIds = mine
        .filter((m) => m.role === 'base' && m.expand?.family?.type === 'rejected_parallel')
        .map((m) => m.family);
      if (!familyIds.length) return {};

      const members = await getFullListByOr('task_family_members', 'family', [...new Set(familyIds)], {
        fields: 'id,family,task,role',
      });
      const baseOf = new Map();
      const rejectedOf = new Map();
      for (const m of members) {
        if (m.role === 'base') baseOf.set(m.family, m.task);
        else if (m.role === 'rejected') {
          if (!rejectedOf.has(m.family)) rejectedOf.set(m.family, []);
          rejectedOf.get(m.family).push(m.task);
        }
      }
      const out = {};
      for (const [family, base] of baseOf) {
        const rejected = rejectedOf.get(family) || [];
        if (!rejected.length) continue;
        out[base] = [...new Set([...(out[base] || []), ...rejected])];
      }
      return out;
    } catch (error) {
      console.error('Error fetching rejected parallels:', error);
      return {};
    }
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
