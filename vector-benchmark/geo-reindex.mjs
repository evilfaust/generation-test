// ─────────────────────────────────────────────────────────────────────────────
//  Переиндексация ГЕОМЕТРИИ — триггер серверной job на VPS.
//
//  Эмбеддинги геометрии (vec_geometry) считает САМ VPS через Timeweb AI
//  Gateway (text-embedding-3-large @1024d) — Mac/Ollama не нужны. Этот скрипт
//  только дёргает POST /geo/reindex и показывает прогресс до завершения.
//
//  Запуск:
//    npm run index:geo          инкремент (только новые/изменённые задачи)
//    npm run index:geo:full     полный пересчёт (напр. после смены модели)
//
//  Токен — INDEX_TOKEN из env или файла .index-token (как у index.mjs).
// ─────────────────────────────────────────────────────────────────────────────
import { PDF_URL, INDEX_TOKEN } from './lib/config.mjs';

const FULL = process.argv.includes('--full');
const H = { 'Content-Type': 'application/json', ...(INDEX_TOKEN ? { 'X-Index-Token': INDEX_TOKEN } : {}) };
const log = (s = '') => process.stdout.write(s + '\n');

if (!INDEX_TOKEN) {
  log('❌ Нет токена: создай файл .index-token рядом со скриптом или задай INDEX_TOKEN=...');
  process.exit(1);
}

const start = await fetch(`${PDF_URL}/geo/reindex`, {
  method: 'POST', headers: H, body: JSON.stringify({ full: FULL }),
  signal: AbortSignal.timeout(15000),
});
if (!start.ok) {
  log(`❌ /geo/reindex ответил ${start.status}: ${(await start.text()).slice(0, 300)}`);
  process.exit(1);
}
const st = await start.json();
if (!st.started && st.reason !== 'already_running') {
  log(`❌ Не запустилось: ${st.reason}`);
  process.exit(1);
}
log(st.started
  ? `🚀 Серверная переиндексация геометрии запущена${FULL ? ' (ПОЛНЫЙ пересчёт)' : ' (инкремент)'}.`
  : '⏳ Переиндексация уже идёт — подключаюсь к прогрессу.');

for (;;) {
  await new Promise((r) => setTimeout(r, 5000));
  let s;
  try {
    const res = await fetch(`${PDF_URL}/geo/reindex/status`, { headers: H, signal: AbortSignal.timeout(15000) });
    if (!res.ok) { log(`⚠ status ${res.status}`); continue; }
    s = await res.json();
  } catch (e) { log(`⚠ ${e.message}`); continue; }

  process.stdout.write(`\r   [${s.phase}] посчитано ${s.done}/${s.total}, пропущено ${s.skipped}, без текста ${s.skipped_short}${s.failed ? `, ошибок ${s.failed}` : ''}   `);
  if (!s.running) {
    log('');
    if (s.phase === 'done') {
      log(`✅ Готово: ${s.done - (s.failed || 0)} посчитано · ${s.failed || 0} с ошибками · ${s.skipped} без изменений · ${s.skipped_short} без текста`);
      log(`   Прунинг: ${s.pruned} · всего векторов: ${s.total_vectors} · модель: ${s.model}`);
      if (s.failed) log('   ⚠ Ошибочные доедут следующим запуском (npm run index:geo).');
      process.exit(0);
    }
    log(`❌ Завершилось с ошибкой: ${s.error || s.phase}`);
    process.exit(1);
  }
}
