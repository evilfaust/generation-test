import { describe, it, expect } from 'vitest';
import { parseWorkMarkdown } from '../utils/workImportFormat';
import {
  buildImportRows,
  findDuplicate,
  applyDuplicates,
  findInternalDuplicates,
  summarizeRows,
  blockingIssues,
  rowKey,
} from '../utils/workImportPlan';
import { matchTopicByName, matchSubtopicByName } from '../utils/topicMatch';

const topics = [
  { id: 't-prof', title: 'Производная и первообразная', exam_type: 'ege_profile', ege_number: 7 },
  { id: 't-base', title: 'Производная и первообразная', exam_type: 'ege_base', ege_number: 14 },
  { id: 't-geom', title: 'Геометрический смысл производной', exam_type: 'ege_profile', ege_number: 8 },
  { id: 't-short', title: 'Дроби', exam_type: 'oge', ege_number: 6 },
];

const subtopics = [
  { id: 's1', name: 'Правила дифференцирования', topic: 't-prof' },
  { id: 's2', name: 'Таблица производных', topic: 't-prof' },
];

describe('matchTopicByName', () => {
  it('точное совпадение без учёта регистра, «ё» и пунктуации', () => {
    expect(matchTopicByName('производная и первообразная', topics, { examType: 'ege_profile' })).toBe('t-prof');
    expect(matchTopicByName('Производная и Первообразная.', topics, { examType: 'ege_base' })).toBe('t-base');
  });

  it('частичное совпадение — только если кандидат один', () => {
    expect(matchTopicByName('Геометрический смысл', topics)).toBe('t-geom');
    expect(matchTopicByName('Производная и первообразная', topics)).toBe('t-prof'); // два контекста → первый
  });

  it('короткие названия не матчатся частично', () => {
    expect(matchTopicByName('Обыкновенные дроби и проценты', topics)).toBe(null);
  });

  it('пустой ввод и пустой список', () => {
    expect(matchTopicByName('', topics)).toBe(null);
    expect(matchTopicByName('Дроби', [])).toBe(null);
  });
});

describe('matchSubtopicByName', () => {
  it('ищет подтему внутри темы', () => {
    expect(matchSubtopicByName('правила дифференцирования', subtopics, 't-prof')).toBe('s1');
    expect(matchSubtopicByName('Правила дифференцирования', subtopics, 't-geom')).toBe(null);
    expect(matchSubtopicByName('Таблица', subtopics, 't-prof')).toBe('s2');
  });
});

describe('buildImportRows', () => {
  const parsed = parseWorkMarkdown(`---
работа: КР
контекст: ege_profile
тема: Производная и первообразная
---

## Вариант 1

### 1
подтема: Правила дифференцирования
ответ: 2x

Найдите производную $x^2$.

### 2
тема: Геометрический смысл производной

График.

### 3
тема: Совершенно новая тема

Что-то новое.

## Вариант 2

### 1
ответ: 3x^2

Найдите производную $x^3$.`);

  const rows = buildImportRows(parsed, { topics, subtopics });

  it('раскладывает все задачи всех вариантов', () => {
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.key)).toEqual([rowKey(1, 0), rowKey(1, 1), rowKey(1, 2), rowKey(2, 0)]);
    expect(rows.map((r) => r.variantNumber)).toEqual([1, 1, 1, 2]);
  });

  it('подбирает тему с учётом контекста работы', () => {
    expect(rows[0].topicId).toBe('t-prof'); // ege_profile, не ege_base
    expect(rows[1].topicId).toBe('t-geom');
    expect(rows[3].topicId).toBe('t-prof'); // унаследована из шапки
  });

  it('неизвестная тема остаётся пустой — выбор за учителем', () => {
    expect(rows[2].topicId).toBe(null);
  });

  it('подтема сопоставляется, новая запоминается для создания', () => {
    expect(rows[0].subtopicId).toBe('s1');
    expect(rows[0].newSubtopicName).toBe('');
    expect(rows[1].subtopicId).toBe(null);
  });

  it('по умолчанию все задачи создаются', () => {
    expect(rows.every((r) => r.mode === 'create')).toBe(true);
  });
});

describe('findDuplicate', () => {
  const candidates = [
    { id: 'x1', code: '7-001', statement_md: 'Найдите производную функции $f(x)=x^2$.', answer: '2x' },
    { id: 'x2', code: '7-002', statement_md: 'Решите уравнение $x+1=0$.', answer: '-1' },
  ];

  it('точное совпадение текста', () => {
    const hit = findDuplicate({ statement_md: '  Найдите производную функции $f(x)=x^2$.  ' }, candidates);
    expect(hit).toMatchObject({ id: 'x1', kind: 'strict' });
  });

  it('мягкое совпадение: другая пунктуация и пробелы', () => {
    const hit = findDuplicate({ statement_md: 'Найдите производную функции $f(x) = x^2$' }, candidates);
    expect(hit).toMatchObject({ id: 'x1', kind: 'loose' });
  });

  it('разные задачи не совпадают', () => {
    expect(findDuplicate({ statement_md: 'Найдите производную функции $f(x)=x^3$.' }, candidates)).toBe(null);
  });

  it('пустые входные данные', () => {
    expect(findDuplicate({ statement_md: '' }, candidates)).toBe(null);
    expect(findDuplicate({ statement_md: 'Что-то' }, [])).toBe(null);
  });
});

describe('applyDuplicates', () => {
  const rows = [
    { key: 'v1-0', mode: 'create', topicId: 't-prof', task: { statement_md: 'Найдите производную $x^2$.' } },
    { key: 'v1-1', mode: 'create', topicId: 't-prof', task: { statement_md: 'Совсем другая задача.' } },
    { key: 'v1-2', mode: 'skip', topicId: 't-prof', task: { statement_md: 'Найдите производную $x^2$.' } },
  ];
  const byTopic = new Map([['t-prof', [{ id: 'x1', code: '7-001', statement_md: 'Найдите производную $x^2$.' }]]]);

  const result = applyDuplicates(rows, byTopic);

  it('найденный дубль переключает строку на переиспользование', () => {
    expect(result[0].mode).toBe('reuse');
    expect(result[0].reuseTaskId).toBe('x1');
    expect(result[0].duplicate).toMatchObject({ code: '7-001', kind: 'strict' });
  });

  it('без дубля строка остаётся на создании', () => {
    expect(result[1].mode).toBe('create');
    expect(result[1].duplicate).toBe(null);
  });

  it('исключённые строки не трогаются', () => {
    expect(result[2].mode).toBe('skip');
  });

  it('принимает обычный объект вместо Map', () => {
    const r = applyDuplicates([rows[0]], { 't-prof': [{ id: 'x9', code: '7-009', statement_md: 'Найдите производную $x^2$.' }] });
    expect(r[0].reuseTaskId).toBe('x9');
  });
});

describe('findInternalDuplicates', () => {
  it('ловит повтор задачи внутри файла', () => {
    const rows = [
      { key: 'v1-0', task: { statement_md: 'Вычислите $2+2$.' } },
      { key: 'v2-0', task: { statement_md: 'Вычислите: $2 + 2$' } },
      { key: 'v2-1', task: { statement_md: 'Другая.' } },
    ];
    expect(findInternalDuplicates(rows)).toEqual([{ key: 'v2-0', sameAs: 'v1-0' }]);
  });
});

describe('summarizeRows и blockingIssues', () => {
  const rows = [
    { key: 'v1-0', mode: 'create', topicId: 't1', variantNumber: 1, task: { answer: '5' } },
    { key: 'v1-1', mode: 'reuse', topicId: 't1', variantNumber: 1, task: { answer: '' } },
    { key: 'v2-0', mode: 'skip', topicId: null, variantNumber: 2, task: { answer: '' } },
  ];

  it('считает сводку', () => {
    expect(summarizeRows(rows)).toMatchObject({ total: 3, create: 1, reuse: 1, skip: 1, variants: 2, withoutAnswer: 2 });
  });

  it('задача без темы блокирует импорт, если её создают', () => {
    const issues = blockingIssues([{ key: 'a', mode: 'create', topicId: null, task: { statement_md: 'A' } }]);
    expect(issues.some((i) => i.includes('Не выбрана тема'))).toBe(true);
  });

  it('переиспользуемой задаче тема не нужна', () => {
    expect(blockingIssues([{ key: 'a', mode: 'reuse', topicId: null, reuseTaskId: 'x', task: { statement_md: 'A' } }])).toEqual([]);
  });

  it('все задачи исключены — импорт нечем запускать', () => {
    expect(blockingIssues([{ key: 'a', mode: 'skip', task: { statement_md: 'A' } }])).toContain('Все задачи исключены из импорта.');
  });
});
