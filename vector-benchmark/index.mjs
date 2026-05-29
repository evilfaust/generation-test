// Продакшн-индексатор: вся база PB → vec.db (sqlite-vec).
// Запуск на Mac. Читает PB только по API. Инкрементальный: эмбеддит лишь
// задачи, у которых нет записи в vec_meta или изменился text_hash.
//
//   node index.mjs            # инкремент (новые/изменённые)
//   node index.mjs --full     # пересчитать всё заново (игнор vec_meta)
//
// Результат: vector-benchmark/data/vec.db → его scp на VPS (см. README этапа 1).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { PB_URL, OLLAMA_URL, MODEL, PDF_URL, INDEX_TOKEN } from './lib/config.mjs';
import { buildText } from './2-embed.mjs';

const DIM = 1024;
const VEC_DB = new URL('./data/vec.db', import.meta.url).pathname;
const FULL = process.argv.includes('--full');
const PUSH = process.argv.includes('--push'); // слать векторы на VPS (без scp/рестарта)
const FORCE_DEDUP = process.argv.includes('--dedup'); // форсить пересчёт дублей даже если новых задач нет
const PUSH_BATCH = 200;

async function pushVectors(rows) {
  const res = await fetch(`${PDF_URL}/index-vectors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(INDEX_TOKEN ? { 'X-Index-Token': INDEX_TOKEN } : {}) },
    body: JSON.stringify({ vectors: rows }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`push ${res.status}: ${await res.text()}`);
  return res.json();
}

async function pruneRemote(validIds) {
  const res = await fetch(`${PDF_URL}/prune-vectors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(INDEX_TOKEN ? { 'X-Index-Token': INDEX_TOKEN } : {}) },
    body: JSON.stringify({ valid_task_ids: validIds }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`prune ${res.status}: ${await res.text()}`);
  return res.json();
}

async function uploadClusters(clusters) {
  const body = JSON.stringify({ clusters });
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${PDF_URL}/upload-clusters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(INDEX_TOKEN ? { 'X-Index-Token': INDEX_TOKEN } : {}) },
        body,
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`upload-clusters ${res.status}: ${await res.text()}`);
      return res.json();
    } catch (e) {
      lastErr = e;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  throw lastErr;
}

// Дедуп-кластеризация на Mac (локальная vec.db быстрая): KNN внутри темы,
// union-find, классификация exact_dup / param_family по ответу.
const DEDUP_THRESHOLD = 0.93, DEDUP_K = 10;
function isDiscriminative(ans) {
  const a = (ans || '').replace(/\s+/g, '').replace(',', '.').toLowerCase();
  if (!a || a === 'доказать' || a === 'докажите') return false;
  if (/^[абвгдеж)(,;.\s]+$/.test(a)) return false;
  return true;
}
function computeClusters(db, meta) {
  const ids = db.prepare('SELECT task_id FROM vec_tasks').all().map((r) => r.task_id);
  const parent = new Map();
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  for (const id of ids) parent.set(id, id);
  const getVec = db.prepare('SELECT embedding FROM vec_tasks WHERE task_id = ?');
  const knn = db.prepare('SELECT task_id, distance FROM vec_tasks WHERE embedding MATCH ? AND k = ? ORDER BY distance');
  for (const id of ids) {
    const topic = meta.get(id)?.topic || '';
    for (const nb of knn.all(getVec.get(id).embedding, DEDUP_K + 1)) {
      if (nb.task_id === id || (1 - nb.distance) < DEDUP_THRESHOLD) continue;
      if ((meta.get(nb.task_id)?.topic || '') !== topic) continue;
      parent.set(find(id), find(nb.task_id));
    }
  }
  const groups = new Map();
  for (const id of ids) { const r = find(id); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(id); }
  const slim = [];
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const answers = new Set(members.map((m) => (meta.get(m)?.answer || '')).filter(Boolean));
    const allSame = answers.size === 1 && members.every((m) => isDiscriminative(meta.get(m)?.answer));
    slim.push({ type: allSame ? 'exact_dup' : 'param_family', ids: members });
  }
  return slim;
}

function textHash(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

async function embed(text) {
  const r = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt: text }),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`Ollama ${r.status}: ${await r.text()}`);
  return (await r.json()).embedding;
}

async function* allTasks() {
  const perPage = 500;
  let page = 1, totalPages = 1;
  do {
    const url = `${PB_URL}/api/collections/tasks/records?perPage=${perPage}&page=${page}`
      + `&expand=topic&fields=id,statement_md,topic,answer,expand.topic.title`;
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`PB ${r.status} page ${page}`);
    const data = await r.json();
    totalPages = data.totalPages;
    for (const it of data.items) {
      yield {
        id: it.id,
        statement_md: it.statement_md || '',
        topic_title: it.expand?.topic?.title || '',
        topic: it.topic || '',
        answer: it.answer || '',
      };
    }
    page++;
  } while (page <= totalPages);
}

function openVecDb() {
  fs.mkdirSync(path.dirname(VEC_DB), { recursive: true });
  const db = new Database(VEC_DB);
  sqliteVec.load(db);
  // distance_metric=cosine — наш порог 0.90 валидирован по КОСИНУСУ, не L2.
  // vec0 вернёт distance = 1 - cos_sim, т.е. cos_sim = 1 - distance.
  db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS vec_tasks USING vec0(task_id TEXT, embedding FLOAT[${DIM}] distance_metric=cosine);`);
  db.exec(`CREATE TABLE IF NOT EXISTS vec_meta (
    task_id TEXT PRIMARY KEY, model TEXT, dim INTEGER, text_hash TEXT, indexed_at TEXT
  );`);
  return db;
}

async function main() {
  if (FULL && fs.existsSync(VEC_DB)) { fs.rmSync(VEC_DB); console.log('--full: старая vec.db удалена'); }
  const db = openVecDb();

  const getMeta = db.prepare('SELECT text_hash FROM vec_meta WHERE task_id = ?');
  const delVec = db.prepare('DELETE FROM vec_tasks WHERE task_id = ?');
  const insVec = db.prepare('INSERT INTO vec_tasks(task_id, embedding) VALUES (?, ?)');
  const upMeta = db.prepare(`INSERT INTO vec_meta(task_id, model, dim, text_hash, indexed_at)
    VALUES (@task_id, @model, @dim, @text_hash, @indexed_at)
    ON CONFLICT(task_id) DO UPDATE SET model=@model, dim=@dim, text_hash=@text_hash, indexed_at=@indexed_at`);

  console.log(`Индексация ${FULL ? '(ПОЛНАЯ)' : '(инкремент)'} из ${PB_URL} моделью ${MODEL}${PUSH ? ` + PUSH → ${PDF_URL}` : ''}...`);
  const t0 = Date.now();
  let seen = 0, embedded = 0, skipped = 0, pushed = 0;
  let pushBuf = [];
  const allIds = []; // актуальные id задач (для прунинга осиротевших векторов)
  const taskMeta = new Map(); // id → {topic, answer} для кластеризации дублей

  const flushPush = async () => {
    if (!PUSH || pushBuf.length === 0) return;
    const r = await pushVectors(pushBuf);
    pushed += pushBuf.length;
    pushBuf = [];
    return r;
  };

  for await (const task of allTasks()) {
    seen++;
    allIds.push(task.id);
    taskMeta.set(task.id, { topic: task.topic, answer: task.answer });
    const text = buildText(task);
    const hash = textHash(text);
    if (!FULL) {
      const meta = getMeta.get(task.id);
      if (meta && meta.text_hash === hash) { skipped++; continue; }
    }
    const vec = await embed(text);
    db.transaction(() => {
      delVec.run(task.id); // на случай переиндексации
      insVec.run(task.id, Buffer.from(new Float32Array(vec).buffer));
      upMeta.run({ task_id: task.id, model: MODEL, dim: DIM, text_hash: hash, indexed_at: new Date().toISOString() });
    })();
    embedded++;
    if (PUSH) {
      pushBuf.push({ task_id: task.id, vec, text_hash: hash, model: MODEL });
      if (pushBuf.length >= PUSH_BATCH) await flushPush();
    }
    if (embedded % 50 === 0) {
      const rate = embedded / ((Date.now() - t0) / 1000);
      process.stdout.write(`\r  просмотрено ${seen}, заэмбежено ${embedded}, пропущено ${skipped}  (${rate.toFixed(0)} зад/с)`);
    }
  }
  await flushPush();
  console.log();

  // Прунинг осиротевших векторов (задачи удалены из PB)
  const delLocal = db.prepare('DELETE FROM vec_tasks WHERE task_id = ?');
  const delLocalMeta = db.prepare('DELETE FROM vec_meta WHERE task_id = ?');
  const validSet = new Set(allIds);
  const localOrphans = db.prepare('SELECT task_id FROM vec_tasks').all().map((r) => r.task_id).filter((id) => !validSet.has(id));
  if (localOrphans.length) {
    db.transaction(() => { for (const id of localOrphans) { delLocal.run(id); delLocalMeta.run(id); } })();
    console.log(`   Прунинг локально: удалено ${localOrphans.length} осиротевших векторов`);
  }
  if (PUSH) {
    try {
      const pr = await pruneRemote(allIds);
      console.log(`   Прунинг на VPS: удалено ${pr.pruned}, осталось ${pr.total}`);
    } catch (e) { console.warn(`   ⚠ прунинг на VPS не удался: ${e.message}`); }
    // Дедуп пересчитываем только если реально были новые/изменённые задачи
    // (или явный --dedup). Полная кластеризация O(n²) дорогая — не гоняем вхолостую.
    if (embedded > 0 || FORCE_DEDUP) {
      try {
        const clusters = computeClusters(db, taskMeta); // на Mac, VPS не грузим
        const rc = await uploadClusters(clusters);
        console.log(`   Дубли пересчитаны и залиты: ${rc.exact_dup} точных + ${rc.param_family} параметрич.`);
      } catch (e) { console.warn(`   ⚠ пересчёт дублей не удался: ${e.message}`); }
    } else {
      console.log('   Дубли не пересчитывались (новых задач нет; форс — флаг --dedup).');
    }
  }

  const total = db.prepare('SELECT count(*) c FROM vec_tasks').get().c;
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`✅ Готово за ${secs}с. Просмотрено ${seen}, заэмбежено ${embedded}, пропущено ${skipped}.`);
  if (PUSH) console.log(`   Отправлено на VPS: ${pushed} векторов`);
  console.log(`   Всего векторов в локальной vec.db: ${total}`);
  console.log(`   Файл: ${VEC_DB} (${(fs.statSync(VEC_DB).size / 1024 / 1024).toFixed(1)} MB)`);
  db.close();
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
