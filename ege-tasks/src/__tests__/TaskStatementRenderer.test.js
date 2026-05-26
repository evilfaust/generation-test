import { describe, it, expect } from 'vitest';
import { rewriteImageUrls } from '../components/TaskStatementRenderer';

// Мок api.getTaskImageRecordUrl используется внутри rewriteImageUrls,
// но в чистой функции мы заменяем по rec и формируем URL прямо. Поскольку
// api.getTaskImageRecordUrl читает PB_URL — для теста заменим путь через
// настоящий импорт, но в тестовой среде он отдаст некий URL. Нам важно лишь,
// что URL изменился (а не остался внешним).

const mockImages = [
  {
    id: 'rec1',
    file: '145381_abc.png',
    original_url: 'https://math-ege.sdamgia.ru/get_file?id=145381',
    sdamgia_file_id: '145381',
    role: 'solution',
    order: 1,
    collectionId: 'pbc_task_images',
    collectionName: 'task_images',
  },
  {
    id: 'rec2',
    file: '146533_xyz.png',
    original_url: '',
    sdamgia_file_id: '146533',
    role: 'solution',
    order: 2,
    collectionId: 'pbc_task_images',
    collectionName: 'task_images',
  },
];

describe('rewriteImageUrls', () => {
  it('пустой текст возвращает пустую строку', () => {
    expect(rewriteImageUrls('', mockImages)).toBe('');
    expect(rewriteImageUrls(null, mockImages)).toBe('');
  });

  it('без images текст возвращается как есть', () => {
    const md = 'Текст ![image](https://example.com/x.png) ещё текст';
    expect(rewriteImageUrls(md, [])).toBe(md);
  });

  it('подмена по original_url', () => {
    const md = 'Дано: ![image](https://math-ege.sdamgia.ru/get_file?id=145381)';
    const result = rewriteImageUrls(md, mockImages);
    expect(result).not.toContain('math-ege.sdamgia.ru');
    expect(result).toContain('145381_abc.png');
  });

  it('подмена по sdamgia_file_id если original_url не совпал', () => {
    // rec2 имеет file_id=146533, но original_url пустой —
    // подмена через извлечение id из URL
    const md = '![image](https://some-other-host.example/get_file?id=146533&foo=bar)';
    const result = rewriteImageUrls(md, mockImages);
    expect(result).toContain('146533_xyz.png');
  });

  it('внешний URL без совпадений остаётся как есть', () => {
    const md = '![image](https://external.com/unknown.png)';
    const result = rewriteImageUrls(md, mockImages);
    expect(result).toBe(md);
  });

  it('несколько ![image] в одном md — обрабатываются все', () => {
    const md = 'A ![image](https://math-ege.sdamgia.ru/get_file?id=145381) B ![image](https://x.com/get_file?id=146533) C';
    const result = rewriteImageUrls(md, mockImages);
    expect(result).toContain('145381_abc.png');
    expect(result).toContain('146533_xyz.png');
    expect(result).toMatch(/^A.*B.*C$/s);
  });

  it('alt-текст сохраняется', () => {
    const md = '![Чертёж 1](https://math-ege.sdamgia.ru/get_file?id=145381)';
    const result = rewriteImageUrls(md, mockImages);
    expect(result).toMatch(/^!\[Чертёж 1\]/);
  });

  it('LaTeX и обычный текст не трогаются', () => {
    const md = 'Формула $x^2 + 1$ и картинка ![image](https://math-ege.sdamgia.ru/get_file?id=145381)';
    const result = rewriteImageUrls(md, mockImages);
    expect(result).toContain('$x^2 + 1$');
    expect(result).toContain('145381_abc.png');
  });
});
