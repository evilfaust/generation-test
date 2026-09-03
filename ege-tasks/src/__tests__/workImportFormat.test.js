import { describe, it, expect } from 'vitest';
import {
  parseWorkMarkdown,
  buildWorkMarkdown,
  buildAiPrompt,
  resolveExamType,
  parseSectionHeading,
  extractImagePlaceholders,
  removeImagePlaceholder,
} from '../utils/workImportFormat';

const FULL = `---
работа: Контрольная работа «Производная»
класс: 11
контекст: ege_profile
тема: Производная
время: 45
источник: Иванова Н.П., 2026
теги: [производная]
---

## Вариант 1

### 1
подтема: Правила дифференцирования
ответ: 3x^2-2

Найдите производную функции $f(x)=x^3-2x$.

а) в точке $x_0=1$
б) в точке $x_0=-1$

### 2
тема: Геометрический смысл производной
сложность: 2

На рисунке изображён график функции $y=f(x)$.

![](рис1)

Найдите значение производной в точке $x_0=3$.

## Ответы

1) 3x^2-2
2) -0,5

## Вариант 2

### 1
ответ: 5x^4+1

Найдите производную функции $f(x)=x^5+x$.

### 2
тема: Геометрический смысл производной

Найдите значение производной в точке $x_0=2$.
`;

describe('parseWorkMarkdown — общий разбор', () => {
  const result = parseWorkMarkdown(FULL);

  it('читает шапку работы', () => {
    expect(result.work.title).toBe('Контрольная работа «Производная»');
    expect(result.work.classNumber).toBe(11);
    expect(result.work.examType).toBe('ege_profile');
    expect(result.work.timeLimit).toBe(45);
    expect(result.work.source).toBe('Иванова Н.П., 2026');
    expect(result.work.tags).toEqual(['производная']);
  });

  it('разбивает на варианты и задачи', () => {
    expect(result.variants).toHaveLength(2);
    expect(result.variants.map((v) => v.number)).toEqual([1, 2]);
    expect(result.variants[0].tasks).toHaveLength(2);
    expect(result.variants[1].tasks).toHaveLength(2);
  });

  it('условие сохраняет абзацы и пустые строки', () => {
    expect(result.variants[0].tasks[0].statement_md).toBe(
      'Найдите производную функции $f(x)=x^3-2x$.\n\nа) в точке $x_0=1$\nб) в точке $x_0=-1$'
    );
  });

  it('тема задачи перекрывает тему работы, иначе наследуется', () => {
    expect(result.variants[0].tasks[0].topicName).toBe('Производная');
    expect(result.variants[0].tasks[1].topicName).toBe('Геометрический смысл производной');
  });

  it('подтема, сложность и теги разбираются', () => {
    expect(result.variants[0].tasks[0].subtopicName).toBe('Правила дифференцирования');
    expect(result.variants[0].tasks[1].difficulty).toBe('2');
    expect(result.variants[0].tasks[0].difficulty).toBe('1'); // по умолчанию
    expect(result.variants[0].tasks[0].tags).toEqual(['производная']); // из шапки
  });

  it('ответ из метастроки и из блока «## Ответы»', () => {
    expect(result.variants[0].tasks[0].answer).toBe('3x^2-2');
    expect(result.variants[0].tasks[1].answer).toBe('-0,5'); // подставлен из блока
    expect(result.variants[1].tasks[0].answer).toBe('5x^4+1');
  });

  it('плейсхолдеры чертежей собираются по всей работе', () => {
    expect(result.imagePlaceholders).toEqual(['рис1']);
    expect(result.variants[0].tasks[1].images).toEqual([{ key: 'рис1', role: 'condition' }]);
  });

  it('позиции задач проставлены', () => {
    expect(result.variants[0].tasks.map((t) => t.position)).toEqual([0, 1]);
  });

  it('ошибок нет', () => {
    expect(result.errors).toEqual([]);
  });
});

describe('parseWorkMarkdown — минимальный файл', () => {
  it('работает без шапки и без секций вариантов', () => {
    const { work, variants, errors } = parseWorkMarkdown(`### 1

Решите уравнение $x^2=4$.

### 2

Решите неравенство $x>1$.`);
    expect(errors).toEqual([]);
    expect(work.title).toBe('Импортированная работа');
    expect(variants).toHaveLength(1);
    expect(variants[0].number).toBe(1);
    expect(variants[0].tasks).toHaveLength(2);
  });

  it('заголовок первого уровня становится названием работы', () => {
    const { work } = parseWorkMarkdown(`# Самостоятельная работа №3

### 1

Вычислите $2+2$.`);
    expect(work.title).toBe('Самостоятельная работа №3');
  });
});

describe('parseWorkMarkdown — устойчивость условия', () => {
  it('строка «Ответ:» внутри условия не обрывает его и не становится ответом', () => {
    const { variants } = parseWorkMarkdown(`### 1
ответ: нет

Петя записал ответ: 5.

Прав ли он?`);
    const task = variants[0].tasks[0];
    expect(task.answer).toBe('нет');
    expect(task.statement_md).toBe('Петя записал ответ: 5.\n\nПрав ли он?');
  });

  it('метастрока после условия: значение не подхватывается, текст цел, есть предупреждение', () => {
    const { variants, warnings } = parseWorkMarkdown(`### 1

Вычислите $2+2$.

ответ: 4`);
    const task = variants[0].tasks[0];
    expect(task.answer).toBe('');
    expect(task.statement_md).toBe('Вычислите $2+2$.\n\nответ: 4');
    expect(warnings.some((w) => w.includes('после условия'))).toBe(true);
  });

  it('таблица в условии сохраняется целиком', () => {
    const { variants } = parseWorkMarkdown(`### 1

| x | y |
|---|---|
| 1 | 2 |

Найдите закономерность.`);
    expect(variants[0].tasks[0].statement_md).toContain('| 1 | 2 |');
  });

  it('заголовки внутри fenced-блока не считаются разделителями', () => {
    const { variants } = parseWorkMarkdown(`### 1

Постройте:

\`\`\`plot
### не заголовок
f(x)=x^2
\`\`\`

Готово.`);
    expect(variants[0].tasks).toHaveLength(1);
    expect(variants[0].tasks[0].statement_md).toContain('### не заголовок');
    expect(variants[0].tasks[0].statement_md).toContain('Готово.');
  });

  it('пустые строки между метастроками допустимы', () => {
    const { variants } = parseWorkMarkdown(`### 1
тема: Дроби

ответ: 5

Вычислите.`);
    expect(variants[0].tasks[0].topicName).toBe('Дроби');
    expect(variants[0].tasks[0].answer).toBe('5');
    expect(variants[0].tasks[0].statement_md).toBe('Вычислите.');
  });
});

describe('parseWorkMarkdown — метастроки', () => {
  it('английские алиасы ключей', () => {
    const { variants } = parseWorkMarkdown(`### 1
topic: Логарифмы
answer: 3
difficulty: 4
tags: [егэ, логарифм]
score: 2
part: 2
sdamgia: 512345
year: 2025

Вычислите $\\log_2 8$.`);
    const t = variants[0].tasks[0];
    expect(t.topicName).toBe('Логарифмы');
    expect(t.answer).toBe('3');
    expect(t.difficulty).toBe('4');
    expect(t.tags).toEqual(['егэ', 'логарифм']);
    expect(t.maxScore).toBe(2);
    expect(t.examPart).toBe(2);
    expect(t.sdamgiaId).toBe('512345');
    expect(t.year).toBe(2025);
  });

  it('сложность вне 1–5 отбрасывается с предупреждением', () => {
    const { variants, warnings } = parseWorkMarkdown(`### 1
сложность: 9

Вычислите.`);
    expect(variants[0].tasks[0].difficulty).toBe('1');
    expect(warnings.some((w) => w.includes('сложность'))).toBe(true);
  });

  it('подсекции «Решение» и «Критерии»', () => {
    const { variants } = parseWorkMarkdown(`### 1
часть: 2

Решите уравнение.

#### Решение
Первый шаг.

Второй шаг.

#### Критерии
| Баллы | За что |
|---|---|
| 2 | Верно |`);
    const t = variants[0].tasks[0];
    expect(t.statement_md).toBe('Решите уравнение.');
    expect(t.solution_md).toBe('Первый шаг.\n\nВторой шаг.');
    expect(t.criteria_md).toContain('| 2 | Верно |');
  });
});

describe('parseSectionHeading', () => {
  it('распознаёт варианты в разных написаниях', () => {
    expect(parseSectionHeading('Вариант 1')).toMatchObject({ type: 'variant', number: 1 });
    expect(parseSectionHeading('Вариант I')).toMatchObject({ type: 'variant', number: 1 });
    expect(parseSectionHeading('II вариант')).toMatchObject({ type: 'variant', number: 2 });
    expect(parseSectionHeading('Вариант №2')).toMatchObject({ type: 'variant', number: 2 });
    expect(parseSectionHeading('Вариант Б')).toMatchObject({ type: 'variant', number: 2 });
    expect(parseSectionHeading('Вариант 3 (повышенный)')).toMatchObject({ type: 'variant', number: 3 });
  });

  it('«Ответы к варианту 2» — это блок ответов, а не вариант', () => {
    expect(parseSectionHeading('Ответы к варианту 2')).toMatchObject({ type: 'answers', variantNumber: 2 });
    expect(parseSectionHeading('Ответы')).toMatchObject({ type: 'answers', variantNumber: null });
  });

  it('прочие заголовки', () => {
    expect(parseSectionHeading('Инструкция')).toMatchObject({ type: 'other' });
  });
});

describe('parseWorkMarkdown — блок ответов', () => {
  it('понимает разные разделители', () => {
    const { variants, warnings } = parseWorkMarkdown(`### 1

A

### 2

B

### 3

C

### 4

D

## Ответы

1) 5
2. -3
3 — 12
4 - x=2`);
    expect(variants[0].tasks.map((t) => t.answer)).toEqual(['5', '-3', '12', 'x=2']);
    expect(warnings.filter((w) => w.includes('не разобрана'))).toEqual([]);
  });

  it('ответ задачи побеждает блок, расхождение попадает в предупреждения', () => {
    const { variants, warnings } = parseWorkMarkdown(`### 1
ответ: 5

Вычислите.

## Ответы

1) 7`);
    expect(variants[0].tasks[0].answer).toBe('5');
    expect(warnings.some((w) => w.includes('не совпал'))).toBe(true);
  });

  it('ответы адресуются нужному варианту', () => {
    const { variants } = parseWorkMarkdown(`## Вариант 1

### 1

A

## Вариант 2

### 1

B

## Ответы к варианту 2

1) 42`);
    expect(variants[0].tasks[0].answer).toBe('');
    expect(variants[1].tasks[0].answer).toBe('42');
  });

  it('ответ на несуществующий номер даёт предупреждение', () => {
    const { warnings } = parseWorkMarkdown(`### 1

A

## Ответы

7) 42`);
    expect(warnings.some((w) => w.includes('не нашёл задачу'))).toBe(true);
  });
});

describe('extractImagePlaceholders', () => {
  it('берёт локальные ключи и пропускает внешние ссылки', () => {
    const md = '![](рис1) ![подпись](схема-2) ![](https://x.ru/a.png) ![](data:image/png;base64,AAA) ![](/files/a.png)';
    expect(extractImagePlaceholders(md)).toEqual(['рис1', 'схема-2']);
  });

  it('дубли не повторяются', () => {
    expect(extractImagePlaceholders('![](рис1)\n![](рис1)')).toEqual(['рис1']);
  });
});

describe('removeImagePlaceholder', () => {
  it('вырезает ссылку и лишние пустые строки', () => {
    expect(removeImagePlaceholder('График.\n\n![](рис1)\n\nНайдите.', 'рис1')).toBe('График.\n\nНайдите.');
  });

  it('вырезает только нужный ключ', () => {
    expect(removeImagePlaceholder('![](рис1) ![](рис2)', 'рис1').trim()).toBe('![](рис2)');
  });

  it('спецсимволы в ключе не ломают регулярку', () => {
    expect(removeImagePlaceholder('![](рис.1+a)', 'рис.1+a')).toBe('');
  });

  it('пустые входные данные', () => {
    expect(removeImagePlaceholder('', 'рис1')).toBe('');
    expect(removeImagePlaceholder('текст', '')).toBe('текст');
  });
});

describe('resolveExamType', () => {
  it('принимает коды и человеческие написания', () => {
    expect(resolveExamType('ege_profile')).toBe('ege_profile');
    expect(resolveExamType('ЕГЭ профильный')).toBe('ege_profile');
    expect(resolveExamType('профиль')).toBe('ege_profile');
    expect(resolveExamType('ОГЭ')).toBe('oge');
    expect(resolveExamType('ЕГЭ, базовый')).toBe('ege_base');
    expect(resolveExamType('марсианский')).toBe(null);
  });
});

describe('parseWorkMarkdown — ошибки и предупреждения', () => {
  it('пустое условие — ошибка', () => {
    const { errors } = parseWorkMarkdown(`### 1
ответ: 5
`);
    expect(errors.some((e) => e.includes('Пустое условие'))).toBe(true);
  });

  it('нет задач — ошибка', () => {
    const { errors } = parseWorkMarkdown(`---
работа: Пустая
---

Просто текст без задач.`);
    expect(errors.some((e) => e.includes('Задачи не найдены'))).toBe(true);
  });

  it('битый YAML — ошибка без падения', () => {
    const { errors } = parseWorkMarkdown(`---
работа: [не закрыт
---

### 1

A`);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('разное число задач в вариантах и дубли номеров', () => {
    const { warnings } = parseWorkMarkdown(`## Вариант 1

### 1

A

### 1

B

## Вариант 2

### 1

C`);
    expect(warnings.some((w) => w.includes('повторяется'))).toBe(true);
    expect(warnings.some((w) => w.includes('задач'))).toBe(true);
  });

  it('нет ответа и нет темы — предупреждения, но не ошибки', () => {
    const { errors, warnings } = parseWorkMarkdown(`### 1

Вычислите.`);
    expect(errors).toEqual([]);
    expect(warnings.some((w) => w.includes('Нет ответа'))).toBe(true);
    expect(warnings.some((w) => w.includes('Не указана тема'))).toBe(true);
  });

  it('неизвестный контекст — предупреждение', () => {
    const { work, warnings } = parseWorkMarkdown(`---
контекст: марсианский экзамен
---

### 1

A`);
    expect(work.examType).toBe(null);
    expect(warnings.some((w) => w.includes('Неизвестный контекст'))).toBe(true);
  });
});

describe('buildWorkMarkdown', () => {
  const topics = [{ id: 't1', title: 'Производная', exam_type: 'ege_profile' }];
  const subtopics = [{ id: 's1', name: 'Правила дифференцирования', topic: 't1' }];
  const tags = [{ id: 'g1', title: 'производная' }];

  const work = { id: 'w1', title: 'Контрольная', class: 11, topic: 't1', time_limit: 45, source: 'Иванова Н.П.' };
  const variants = [
    {
      number: 1,
      tasks: [
        { id: 'a', statement_md: 'Найдите производную $f(x)=x^2$.', answer: '2x', topic: 't1', subtopic: ['s1'], tags: ['g1'], difficulty: '2' },
        { id: 'b', statement_md: 'Решите уравнение.', answer: '', topic: 't1', exam_part: 2, max_score: 2, solution_md: 'Шаг 1.' },
      ],
    },
    {
      number: 2,
      tasks: [{ id: 'c', statement_md: 'Найдите производную $f(x)=x^3$.', answer: '3x^2', topic: 't1' }],
    },
  ];

  it('собирает файл с шапкой и вариантами', () => {
    const md = buildWorkMarkdown({ work, variants, topics, subtopics, tags });
    expect(md).toContain('работа: Контрольная');
    expect(md).toContain('класс: 11');
    expect(md).toContain('контекст: ege_profile');
    expect(md).toContain('## Вариант 1');
    expect(md).toContain('## Вариант 2');
    expect(md).toContain('подтема: Правила дифференцирования');
    expect(md).toContain('теги: [производная]');
    expect(md).toContain('#### Решение');
  });

  it('round-trip: разбор собранного файла даёт исходные данные', () => {
    const md = buildWorkMarkdown({ work, variants, topics, subtopics, tags });
    const parsed = parseWorkMarkdown(md);

    expect(parsed.errors).toEqual([]);
    expect(parsed.work.title).toBe('Контрольная');
    expect(parsed.work.classNumber).toBe(11);
    expect(parsed.work.examType).toBe('ege_profile');
    expect(parsed.work.timeLimit).toBe(45);
    expect(parsed.variants).toHaveLength(2);

    const first = parsed.variants[0].tasks[0];
    expect(first.statement_md).toBe('Найдите производную $f(x)=x^2$.');
    expect(first.answer).toBe('2x');
    expect(first.topicName).toBe('Производная');
    expect(first.subtopicName).toBe('Правила дифференцирования');
    expect(first.difficulty).toBe('2');
    expect(first.tags).toEqual(['производная']);

    const second = parsed.variants[0].tasks[1];
    expect(second.examPart).toBe(2);
    expect(second.maxScore).toBe(2);
    expect(second.solution_md).toBe('Шаг 1.');

    expect(parsed.variants[1].tasks[0].statement_md).toBe('Найдите производную $f(x)=x^3$.');
  });

  it('картинка задачи дописывается ссылкой и переживает round-trip', () => {
    const md = buildWorkMarkdown({
      work,
      variants: [{ number: 1, tasks: [{ id: 'a', statement_md: 'График.', image: 'g.png', topic: 't1' }] }],
      topics,
      imageUrl: (t) => `https://pb.example/api/files/tasks/${t.id}/${t.image}`,
    });
    expect(md).toContain('![](https://pb.example/api/files/tasks/a/g.png)');
    const parsed = parseWorkMarkdown(md);
    expect(parsed.imagePlaceholders).toEqual([]); // внешняя ссылка, не плейсхолдер
    expect(parsed.variants[0].tasks[0].statement_md).toContain('pb.example');
  });

  it('работа с одним вариантом — без секции «## Вариант»', () => {
    const md = buildWorkMarkdown({ work, variants: [variants[0]], topics });
    expect(md).not.toContain('## Вариант');
    expect(parseWorkMarkdown(md).variants).toHaveLength(1);
  });
});

describe('buildAiPrompt', () => {
  const topics = [
    { id: 't1', title: 'Производная', exam_type: 'ege_profile', ege_number: 7 },
    { id: 't2', title: 'Вычисления', exam_type: 'ege_base', ege_number: 1 },
  ];

  it('включает каталог тем и правила формата', () => {
    const prompt = buildAiPrompt({ topics });
    expect(prompt).toContain('- Производная (№7)');
    expect(prompt).toContain('- Вычисления (№1)');
    expect(prompt).toContain('### 1');
    expect(prompt).toContain('![](рис1)');
  });

  it('сужает каталог по контексту', () => {
    const prompt = buildAiPrompt({ topics, examType: 'ege_base' });
    expect(prompt).toContain('Вычисления');
    expect(prompt).not.toContain('Производная');
  });

  it('обрезает слишком длинный каталог', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ id: `t${i}`, title: `Тема ${i}`, exam_type: 'oge' }));
    const prompt = buildAiPrompt({ topics: many, maxTopics: 3 });
    expect(prompt).toContain('показаны первые 3 тем из 10');
  });
});
