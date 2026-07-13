// ─────────────────────────────────────────────────────────────────────────────
//  Индексатор векторного поиска Lemma
//
//  Что делает: берёт задачи из PocketBase → считает эмбеддинги (bge-m3 через
//  Ollama на этом Mac) → сохраняет в локальную data/vec.db → (опц.) заливает
//  на VPS, где работает поиск «Похожие», «Параллельные варианты» и т.п.
//  Инкрементальный: эмбеддит только задачи, у которых изменился text_hash.
//
//  Запуск (см. README.md):
//    node index.mjs                 инкремент локально, без отправки на VPS
//    node index.mjs --push          инкремент + отправка на VPS   ← обычный режим
//    node index.mjs --full --push   пересчитать ВСЕ задачи заново + отправка
//    node index.mjs --push --dedup  + пересчёт дубль-кластеров (долго, ~5-6 мин)
//    node index.mjs --help          показать справку
//
//  Токен для отправки на VPS — из переменной INDEX_TOKEN или файла .index-token.
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { PB_URL, OLLAMA_URL, MODEL, PDF_URL, INDEX_TOKEN } from './lib/config.mjs';
import { buildText, buildGeoText } from './2-embed.mjs';

const DIM = 1024;
const VEC_DB = new URL('./data/vec.db', import.meta.url).pathname;
const PUSH_BATCH = 200;
const START = Date.now();

const FULL = process.argv.includes('--full');
const PUSH = process.argv.includes('--push');
const FORCE_DEDUP = process.argv.includes('--dedup');
const GEO = process.argv.includes('--geometry');
const HELP = process.argv.includes('--help') || process.argv.includes('-h');

// ⛔ Геометрия с Mac БОЛЬШЕ НЕ индексируется (v3.9.125): vec_geometry считается
// СЕРВЕРОМ через Timeweb AI Gateway (text-embedding-3-large @1024d) — это даёт
// NL-поиск «/geo/search» с сайта. Пуш bge-m3-векторов отсюда ОТРАВИЛ БЫ индекс
// (смешение моделей). Переиндексация: `npm run index:geo` (= node geo-reindex.mjs,
// дёргает POST /geo/reindex на VPS и ждёт).
if (GEO) {
  console.log('⛔ --geometry больше не поддерживается с Mac: индекс геометрии считает VPS');
  console.log('   (text-embedding-3-large через Timeweb AI Gateway, см. vec-search.js).');
  console.log('   Запуск: npm run index:geo   (триггерит серверную переиндексацию и ждёт)');
  process.exit(1);
}

// Профиль коллекции (после блока выше — всегда обычный банк задач).
const P = { label: 'банк задач (tasks)', table: 'vec_tasks', meta: 'vec_meta',
  indexPath: '/index-vectors', prunePath: '/prune-vectors' };

// ── вывод ────────────────────────────────────────────────────────────────────
const log = (s = '') => process.stdout.write(s + '\n');
const same = (s) => process.stdout.write('\r' + s);
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
  --geometry     Индексировать ГЕОМЕТРИЧЕСКИЕ задачи (geometry_tasks →
                 vec_geometry) вместо обычного банка. Текст = тема + фасетные
                 теги + заголовок + условие; задачи «чертёж без текста»
                 пропускаются. То же — \`npm run index:geo\`. Дедуп не считается.
  --full         Пересчитать эмбеддинги ВСЕХ задач заново (медленно, ~20 мин).
                 Сочетается с --push и --geometry.
  --dedup        Дополнительно пересчитать кластеры дублей для вкладки
                 «Похожие (вектор)». Тяжело (~5-6 мин). То же — \`npm run dedup\`.
                 Только для обычного банка (с --geometry игнорируется).
  --help, -h     Показать эту справку.

Источники (можно переопределить переменными окружения):
  PocketBase : ${PB_URL}
  Ollama     : ${OLLAMA_URL}  (модель ${MODEL})
  VPS push   : ${PDF_URL}
  Токен      : ${INDEX_TOKEN ? 'найден' : 'НЕ найден (нужен для --push)'}
`);
}

// ── предполётные проверки: чтобы было понятно, ПОЧЕМУ не работает ─────────────
async function ping(url, opts = {}) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), ...opts });
    return res.ok;
  } catch { return false; }
}

async function preflight() {
  log('🔍 Проверяю окружение перед запуском...');

  if (!(await ping(`${OLLAMA_URL}/api/tags`))) {
    log(`   ❌ Ollama недоступна на ${OLLAMA_URL}`);
    log(`      Запусти Ollama (приложение или \`ollama serve\`) и проверь модель:`);
    log(`      ollama pull ${MODEL}`);
    return false;
  }
  log(`   ✓ Ollama отвечает (${OLLAMA_URL})`);

  if (!(await ping(`${PB_URL}/api/health`))) {
    log(`   ❌ PocketBase недоступен на ${PB_URL}`);
    log(`      Проверь интернет / VPN (Lemma на VPS).`);
    return false;
  }
  log(`   ✓ PocketBase отвечает (${PB_URL})`);

  if (PUSH && !INDEX_TOKEN) {
    log(`   ❌ Нет токена для отправки на VPS.`);
    log(`      Создай файл .index-token рядом со скриптом или задай INDEX_TOKEN=...`);
    return false;
  }
  if (PUSH) log(`   ✓ Токен для VPS найден`);
  return true;
}

// ── сеть: VPS ────────────────────────────────────────────────────────────────
async function pushVectors(rows) {
  const res = await fetch(`${PDF_URL}${P.indexPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(INDEX_TOKEN ? { 'X-Index-Token': INDEX_TOKEN } : {}) },
    body: JSON.stringify({ vectors: rows }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`index-vectors ${res.status}: ${await res.text()}`);
  return res.json();
}

async function pruneRemote(validIds) {
  const res = await fetch(`${PDF_URL}${P.prunePath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(INDEX_TOKEN ? { 'X-Index-Token': INDEX_TOKEN } : {}) },
    body: JSON.stringify({ valid_task_ids: validIds }),
    signal: AbortSignal.timeout(180000), // prune на VPS тяжёлый — даём 3 мин
  });
  if (!res.ok) throw new Error(`prune-vectors ${res.status}: ${await res.text()}`);
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

// ── дедуп-кластеризация на Mac (KNN внутри темы, union-find) ──────────────────
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

// ── эмбеддинги ───────────────────────────────────────────────────────────────
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
    if (!r.ok) throw new Error(`PocketBase ${r.status} на странице ${page}`);
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

// Геометрические задачи: банк МЦНМО + свои. Тянем фасетные теги и тему —
// они входят в текст эмбеддинга (buildGeoText).
async function* allGeometryTasks() {
  const perPage = 500;
  let page = 1, totalPages = 1;
  do {
    const url = `${PB_URL}/api/collections/geometry_tasks/records?perPage=${perPage}&page=${page}`
      + `&expand=topic,tags&fields=id,title,statement_md,answer,origin,topic,`
      + `expand.topic.title,expand.tags.name,expand.tags.kind`;
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`PocketBase ${r.status} на странице ${page} (geometry_tasks)`);
    const data = await r.json();
    totalPages = data.totalPages;
    for (const it of data.items) {
      const rawTags = it.expand?.tags;
      yield {
        id: it.id,
        statement_md: it.statement_md || '',
        title: it.title || '',
        topic_title: it.expand?.topic?.title || '',
        topic: it.topic || '',
        answer: it.answer || '',
        origin: it.origin === 'mccme' ? 'mccme' : 'manual',
        tags: (Array.isArray(rawTags) ? rawTags : rawTags ? [rawTags] : [])
          .map((t) => ({ kind: t.kind, name: t.name })),
      };
    }
    page++;
  } while (page <= totalPages);
}

function openVecDb() {
  fs.mkdirSync(path.dirname(VEC_DB), { recursive: true });
  const db = new Database(VEC_DB);
  sqliteVec.load(db);
  // distance_metric=cosine — порог дедупа калиброван по КОСИНУСУ (cos = 1 - distance).
  db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS ${P.table} USING vec0(task_id TEXT, embedding FLOAT[${DIM}] distance_metric=cosine);`);
  db.exec(`CREATE TABLE IF NOT EXISTS ${P.meta} (task_id TEXT PRIMARY KEY, model TEXT, dim INTEGER, text_hash TEXT, indexed_at TEXT);`);
  return db;
}

// ── главный сценарий ─────────────────────────────────────────────────────────
async function main() {
  if (HELP) { printHelp(); return; }

  hr();
  log('📊 Индексация векторного поиска Lemma');
  log(`   Коллекция: ${P.label}`);
  log(`   Режим: ${FULL ? 'ПОЛНЫЙ пересчёт всех задач' : 'инкремент (только новые/изменённые)'}` +
      `${PUSH ? ' · с отправкой на VPS' : ' · ТОЛЬКО локально (без VPS)'}` +
      `${FORCE_DEDUP && !GEO ? ' · + пересчёт дублей' : ''}`);
  hr();

  if (!(await preflight())) {
    log('\n⛔ Остановлено: окружение не готово (см. выше).');
    process.exitCode = 1;
    return;
  }

  if (FULL && fs.existsSync(VEC_DB)) {
    // Дропаем только таблицы ТЕКУЩЕГО профиля — vec.db общий на банк и геометрию,
    // удаление файла целиком снесло бы чужой индекс.
    const tmp = new Database(VEC_DB);
    sqliteVec.load(tmp);
    tmp.exec(`DROP TABLE IF EXISTS ${P.table}; DROP TABLE IF EXISTS ${P.meta};`);
    tmp.close();
    log(`\n--full: локальные ${P.table}/${P.meta} сброшены, считаю заново.`);
  }

  const db = openVecDb();
  const getMeta = db.prepare(`SELECT text_hash FROM ${P.meta} WHERE task_id = ?`);
  const delVec = db.prepare(`DELETE FROM ${P.table} WHERE task_id = ?`);
  const insVec = db.prepare(`INSERT INTO ${P.table}(task_id, embedding) VALUES (?, ?)`);
  const upMeta = db.prepare(`INSERT INTO ${P.meta}(task_id, model, dim, text_hash, indexed_at)
    VALUES (@task_id, @model, @dim, @text_hash, @indexed_at)
    ON CONFLICT(task_id) DO UPDATE SET model=@model, dim=@dim, text_hash=@text_hash, indexed_at=@indexed_at`);

  // Шаг 1 — выгрузка задач (потоково; считаем по ходу)
  log('\n[1/4] Загружаю задачи из PocketBase и сравниваю с локальным индексом...');
  let seen = 0, embedded = 0, skipped = 0, skippedShort = 0, failed = 0, pushed = 0, reconciled = 0;
  let pushBuf = [];
  const allIds = [];
  const taskMeta = new Map(); // id → {topic, answer} для дедупа
  const t0 = Date.now();

  let pushFailedBatches = 0;
  // Отправка пачки на VPS с ретраями. НЕ валит весь прогон при сбое:
  // вектора уже в локальной vec.db, повторный запуск дошлёт.
  const flushPush = async () => {
    if (!PUSH || pushBuf.length === 0) return;
    const batch = pushBuf;
    pushBuf = [];
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await pushVectors(batch);
        pushed += batch.length;
        return;
      } catch (e) {
        if (attempt < 3) { await new Promise((r) => setTimeout(r, 2000 * attempt)); continue; }
        pushFailedBatches++;
        log(`\n   ⚠ не удалось отправить пачку (${batch.length}) после 3 попыток: ${e.message}`);
      }
    }
  };

  log('\n[2/4] Считаю эмбеддинги через Ollama (модель ' + MODEL + ')...');
  for await (const task of (GEO ? allGeometryTasks() : allTasks())) {
    seen++;

    const text = GEO ? buildGeoText(task) : buildText(task);

    // Геометрия: задачи «чертёж без текста» (нет ни условия, ни тегов, ни
    // заголовка) дают мусорный вектор → не индексируем вовсе. Такие id не
    // попадают в allIds → прунинг уберёт их и с VPS, если были.
    if (GEO) {
      const signal = text.split('\n').filter((l) => !l.startsWith('Тема:')).join(' ').trim();
      if (signal.length < 30) { skippedShort++; continue; }
    }

    allIds.push(task.id);
    taskMeta.set(task.id, { topic: task.topic, answer: task.answer });

    const hash = textHash(text);
    if (!FULL) {
      const meta = getMeta.get(task.id);
      if (meta && meta.text_hash === hash) { skipped++; continue; }
    }

    let vec;
    try {
      vec = await embed(text);
    } catch (e) {
      failed++;
      log(`\n   ⚠ не удалось посчитать задачу ${task.id}: ${e.message}`);
      continue;
    }
    db.transaction(() => {
      delVec.run(task.id);
      insVec.run(task.id, Buffer.from(new Float32Array(vec).buffer));
      upMeta.run({ task_id: task.id, model: MODEL, dim: DIM, text_hash: hash, indexed_at: new Date().toISOString() });
    })();
    embedded++;

    if (PUSH) {
      pushBuf.push({ task_id: task.id, vec, text_hash: hash, model: MODEL });
      if (pushBuf.length >= PUSH_BATCH) await flushPush();
    }

    if (embedded % 10 === 0) {
      const elapsed = (Date.now() - t0) / 1000;
      const rate = elapsed > 0 ? embedded / elapsed : 0;
      same(`   просмотрено ${seen}, посчитано ${embedded}, пропущено ${skipped}  (${rate.toFixed(1)} зад/с)   `);
    }
  }
  await flushPush();
  log('');
  log(`   Просмотрено ${seen}, посчитано ${embedded}, пропущено без изменений ${skipped}`
    + `${skippedShort ? `, без текста (не индексируются) ${skippedShort}` : ''}`
    + `${failed ? `, с ошибками ${failed}` : ''}.`);

  // Прунинг локально — убрать вектора удалённых задач
  const validSet = new Set(allIds);
  const localOrphans = db.prepare(`SELECT task_id FROM ${P.table}`).all()
    .map((r) => r.task_id).filter((id) => !validSet.has(id));
  if (localOrphans.length) {
    const delMeta = db.prepare(`DELETE FROM ${P.meta} WHERE task_id = ?`);
    db.transaction(() => { for (const id of localOrphans) { delVec.run(id); delMeta.run(id); } })();
    log(`   Удалено из локальной базы (задачи удалены из Lemma): ${localOrphans.length}`);
  }

  // Шаг 3 — отправка на VPS
  if (PUSH) {
    log('\n[3/4] Синхронизирую с VPS...');
    log(`   Отправлено новых векторов: ${pushed}` + (pushFailedBatches ? `  (⚠ пачек не доставлено: ${pushFailedBatches} — дошлёт следующий запуск)` : ''));
    try {
      const pr = await pruneRemote(allIds);
      log(`   Прунинг на VPS: удалено ${pr.pruned}, осталось ${pr.total}`);

      // Самосверка: VPS вернул, каких локальных задач у него НЕТ. Такой дрейф
      // возникает, если когда-то пуш-пачка не доехала — инкремент сам бы эти
      // задачи пропустил по text_hash и больше никогда не дослал. Здесь чиним.
      const missing = pr.missing_on_vps || [];
      if (missing.length) {
        log(`   ⚠ На VPS не хватает ${missing.length} векторов (рассинхрон) — досылаю...`);
        const getRow = db.prepare(
          `SELECT v.embedding e, m.text_hash h, m.model mdl FROM ${P.table} v `
          + `LEFT JOIN ${P.meta} m ON m.task_id = v.task_id WHERE v.task_id = ?`);
        let batch = [];
        const flushReconcile = async () => {
          if (!batch.length) return;
          const b = batch; batch = [];
          await pushVectors(b); // в try: при сбое словим ниже, дошлёт следующий прогон
          reconciled += b.length;
        };
        for (const id of missing) {
          const row = getRow.get(id);
          if (!row || !row.e) continue; // нет локально — нечего слать (не падаем)
          const vec = Array.from(new Float32Array(row.e.buffer, row.e.byteOffset, row.e.byteLength / 4));
          batch.push({ task_id: id, vec, text_hash: row.h || '', model: row.mdl || MODEL });
          if (batch.length >= PUSH_BATCH) await flushReconcile();
        }
        await flushReconcile();
        log(`   ✓ Досверка: дослано ${reconciled} ранее потерянных векторов.`);
      }
    } catch (e) {
      // Прунинг/досверка некритичны: осиротевшие векторы безвредны (JOIN отсеет),
      // а недосланное доедет на следующем запуске (досверка повторится).
      log(`   ⚠ синхронизация с VPS прервана: ${e.message}`);
      log(`     (не страшно — повторный запуск долечит: лишнее уберётся, недостающее дошлётся)`);
    }
  } else {
    log('\n[3/4] Отправка на VPS пропущена (нет флага --push).');
    log('       Поиск на сайте читает данные с VPS — без --push изменения');
    log('       останутся только в локальной data/vec.db.');
  }

  // Шаг 4 — дедуп (только по флагу; для геометрии не считается)
  if (GEO && FORCE_DEDUP) {
    log('\n[4/4] Дедуп для геометрии не поддерживается (--dedup игнорируется).');
  } else if (PUSH && FORCE_DEDUP) {
    log('\n[4/4] Пересчитываю кластеры дублей (это долго, ~5-6 мин)...');
    try {
      const clusters = computeClusters(db, taskMeta);
      const rc = await uploadClusters(clusters);
      log(`   ✓ Дубли пересчитаны и залиты: ${rc.exact_dup} точных + ${rc.param_family} параметрических.`);
    } catch (e) {
      log(`   ⚠ пересчёт дублей не удался: ${e.message}`);
    }
  } else if (PUSH && !GEO) {
    log('\n[4/4] Дубли НЕ пересчитывались (для этого нужен флаг --dedup или `npm run dedup`).');
  }

  // Итог
  const total = db.prepare(`SELECT count(*) c FROM ${P.table}`).get().c;
  const sizeMb = (fs.statSync(VEC_DB).size / 1024 / 1024).toFixed(1);
  db.close();

  // Недоставленные пачки — НЕ рапортуем успех (иначе дрейф проходит незаметно).
  // Досверка следующего прогона их долечит, но человек должен увидеть проблему.
  const incomplete = pushFailedBatches > 0;

  hr();
  log(incomplete
    ? `⚠ Завершено за ${fmtSec(Date.now() - START)}, но НЕ всё доехало на VPS`
    : `✅ Готово за ${fmtSec(Date.now() - START)}`);
  log(`   Задач просмотрено: ${seen}  ·  посчитано сейчас: ${embedded}  ·  пропущено: ${skipped}`);
  if (PUSH) log(`   Отправлено на VPS: ${pushed} векторов` + (reconciled ? `  ·  досверкой долечено: ${reconciled}` : ''));
  log(`   Всего векторов в локальной vec.db: ${total}  (${sizeMb} MB)`);
  if (!PUSH && embedded > 0) {
    log('   ⚠ Чтобы изменения увидел сайт — запусти ещё раз с флагом --push.');
  }
  if (incomplete) {
    log(`   ⚠ Не доставлено пачек: ${pushFailedBatches}. Запусти ещё раз — досверка дошлёт недостающее.`);
    process.exitCode = 1;
  }
  hr();
}

main().catch((e) => {
  log(`\n❌ Ошибка: ${e.message}`);
  process.exit(1);
});
