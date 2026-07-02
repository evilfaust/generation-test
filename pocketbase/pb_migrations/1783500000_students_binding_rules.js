/// <reference path="../pb_data/types.d.ts" />
// Привязка учеников к учителю (v3.9.119, мультиучительство этап 4).
//
// Модель: ученик, созданный учителем вручную, сразу имеет owner; ученик из
// саморегистрации — «ничей» (owner = ""), виден всем учителям и «забирается»
// первым учителем, добавившим его в свою группу (claim в setStudentGroup).
//
// Правила (раньше listRule был ПУБЛИЧНЫМ — любой аноним мог выкачать ФИО):
// • list — только учителя: свои + ничьи (superadmin — все);
// • view — то же ИЛИ сам ученик (своя запись);
// • update — учитель editor+ в том же скоупе ИЛИ сам ученик;
// • create — открыт (саморегистрация из ученического приложения);
// • delete — закрыт (объединение аккаунтов только через merge-hook).
const T = '@request.auth.collectionName = "teachers"';
const OWN = '(owner = @request.auth.id || owner = "" || @request.auth.role = "superadmin")';

migrate((app) => {
  const col = app.findCollectionByNameOrId("students");
  col.listRule = `${T} && ${OWN}`;
  col.viewRule = `(${T} && ${OWN}) || id = @request.auth.id`;
  col.updateRule = `(${T} && @request.auth.role != "viewer" && ${OWN}) || id = @request.auth.id`;
  // createRule ("") и deleteRule (null) не трогаем.
  app.save(col);
  console.log('[migration] students: list/view/update скоупятся владельцем-учителем');
}, (app) => {
  // Снапшот прода от 02.07.2026
  const col = app.findCollectionByNameOrId("students");
  col.listRule = '';
  col.viewRule = 'id = @request.auth.id';
  col.updateRule = "@request.auth.id = '' || @request.auth.collectionName != 'students' || id = @request.auth.id";
  app.save(col);
});
