import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import MathRenderer from '../shared/components/MathRenderer';
import { parseTableDirective } from '../utils/remarkTableModifiers';
import { normalizeTableDirectives } from '../utils/markdownTables';

const ANSWER_BLANK = '| А | Б | В | Г |\n| --- | --- | --- | --- |\n|   |   |   |   |';
const MATCHING = [
  '| ВЕЛИЧИНЫ | ЗНАЧЕНИЯ |',
  '| --- | --- |',
  '| А) длительность урока | 1) 17,6 секунды |',
  '| Б) норматив ГТО | 2) 45 минут |',
  '| В) время в пути | 3) 30 685 суток |',
].join('\n');

describe('parseTableDirective', () => {
  it('понимает русские и английские ключи', () => {
    expect(parseTableDirective('{без линий}')).toEqual(['plain']);
    expect(parseTableDirective('{plain}')).toEqual(['plain']);
    expect(parseTableDirective('{бланк}')).toEqual(['answers']);
    expect(parseTableDirective('{ Сетка }')).toEqual(['grid']);
  });

  it('понимает несколько модификаторов через запятую', () => {
    expect(parseTableDirective('{без линий, без шапки}')).toEqual(['plain', 'noheader']);
  });

  it('обычный текст в скобках директивой не считается', () => {
    expect(parseTableDirective('{x + 1}')).toBeNull();
    expect(parseTableDirective('{без линий, чепуха}')).toBeNull();
    expect(parseTableDirective('текст')).toBeNull();
    expect(parseTableDirective('{}')).toBeNull();
  });
});

describe('normalizeTableDirectives', () => {
  it('отделяет директиву пустыми строками от соседей', () => {
    const md = 'Текст\n{без линий}\n| A | B |\n| --- | --- |\n| 1 | 2 |';
    expect(normalizeTableDirectives(md)).toBe(
      'Текст\n\n{без линий}\n\n| A | B |\n| --- | --- |\n| 1 | 2 |',
    );
  });

  it('не трогает фигурные скобки вне контекста таблицы', () => {
    const md = 'Множество {1; 2; 3}\nобычный текст';
    expect(normalizeTableDirectives(md)).toBe(md);
  });
});

describe('MathRenderer — модификаторы таблиц', () => {
  it('директива {без линий} вешает класс и сама не печатается', () => {
    const { container } = render(<MathRenderer text={`{без линий}\n\n| A | B |\n| --- | --- |\n| 1 | 2 |`} />);
    expect(container.querySelector('table').className).toContain('md-table--plain');
    expect(container.textContent).not.toContain('без линий');
  });

  it('директива работает и без пустой строки перед таблицей', () => {
    const { container } = render(<MathRenderer text={`{бланк}\n| A | B |\n| --- | --- |\n| 1 | 2 |`} />);
    expect(container.querySelector('table').className).toContain('md-table--answers');
  });

  it('таблица А Б В Г с пустой строкой распознаётся как бланк ответа', () => {
    const { container } = render(<MathRenderer text={ANSWER_BLANK} />);
    expect(container.querySelector('table').className).toContain('md-table--answers');
    const cells = container.querySelectorAll('td');
    expect(cells).toHaveLength(4);
    cells.forEach((td) => expect(td.className).toContain('md-cell--blank'));
  });

  it('таблица соответствия («А) …» | «1) …») рендерится без линий', () => {
    const { container } = render(<MathRenderer text={MATCHING} />);
    expect(container.querySelector('table').className).toContain('md-table--plain');
  });

  it('обычная таблица с данными остаётся сеткой', () => {
    const { container } = render(<MathRenderer text={'| A | B |\n| --- | --- |\n| 1 | 2 |'} />);
    const cls = container.querySelector('table').className || '';
    expect(cls).not.toContain('md-table--');
  });

  it('{линии} отключает автоподбор бланка', () => {
    const { container } = render(<MathRenderer text={`{линии}\n\n${ANSWER_BLANK}`} />);
    const cls = container.querySelector('table').className || '';
    expect(cls).not.toContain('md-table--answers');
  });

  it('одиночная пустая ячейка в заполненной таблице не раздувается', () => {
    const md = '| A | B |\n| --- | --- |\n| 1 |  |\n| 2 | 3 |';
    const { container } = render(<MathRenderer text={md} />);
    expect(container.querySelector('.md-cell--blank')).toBeNull();
  });

  it('answerBoxes добавляет рамку-поле только пустым ячейкам', () => {
    const { container } = render(<MathRenderer text={ANSWER_BLANK} answerBoxes />);
    container.querySelectorAll('td').forEach((td) => expect(td.className).toContain('md-cell--box'));
  });
});
