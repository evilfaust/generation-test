/// <reference path="../pb_data/types.d.ts" />

// Объединяет trig_mc_tests → mc_tests.
// Добавляет поля source_type / generator_type / generator_settings в mc_tests.
// Обновляет work_sessions: mc_test = trig_mc_test где нужно.
// Удаляет поле trig_mc_test из work_sessions и всю коллекцию trig_mc_tests.

migrate((app) => {

  // ── Шаг 1: добавить поля в mc_tests ──────────────────────────────────────
  const mcTests = app.findCollectionByNameOrId('mc_tests');

  mcTests.fields.add(new Field({
    type: 'text',
    id:   'text_mct_source_type',
    name: 'source_type',
    required: false,
    max: 20,
  }));
  mcTests.fields.add(new Field({
    type: 'text',
    id:   'text_mct_generator_type',
    name: 'generator_type',
    required: false,
    max: 60,
  }));
  mcTests.fields.add(new Field({
    type: 'json',
    id:   'json_mct_generator_settings',
    name: 'generator_settings',
    required: false,
  }));

  app.save(mcTests);
  console.log('[1772000036] Added source_type / generator_type / generator_settings to mc_tests');

  // ── Шаг 2: пометить существующие mc_tests как source_type = 'catalog' ────
  app.db().newQuery(`UPDATE mc_tests SET source_type = 'catalog'`).execute();
  console.log('[1772000036] Set source_type=catalog on existing mc_tests records');

  // ── Шаг 3: скопировать trig_mc_tests → mc_tests (те же ID) ───────────────
  // Задачи у тригонометрических тестов уже хранятся в коллекции tasks
  // (source='trig_generator'), поэтому формат variants совместим.
  app.db().newQuery(`
    INSERT OR IGNORE INTO mc_tests
      (id, title, description, class_number,
       source_type, generator_type, generator_settings,
       options_count, shuffle_mode, variants,
       created, updated)
    SELECT
      id, title, '', class_number,
      'generator', generator_type, settings,
      options_count, shuffle_mode, variants,
      created, updated
    FROM trig_mc_tests
  `).execute();
  console.log('[1772000036] Copied trig_mc_tests → mc_tests');

  // ── Шаг 4: перенести ссылки в work_sessions ──────────────────────────────
  app.db().newQuery(`
    UPDATE work_sessions
    SET mc_test = trig_mc_test
    WHERE trig_mc_test IS NOT NULL AND trig_mc_test != ''
  `).execute();
  console.log('[1772000036] Updated work_sessions.mc_test from trig_mc_test');

  // ── Шаг 5: убрать поле trig_mc_test из work_sessions ────────────────────
  const workSessions = app.findCollectionByNameOrId('work_sessions');
  workSessions.fields.removeById('rel_ws_trig_mc_test');
  app.save(workSessions);
  console.log('[1772000036] Removed trig_mc_test field from work_sessions');

  // ── Шаг 6: удалить коллекцию trig_mc_tests ──────────────────────────────
  try {
    const trigCollection = app.findCollectionByNameOrId('trig_mc_tests');
    app.delete(trigCollection);
    console.log('[1772000036] Deleted trig_mc_tests collection');
  } catch (e) {
    console.log('[1772000036] trig_mc_tests already gone:', e.message);
  }

}, (app) => {
  // Роллбэк: частичный — только удаляем добавленные поля из mc_tests.
  // Восстановить trig_mc_tests и work_sessions.trig_mc_test можно только из бэкапа.
  console.log('[rollback 1772000036] Removing added fields from mc_tests (manual restore needed for trig_mc_tests)');
  try {
    const mcTests = app.findCollectionByNameOrId('mc_tests');
    for (const name of ['source_type', 'generator_type', 'generator_settings']) {
      const f = mcTests.fields.getByName(name);
      if (f) mcTests.fields.remove(f.id);
    }
    app.save(mcTests);
  } catch (e) {
    console.log('[rollback 1772000036]', e.message);
  }
});
