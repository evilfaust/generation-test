// Операции над снимком заданий листа (tasksData = Variant[][]).
//
// Правка листа — это правка снимка: задание уже сгенерировано, лежит в памяти
// (и в `generator_sheets`, если лист сохранён), и учитель меняет его руками,
// а не через настройки генератора. Все функции чистые и возвращают новый
// массив: генератор кладёт результат в setTasksData.
//
// Позиция задания одна на все варианты (см. utils/questionPlan): №5 везде
// одного типа. Поэтому удаление и добавление затрагивают все варианты сразу,
// а правка текста — одно задание одного варианта.

// Проверка формы: плоский снимок Variant[][] с заданиями-объектами
export function isFlatTasksData(tasksData) {
  return Array.isArray(tasksData)
    && tasksData.length > 0
    && Array.isArray(tasksData[0]);
}

export function taskCount(tasksData) {
  return isFlatTasksData(tasksData) ? tasksData[0].length : 0;
}

// Правка полей одного задания одного варианта («поправить опечатку в №5 В2»)
export function patchTask(tasksData, variantIdx, taskIdx, patch) {
  if (!isFlatTasksData(tasksData)) return tasksData;
  return tasksData.map((variant, vi) => (
    vi !== variantIdx
      ? variant
      : variant.map((task, ti) => (ti !== taskIdx ? task : { ...task, ...patch }))
  ));
}

// Замена задания целиком — перегенерация одной строки листа
export function replaceTask(tasksData, variantIdx, taskIdx, task) {
  if (!isFlatTasksData(tasksData) || !task) return tasksData;
  return tasksData.map((variant, vi) => (
    vi !== variantIdx
      ? variant
      : variant.map((old, ti) => (ti !== taskIdx ? old : task))
  ));
}

// Удаление позиции из всех вариантов. Лист остаётся согласованным: на месте
// №5 во всех вариантах стояло задание одного типа, значит и уходит оно везде.
export function removeTaskEverywhere(tasksData, taskIdx) {
  if (!isFlatTasksData(tasksData)) return tasksData;
  if (taskIdx < 0 || taskIdx >= tasksData[0].length) return tasksData;
  return tasksData.map(variant => variant.filter((_, ti) => ti !== taskIdx));
}

// Своё задание, вписанное руками: одно и то же во всех вариантах — учитель
// добавляет его как «общий вопрос», а не как параллель.
export function appendTaskEverywhere(tasksData, task) {
  if (!isFlatTasksData(tasksData) || !task) return tasksData;
  return tasksData.map(variant => [...variant, { ...task }]);
}

// Все задания одной позиции — по варианту на строку (для модалки правки)
export function tasksAtPosition(tasksData, taskIdx) {
  if (!isFlatTasksData(tasksData)) return [];
  return tasksData.map((variant, vi) => ({
    variantIndex: vi,
    task: variant[taskIdx] || null,
  })).filter(row => row.task);
}

// Порядок заданий после удаления позиции: сама позиция уходит, номера следующих
// съезжают на единицу. Иначе порядок ссылался бы на чужие задания.
export function layoutWithoutTask(layout, taskIdx) {
  return (Array.isArray(layout) ? layout : [])
    .filter(item => !(item.kind === 'task' && item.idx === taskIdx))
    .map(item => (item.kind === 'task' && item.idx > taskIdx
      ? { ...item, idx: item.idx - 1 }
      : item));
}
