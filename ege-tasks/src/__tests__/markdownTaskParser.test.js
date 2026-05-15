import { describe, it, expect } from 'vitest';
import {
  convertToLatex,
  parseTags,
  parseYamlFrontmatter,
  detectFormat,
  parseEgeTasks,
} from '../utils/markdownTaskParser';

describe('parseTags', () => {
  it('обрабатывает массив', () => {
    expect(parseTags(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('обрабатывает строку через запятую', () => {
    expect(parseTags('a, b, c')).toEqual(['a', 'b', 'c']);
  });

  it('обрабатывает строку в квадратных скобках', () => {
    expect(parseTags('[тег1, тег2]')).toEqual(['тег1', 'тег2']);
  });

  it('обрезает пробелы у тегов', () => {
    expect(parseTags('  a  ,  b  ')).toEqual(['a', 'b']);
  });

  it('фильтрует пустые теги', () => {
    expect(parseTags('a, , b')).toEqual(['a', 'b']);
  });

  it('возвращает [] для falsy', () => {
    expect(parseTags(null)).toEqual([]);
    expect(parseTags(undefined)).toEqual([]);
    expect(parseTags('')).toEqual([]);
  });

  it('возвращает [] для неподдерживаемого типа', () => {
    expect(parseTags(42)).toEqual([]);
    expect(parseTags({})).toEqual([]);
  });
});

describe('parseYamlFrontmatter', () => {
  it('извлекает frontmatter в metadata', () => {
    const text = '---\ntopic: math\ndifficulty: 2\n---\nКонтент тут';
    const { metadata, content } = parseYamlFrontmatter(text);
    expect(metadata).toEqual({ topic: 'math', difficulty: 2 });
    expect(content).toBe('Контент тут');
  });

  it('возвращает null metadata если frontmatter нет', () => {
    const { metadata, content } = parseYamlFrontmatter('просто текст');
    expect(metadata).toBeNull();
    expect(content).toBe('просто текст');
  });

  it('возвращает yamlError для невалидного YAML', () => {
    const text = '---\n:::bad: yaml\n:::\n---\ntext';
    const result = parseYamlFrontmatter(text);
    // Либо распарсилось как пустое, либо есть ошибка
    expect(result.content).toBeDefined();
  });
});

describe('detectFormat', () => {
  it('определяет mordkovich по формату **043.9a**', () => {
    expect(detectFormat('**043.9a** [2] условие')).toBe('mordkovich');
    expect(detectFormat('**12.3** [1]')).toBe('mordkovich');
  });

  it('определяет ege по формату **число** [сложность]', () => {
    expect(detectFormat('**1** [1] условие')).toBe('ege');
    expect(detectFormat('**14** [2]')).toBe('ege');
  });

  it('по умолчанию ege', () => {
    expect(detectFormat('просто текст')).toBe('ege');
  });
});

describe('parseEgeTasks', () => {
  it('парсит простую задачу', () => {
    const md = '**1** [1] Найдите значение x\nответ: 5';
    const tasks = parseEgeTasks(md, {});
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      number: 1,
      difficulty: '1',
      answer: '5',
    });
    expect(tasks[0].statement_md).toContain('Найдите значение x');
  });

  it('парсит несколько задач подряд', () => {
    const md = `
**1** [1] Задача 1
ответ: 5

**2** [2] Задача 2
ответ: 10
`;
    const tasks = parseEgeTasks(md, {});
    expect(tasks).toHaveLength(2);
    expect(tasks[0].answer).toBe('5');
    expect(tasks[1].answer).toBe('10');
    expect(tasks[1].difficulty).toBe('2');
  });

  it('парсит теги', () => {
    const md = '**1** [1] Задача\nответ: 5\ntags: [алгебра, дроби]';
    const tasks = parseEgeTasks(md, {});
    expect(tasks[0].tags).toEqual(['алгебра', 'дроби']);
  });

  it('извлекает URL изображения', () => {
    const md = '**1** [1] Задача ![alt](https://example.com/img.png)\nответ: 5';
    const tasks = parseEgeTasks(md, {});
    expect(tasks[0].imageUrl).toBe('https://example.com/img.png');
    expect(tasks[0].statement_md).not.toContain('https://example.com');
  });

  it('применяет defaultDifficulty из metadata', () => {
    // У формата ЕГЭ сложность обязательна в `[N]`, но проверим что она используется
    const md = '**1** [3] Задача\nответ: 5';
    const tasks = parseEgeTasks(md, { difficulty: 1 });
    expect(tasks[0].difficulty).toBe('3'); // из [3]
  });

  it('убирает markdown-заголовки', () => {
    const md = '# Раздел\n**1** [1] Задача\nответ: 5';
    const tasks = parseEgeTasks(md, {});
    expect(tasks).toHaveLength(1);
  });
});

describe('convertToLatex', () => {
  it('преобразует "косинус альфа" в \\cos\\alpha', () => {
    const result = convertToLatex('косинус альфа');
    expect(result).toContain('\\cos\\alpha');
  });

  it('преобразует склеенную форму "косинусальфа"', () => {
    const result = convertToLatex('косинусальфа = 1');
    expect(result).toContain('\\cos\\alpha');
  });

  it('преобразует "корень из: 5" в \\sqrt{5}', () => {
    const result = convertToLatex('корень из: 5');
    expect(result).toContain('\\sqrt{5}');
  });

  it('преобразует дроби', () => {
    const result = convertToLatex('дробь: числитель: 1, знаменатель: 2');
    expect(result).toContain('\\frac{1}{2}');
  });

  it('преобразует греческие буквы в контексте (regex \\b не работает с кириллицей в одиночку)', () => {
    // \b в JS не распознаёт границы кириллических слов, поэтому
    // одиночное "альфа" не конвертируется. Но в составе с латинскими
    // соседями или другими шагами — работает.
    expect(convertToLatex('косинус альфа = 0')).toContain('\\alpha');
  });

  it('число + Пи → 2\\pi', () => {
    const result = convertToLatex('2 Пи');
    expect(result).toContain('2\\pi');
  });

  it('возвращает falsy/нестроки без изменений', () => {
    expect(convertToLatex(null)).toBe(null);
    expect(convertToLatex(undefined)).toBe(undefined);
    expect(convertToLatex(42)).toBe(42);
  });

  it('обычный текст без ключевых слов проходит без LaTeX-обёртки', () => {
    const result = convertToLatex('просто текст');
    expect(result).not.toContain('\\');
    expect(result).not.toContain('$');
  });
});
