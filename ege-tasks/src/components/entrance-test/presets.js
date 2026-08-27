/**
 * Пресеты входных контрольных работ и палитры оформления печатного листа.
 *
 * Пресет задаёт «шапку» работы (заголовок, класс, время, инструкция) и
 * подсказку по структуре (тип экзамена + сколько заданий брать при
 * автозаполнении темами). Сами задачи подбираются блоками фильтров —
 * как в «Контрольных работах».
 */

/** Инструкция по умолчанию — подставляется в пресеты. */
const instr = (count, minutes, extra) =>
  `Работа состоит из ${count} заданий. На выполнение отводится ${minutes} минут. ` +
  `Ответы записывайте в отведённые поля рядом с заданием. ` +
  (extra ? extra + ' ' : '') +
  `Постарайтесь выполнить как можно больше заданий и набрать наибольшее количество баллов.`;

export const ENTRANCE_PRESETS = [
  {
    id: 'oge_9_10',
    label: '9 → 10 класс',
    hint: 'Повторение курса основной школы',
    examType: 'oge',
    tasksCount: 10,
    meta: {
      eyebrow: 'Входная контрольная работа',
      title: 'Математика',
      subtitle: 'Диагностика на входе в 10 класс',
      classLabel: '10 класс',
      duration: 45,
      instruction: instr(10, 45, 'Пользоваться калькулятором нельзя.'),
      notesTitle: 'Дополнительная информация',
      notes: '',
    },
  },
  {
    id: 'base_10_11',
    label: '10 → 11, база',
    hint: 'ЕГЭ базового уровня',
    examType: 'ege_base',
    tasksCount: 21,
    meta: {
      eyebrow: 'Входная контрольная работа',
      title: 'Математика · базовый уровень',
      subtitle: 'Диагностика на входе в 11 класс',
      classLabel: '11 класс',
      duration: 90,
      instruction: instr(21, 90, 'Все задания требуют краткого ответа. Разрешается пользоваться справочными материалами.'),
      notesTitle: 'Дополнительная информация',
      notes: '',
    },
  },
  {
    id: 'profile_10_11',
    label: '10 → 11, профиль',
    hint: 'ЕГЭ профильного уровня',
    examType: 'ege_profile',
    tasksCount: 12,
    meta: {
      eyebrow: 'Входная контрольная работа',
      title: 'Математика · профильный уровень',
      subtitle: 'Диагностика на входе в 11 класс',
      classLabel: '11 класс',
      duration: 120,
      instruction: instr(12, 120, 'Задания части 1 требуют краткого ответа, задания части 2 — полного обоснованного решения.'),
      notesTitle: 'Дополнительная информация',
      notes: '',
    },
  },
  {
    id: 'custom',
    label: 'Свой шаблон',
    hint: 'Пустая шапка — заполняется вручную',
    examType: null,
    tasksCount: 10,
    meta: {
      eyebrow: 'Входная контрольная работа',
      title: 'Математика',
      subtitle: '',
      classLabel: '',
      duration: 45,
      instruction: '',
      notesTitle: 'Дополнительная информация',
      notes: '',
    },
  },
];

export const DEFAULT_PRESET_ID = 'oge_9_10';

export const getPreset = (id) =>
  ENTRANCE_PRESETS.find(p => p.id === id) || ENTRANCE_PRESETS[0];

/** Высота зоны решения в режиме «рабочая тетрадь», мм. */
export const SOLUTION_SPACE_MM = {
  none: 0,
  s: 22,
  m: 38,
  l: 58,
  xl: 82,
};

export const SOLUTION_SPACE_OPTIONS = [
  { label: 'Нет',  value: 'none' },
  { label: 'S',    value: 's' },
  { label: 'M',    value: 'm' },
  { label: 'L',    value: 'l' },
  { label: 'XL',   value: 'xl' },
];

/** Фон зоны решения. */
export const SOLUTION_FILL_OPTIONS = [
  { label: 'Пусто',   value: 'blank' },
  { label: 'Линейка', value: 'lines' },
  { label: 'Клетка',  value: 'grid' },
];
