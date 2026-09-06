/// <reference path="../pb_data/types.d.ts" />

/**
 * POST /api/students/merge
 *
 * Объединяет два ученических аккаунта (ученик забыл пароль и завёл второй).
 * Body: {
 *   fromStudentId: string,     // аккаунт-донор (будет удалён)
 *   toStudentId:   string,     // аккаунт, который останется
 *   dryRun?: boolean,          // только посчитать, ничего не менять (превью для UI)
 *   keepCredentials?: boolean, // перенести логин+пароль донора на оставшийся аккаунт
 *   renameAttempts?: boolean   // переписать student_name в перенесённых попытках (по умолчанию true)
 * }
 *
 * Переносится ВСЁ, что ссылается на ученика, а не только попытки: иначе удаление
 * донора либо срывается (study_programs.student — required-связь, PocketBase
 * запрещает удаление такой записи), либо молча уносит с собой записи с
 * cascadeDelete (course_members, lesson_attendance).
 *
 * Всё выполняется в одной транзакции — до этого при ошибке удаления попытки
 * уже оказывались перенесены, и учитель получал полу-слитое состояние.
 *
 * ВАЖНО: обработчики хуков в PocketBase выполняются в изолированном контексте и
 * НЕ видят переменные внешней области файла — всё объявляется внутри функции.
 */
routerAdd("POST", "/api/students/merge", (c) => {
  // unique — второе поле составного уникального индекса вместе со student.
  // Если у целевого аккаунта такая запись уже есть, запись донора удаляется
  // (это дубль того же урока/курса), иначе перенос упал бы на индексе.
  const MERGE_RELATIONS = [
    { collection: "attempts",          field: "student", unique: null },
    { collection: "study_programs",    field: "student", unique: null },
    { collection: "course_members",    field: "student", unique: "course" },
    { collection: "lesson_attendance", field: "student", unique: "lesson" },
    { collection: "teacher_todos",     field: "student", unique: null },
  ];

  // Поля профиля, которые переезжают на целевой аккаунт, если у него пусто.
  // Новый (самостоятельно зарегистрированный) аккаунт почти всегда без группы,
  // класса и владельца — без этого ученик выпадает из журнала и аналитики.
  const PROFILE_FIELDS = ["name", "student_class", "teaching_group", "telegram_id", "owner"];

  const CRED_SUFFIX = "::merged";

  function countRelated(app, collection, field, studentId) {
    try {
      return app.findRecordsByFilter(collection, field + " = {:id}", "", 0, 0, { id: studentId }).length;
    } catch (err) {
      // Коллекции может не быть в старой копии БД — не повод валить merge.
      console.warn("[merge] count failed for " + collection + ": " + String(err));
      return 0;
    }
  }

  function logAudit(app, teacherId, teacherName, deletedId, summary) {
    try {
      const collection = app.findCollectionByNameOrId("audit_log");
      const record = new Record(collection);
      record.set("teacher_id", teacherId);
      record.set("teacher_name", teacherName);
      // action — select с фиксированным набором (create/update/delete):
      // слияние заканчивается удалением аккаунта-донора.
      record.set("action", "delete");
      record.set("collection_name", "students");
      record.set("record_id", deletedId);
      record.set("record_summary", summary.slice(0, 500));
      app.save(record);
    } catch (err) {
      console.warn("[merge] audit log failed: " + String(err));
    }
  }

  try {
    const info = c.requestInfo();
    const auth = info.auth;

    if (!auth) {
      return c.json(401, { error: "Требуется авторизация учителя" });
    }
    const authCollection = auth.collection().name;
    const isSuperuser = authCollection === "_superusers";
    if (!isSuperuser && authCollection !== "teachers") {
      return c.json(403, { error: "Объединять аккаунты может только учитель" });
    }
    const isSuperadmin = isSuperuser || auth.getString("role") === "superadmin";
    const teacherId = auth.id;
    const teacherName = isSuperuser ? "superuser" : (auth.getString("name") || auth.getString("username") || "?");

    const body = info.body || {};
    const fromStudentId = (body["fromStudentId"] || "").toString();
    const toStudentId = (body["toStudentId"] || "").toString();
    const dryRun = body["dryRun"] === true;
    const keepCredentials = body["keepCredentials"] === true;
    const renameAttempts = body["renameAttempts"] !== false;

    if (!fromStudentId || !toStudentId) {
      return c.json(400, { error: "fromStudentId и toStudentId обязательны" });
    }
    if (fromStudentId === toStudentId) {
      return c.json(400, { error: "Нельзя объединить аккаунт с самим собой" });
    }

    let fromStudent, toStudent;
    try {
      fromStudent = $app.findRecordById("students", fromStudentId);
      toStudent = $app.findRecordById("students", toStudentId);
    } catch (err) {
      return c.json(404, { error: "Аккаунт ученика не найден" });
    }

    // Учитель работает только со своими учениками (owner = "" — ещё не привязан).
    if (!isSuperadmin) {
      const owners = [fromStudent.getString("owner"), toStudent.getString("owner")];
      for (const owner of owners) {
        if (owner !== "" && owner !== teacherId) {
          return c.json(403, { error: "Один из аккаунтов принадлежит другому учителю" });
        }
      }
    }

    // ── Сводка: что именно переедет ─────────────────────────────────────────
    const counts = {};
    for (const rel of MERGE_RELATIONS) {
      counts[rel.collection] = countRelated($app, rel.collection, rel.field, fromStudentId);
    }

    const profilePlan = [];
    for (const field of PROFILE_FIELDS) {
      if (!toStudent.getString(field) && fromStudent.getString(field)) {
        profilePlan.push(field);
      }
    }

    const deletedUsername = fromStudent.getString("username");
    const targetUsername = toStudent.getString("username");

    if (dryRun) {
      return c.json(200, {
        ok: true,
        dryRun: true,
        counts: counts,
        profileFields: profilePlan,
        deletedUsername: deletedUsername,
        targetUsername: targetUsername,
        resultUsername: keepCredentials ? deletedUsername : targetUsername,
      });
    }

    const moved = {};
    const dropped = {};

    $app.runInTransaction((txApp) => {
      const toName = toStudent.getString("name");

      for (const rel of MERGE_RELATIONS) {
        moved[rel.collection] = 0;
        dropped[rel.collection] = 0;

        let records = [];
        try {
          records = txApp.findRecordsByFilter(rel.collection, rel.field + " = {:id}", "", 0, 0, { id: fromStudentId });
        } catch (err) {
          console.warn("[merge] skip " + rel.collection + ": " + String(err));
          continue;
        }

        for (const record of records) {
          if (rel.unique) {
            const clash = txApp.findRecordsByFilter(
              rel.collection,
              rel.field + " = {:to} && " + rel.unique + " = {:key}",
              "", 1, 0,
              { to: toStudentId, key: record.getString(rel.unique) }
            );
            if (clash.length > 0) {
              txApp.delete(record);
              dropped[rel.collection]++;
              continue;
            }
          }

          record.set(rel.field, toStudentId);
          if (rel.collection === "attempts" && renameAttempts && toName) {
            record.set("student_name", toName);
          }
          txApp.save(record);
          moved[rel.collection]++;
        }
      }

      if (profilePlan.length > 0) {
        for (const field of profilePlan) {
          toStudent.set(field, fromStudent.getString(field));
        }
        txApp.save(toStudent);
      }

      // Логин и хеш пароля донора переезжают на целевой аккаунт: ученик помнит
      // именно их. Прочитать хеш в JS нельзя (поле password скрыто), поэтому
      // переносим средствами SQL. Донор сначала освобождает свой username.
      if (keepCredentials) {
        txApp.db()
          .newQuery("UPDATE students SET username = username || {:suffix} WHERE id = {:from}")
          .bind({ suffix: CRED_SUFFIX, from: fromStudentId })
          .execute();

        txApp.db()
          .newQuery(
            "UPDATE students SET" +
            " username = (SELECT substr(username, 1, length(username) - {:cut}) FROM students WHERE id = {:from})," +
            " password = (SELECT password FROM students WHERE id = {:from})" +
            " WHERE id = {:to}"
          )
          .bind({ cut: CRED_SUFFIX.length, from: fromStudentId, to: toStudentId })
          .execute();
      }

      txApp.delete(fromStudent);
    });

    let movedTotal = 0;
    for (const key in moved) movedTotal += moved[key];

    logAudit(
      $app, teacherId, teacherName, fromStudentId,
      "merge students: @" + deletedUsername + " → @" + targetUsername +
      " (" + fromStudentId + " → " + toStudentId + "), перенесено записей: " + movedTotal +
      (keepCredentials ? ", логин/пароль перенесены" : "")
    );

    return c.json(200, {
      ok: true,
      moved: moved["attempts"],       // обратная совместимость со старым фронтом
      movedByCollection: moved,
      droppedByCollection: dropped,
      movedTotal: movedTotal,
      profileFields: profilePlan,
      credentialsMoved: keepCredentials,
      deletedUsername: deletedUsername,
      targetUsername: targetUsername,
      resultUsername: keepCredentials ? deletedUsername : targetUsername,
    });

  } catch (e) {
    return c.json(500, { error: String(e) });
  }
});
