import { describe, it, expect } from 'vitest';
import { autofixTableDelimiters } from '../utils/markdownTables';

describe('autofixTableDelimiters', () => {
  it('вставляет пропущенный разделитель по числу столбцов заголовка', () => {
    const md = 'текст\n\n| НЕРАВЕНСТВА | РЕШЕНИЯ |\n| А) $x<0$ | `numline: domain 0 3` |\n| Б) $x>1$ |  |';
    const out = autofixTableDelimiters(md);
    expect(out).toContain('| НЕРАВЕНСТВА | РЕШЕНИЯ |\n| --- | --- |');
  });

  it('не трогает корректную таблицу с разделителем', () => {
    const md = '| A | B |\n| --- | --- |\n| 1 | 2 |';
    expect(autofixTableDelimiters(md)).toBe(md);
  });

  it('разделитель с выравниванием (:--:) считается валидным', () => {
    const md = '| A | B |\n|:---:|---:|\n| 1 | 2 |';
    expect(autofixTableDelimiters(md)).toBe(md);
  });

  it('считает столбцы по 3-колоночному заголовку', () => {
    const md = '| A | B | C |\n| 1 | 2 | 3 |';
    expect(autofixTableDelimiters(md)).toContain('\n| --- | --- | --- |\n');
  });

  it('не вставляет в одиночную строку с палками (не таблица)', () => {
    const md = '| просто строка |';
    expect(autofixTableDelimiters(md)).toBe(md);
  });

  it('текст без палок возвращается как есть', () => {
    expect(autofixTableDelimiters('обычный текст')).toBe('обычный текст');
  });

  it('не дублирует разделитель при повторном проходе (идемпотентность)', () => {
    const md = '| A | B |\n| 1 | 2 |';
    const once = autofixTableDelimiters(md);
    expect(autofixTableDelimiters(once)).toBe(once);
  });
});
