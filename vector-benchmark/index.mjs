// ─────────────────────────────────────────────────────────────────────────────
//  Индексатор векторного поиска Lemma
//  Что делает: берёт задачи из PocketBase → считает эмбеддинги (bge-m3 через
//  Ollama на этом Mac) → сохраняет в локальную data/vec.db → (опц.) заливает
//  на VPS, чтобы заработал поиск «Похожие», «Параллельные варианты» и т.п.
//
//  Запуск (см. также README.md):
//    node index.mjs                 инкремент локально, без отправки на VPS
//    node index.mjs --push          инкремент + отправка на VPS   ← обычный режим
//    node index.mjs --full --push   пересчитать ВСЕ задачи заново + отправка
//    node index.mjs --push --dedup  + пересчёт дубль-кластеров (долго, ~5-6 мин)
//    node index.mjs --help          показать эту справку
//
//  Токен для отправки на VPS берётся из переменной INDEX_TOKEN или из файла
//  .index-token рядом с этим скриптом.
// ─────────────────────────────────────────────────────────────────────────────
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { existsSync, mkdirSync, statSync } from 'fs';
import { PB_URL, OLLAMA_URL, MODEL, PDF_URL, INDEX_TOKEN } from './lib/config.mjs';

const DATA_DIR = new URL('./data/', import.meta.url).pathname;
const DB_PATH = `${DATA_DIR}vec.db`;
const START = Date.now();

const args = process.argv.slice(2);
const FULL = args.includes('--full');
const PUSH = args.includes('--push');
const DEDUP = args.includes('--dedup');
const HELP = args.includes('--help') || args.includes('-h');

// ── маленькие утилиты вывода ─────────────────────────────────────────────────
const log = (s = '') => process.stdout.write(s + '\n');
const same = (s) => process.stdout.write('\r' + s);          // перезапись строки
const fmtSec = (ms) => `${Math.round(ms / 1000)}с`;
const hr = () => log('─'.repeat(60));

function printHelp() {
  log(`
Индексатор векторного поиска Lemma

Использование:
  node index.mjs [флаги]

Флаги:
  (без флагов)   Инкремент локально — посчитать эмбеддинги только для новых/
                 изменённых задач и сохранить в data/vec.db. На VPS НЕ отправляет.
  --push         Инкремент + отправить новые вектора на VPS. ← обычный режим
                 (то же самое, что \`npm run index\`)
  --full         Пересчитать эмбеддинги ВСЕХ задач заново (медленно). Сочетается
                 с --push.
  --dedup        Дополнительно пересчитать кластеры дублей для вкладки
                 «Похожие (вектор)». Тяжело (~5-6 мин). То же — \`npm run dedup\`.
  --help, -h     Показать эту справку.

Источники (можно переопределить переменными окружения):
  PocketBase : ${PB_URL}
  Ollama     : ${OLLAMA_URL}  (модель ${MODEL})
  VPS push   : ${PDF_URL}
  Токен      : ${INDEX_TOKEN ? 'найден' : 'НЕ найден (нужен для --push)'}
`);
}

// ── предполётные проверки: чтобы было понятно, ПОЧЕМУ не работает ────────────
async function ping(url, opts = {}) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), ...opts });
    return res.ok;
  } catch {
    return false;
  }
}

async function preflight() {
  log('🔍 Проверяю окружение перед запуском...');

  // 1) Ollama (локальная модель — без неё считать эмбеддинги нечем)
  const ollamaOk = await ping(`${OLLAMA_URL}/api/tags`);
  if (!ollamaOk) {
    log(`   ❌ Ollama недоступна на ${OLLAMA_URL}`);
    log(`      Запусти Ollama (приложение или \`ollama serve\`) и убедись, что есть модель:`);
    log(`      ollama pull ${MODEL}`);
    return false;
  }
  log(`   ✓ Ollama отвечает (${OLLAMA_URL})`);

  // 2) PocketBase (откуда берём задачи)
  const pbOk = await ping(`${PB_URL}/api/health`);
  if (!pbOk) {
    log(`   ❌ PocketBase недоступен на ${PB_URL}`);
    log(`      Проверь интернет / VPN (Lemma на VPS).`);
    return false;
  }
  log(`   ✓ PocketBase отвечает (${PB_URL})`);

  // 3) Токен для отправки на VPS — нужен только при --push
  if (PUSH && !INDEX_TOKEN) {
    log(`   ❌ Нет токена для отправки на VPS.`);
    log(`      Создай файл .index-token рядом со скриптом или задай INDEX_TOKEN=...`);
    return false;
  }
  if (PUSH) log(`   ✓ Токен для VPS найден`);

  return true;
}

// ── работа с PocketBase ──────────────────────────────────────────────────────
async function pbFetchAllTasks() {
  const perPage = 200;
  let page = 1;
  let items = [];
  for (;;) {
    const url = `${PB_URL}/api/collections/tasks/records?page=${page}&perPage=${perPage}&fields=id,statement_md,answer,topic,updated&skipTotal=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`PocketBase ответил ${res.status}`);
    const data = await res.json();
    const batch = data.items || [];
    if (batch.length === 0) break;
    items = items.concat(batch);
    same(`   загружено задач: ${items.length}`);
    if (batch.length < perPage) break;
    page++;
  }
  log('');
  return items;
}

function buildText(t) {
  return [t.statement_md || '', t.answer ? `Ответ: ${t.answer}` : '']
    .filter(Boolean).join('\n').trim();
}

// ── эмбеддинги через Ollama ──────────────────────────────────────────────────
async function embed(text) {
  const r = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt: text }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`Ollama ответил ${r.status}`);
  const j = await r.json();
  return j.embedding;
}

function toF32Blob(arr) {
  return Buffer.from(new Float32Array(arr).buffer);
}

// ── отправка на VPS ──────────────────────────────────────────────────────────
async function pushVectors(batch) {
  const res = await fetch(`${PDF_URL}/index-vectors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(INDEX_TOKEN ? { 'X-Index-Token': INDEX_TOKEN } : {}) },
    body: JSON.stringify({ vectors: batch }),
    signal: AbortSignal.timeout(30000),
  });
  return { ok: res.ok, status: res.status };
}

async function pruneVectors(liveIds) {
  const res = await fetch(`${PDF_URL}/prune-vectors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(INDEX_TOKEN ? { 'X-Index-Token': INDEX_TOKEN } : {}) },
    body: JSON.stringify({ live_ids: [...liveIds] }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) return { deleted: 0, remaining: '?' };
  return res.json();
}

async function recomputeDedup(db) {
  // тяжёлая O(n²) кластеризация — считается здесь, на Mac, результат летит на VPS
  const { runDedup } = await import('./dedup-scan.mjs');
  await runDedup(db, { PDF_URL, INDEX_TOKEN });
}

// ── главный сценарий ─────────────────────────────────────────────────────────
async function main() {
  if (HELP) { printHelp(); return; }

  hr();
  log('📊 Индексация векторного поиска Lemma');
  log(`   Режим: ${FULL ? 'ПОЛНЫЙ пересчёт всех задач' : 'инкремент (только новые/изменённые)'}` +
      `${PUSH ? ' · с отправкой на VPS' : ' · ТОЛЬКО локально (без VPS)'}` +
      `${DEDUP ? ' · + пересчёт дублей' : ''}`);
  hr();

  if (!(await preflight())) {
    log('\n⛔ Остановлено: окружение не готово (см. выше).');
    process.exitCode = 1;
    return;
  }

  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  sqliteVec.load(db);
  db.exec(`CREATE TABLE IF NOT EXISTS meta (task_id TEXT PRIMARY KEY, updated TEXT, hash TEXT)`);
  db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS vec_tasks USING vec0(task_id TEXT PRIMARY KEY, embedding float[1024])`);

  // Шаг 1 — выгрузка задач
  log('\n[1/4] Загружаю список задач из PocketBase...');
  const tasks = await pbFetchAllTasks();
  log(`   Всего задач в базе: ${tasks.length}`);

  // Шаг 2 — что нужно пересчитать
  log('\n[2/4] Сравниваю с локальной базой эмбеддингов...');
  const existing = new Map();
  for (const row of db.prepare('SELECT task_id, updated FROM meta').all()) {
    existing.set(row.task_id, row.updated);
  }
  const toEmbed = [];
  for (const t of tasks) {
    if (!buildText(t)) continue; // пустые задачи пропускаем
    if (FULL || !existing.has(t.id) || existing.get(t.id) !== t.updated) toEmbed.push(t);
  }
  const skipped = tasks.length - toEmbed.length;
  if (toEmbed.length === 0) {
    log(`   Новых/изменённых задач нет — всё уже проиндексировано (${skipped} пропущено).`);
  } else {
    log(`   Нужно посчитать эмбеддинги: ${toEmbed.length} (пропущено без изменений: ${skipped})`);
  }

  // Шаг 3 — эмбеддинги
  log('\n[3/4] Считаю эмбеддинги через Ollama (модель ' + MODEL + ')...');
  let embedded = 0, failed = 0;
  const pushBatch = [];
  const t0 = Date.now();
  for (const t of toEmbed) {
    let vec;
    try {
      vec = await embed(buildText(t));
    } catch (e) {
      failed++;
      log(`\n   ⚠ не удалось посчитать задачу ${t.id}: ${e.message}`);
      continue;
    }
    db.prepare('INSERT OR REPLACE INTO vec_tasks(task_id, embedding) VALUES (?, ?)').run(t.id, toF32Blob(vec));
    db.prepare('INSERT OR REPLACE INTO meta(task_id, updated, hash) VALUES (?, ?, ?)').run(t.id, t.updated, '');
    pushBatch.push({ task_id: t.id, embedding: vec });
    embedded++;
    if (embedded % 10 === 0 || embedded === toEmbed.length) {
      const elapsed = (Date.now() - t0) / 1000;
      const rate = elapsed > 0 ? embedded / elapsed : 0;
      const left = rate > 0 ? Math.round((toEmbed.length - embedded) / rate) : 0;
      same(`   ${embedded}/${toEmbed.length}  (${rate.toFixed(1)} зад/с, осталось ~${left}с)   `);
    }
  }
  if (toEmbed.length > 0) log('');
  log(`   Посчитано: ${embedded}${failed ? `, с ошибками: ${failed}` : ''}`);

  // Прунинг локально — убрать вектора удалённых задач
  const liveIds = new Set(tasks.map((t) => t.id));
  const localIds = db.prepare('SELECT task_id FROM vec_tasks').all().map((r) => r.task_id);
  const toPrune = localIds.filter((id) => !liveIds.has(id));
  if (toPrune.length > 0) {
    const delV = db.prepare('DELETE FROM vec_tasks WHERE task_id = ?');
    const delM = db.prepare('DELETE FROM meta WHERE task_id = ?');
    db.transaction((ids) => { for (const id of ids) { delV.run(id); delM.run(id); } })(toPrune);
    log(`   Удалено из локальной базы (задачи удалены из Lemma): ${toPrune.length}`);
  }

  // Шаг 4 — отправка на VPS
  if (PUSH) {
    log('\n[4/4] Отправляю на VPS...');
    if (pushBatch.length > 0) {
      const CHUNK = 500;
      let sent = 0;
      for (let i = 0; i < pushBatch.length; i += CHUNK) {
        const chunk = pushBatch.slice(i, i + CHUNK);
        const res = await pushVectors(chunk);
        if (!res.ok) { log(`   ⚠ ошибка отправки пачки: HTTP ${res.status}`); }
        else { sent += chunk.length; same(`   отправлено векторов: ${sent}/${pushBatch.length}   `); }
      }
      if (pushBatch.length > 0) log('');
    } else {
      log('   Новых векторов нет — отправлять нечего.');
    }
    const pruneRes = await pruneVectors(liveIds);
    log(`   Синхронизация удалённых на VPS: убрано ${pruneRes.deleted ?? 0}, осталось ${pruneRes.remaining ?? '?'}`);
  } else {
    log('\n[4/4] Отправка на VPS пропущена (нет флага --push).');
    log('       Поиск на сайте использует данные на VPS — без --push изменения');
    log('       останутся только в локальной data/vec.db.');
  }

  // Дедуп (опционально)
  if (DEDUP) {
    log('\n➕ Пересчитываю кластеры дублей (это долго, ~5-6 мин)...');
    try {
      await recomputeDedup(db);
      log('   ✓ Кластеры дублей обновлены и отправлены на VPS.');
    } catch (e) {
      log(`   ⚠ пересчёт дублей не удался: ${e.message}`);
    }
  }

  // Итог
  const totalVec = db.prepare('SELECT COUNT(*) AS n FROM vec_tasks').get().n;
  const sizeMb = (statSync(DB_PATH).size / 1e6).toFixed(1);
  hr();
  log(`✅ Готово за ${fmtSec(Date.now() - START)}`);
  log(`   Задач в базе: ${tasks.length}  ·  посчитано сейчас: ${embedded}  ·  пропущено: ${skipped}`);
  if (PUSH) log(`   Отправлено на VPS: ${pushBatch.length} векторов`);
  log(`   Всего векторов в локальной vec.db: ${totalVec}  (${sizeMb} MB)`);
  if (!PUSH && embedded > 0) {
    log('   ⚠ Чтобы изменения увидел сайт — запусти ещё раз с флагом --push.');
  }
  hr();
}

main().catch((e) => {
  log(`\n❌ Ошибка: ${e.message}`);
  process.exit(1);
});
