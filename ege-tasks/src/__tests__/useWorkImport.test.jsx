import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// useWorkImport ходит в PocketBase — мокаем весь API-слой.
vi.mock('../services/pocketbase', () => ({
  api: {
    getTopic: vi.fn(),
    getTasksForDedup: vi.fn().mockResolvedValue([]),
    getOrCreateTag: vi.fn().mockResolvedValue('tag-1'),
    getOrCreateSubtopic: vi.fn().mockResolvedValue('sub-new'),
    createTask: vi.fn(),
    createTaskImage: vi.fn(),
    updateTask: vi.fn().mockResolvedValue({}),
    findTaskBySdamgiaId: vi.fn().mockResolvedValue(null),
    createWork: vi.fn().mockResolvedValue({ id: 'w-1', title: 'КР' }),
    createVariant: vi.fn().mockResolvedValue({ id: 'var-1' }),
    uploadWorkOriginals: vi.fn().mockResolvedValue({ id: 'w-1' }),
    getTaskImageRecordUrl: vi.fn((rec) => `https://pb/api/files/task_images/${rec.id}/f.png`),
  },
}));

import { useWorkImport } from '../hooks/useWorkImport';
import { api } from '../services/pocketbase';

const topics = [
  { id: 't-prof', title: 'Производная', exam_type: 'ege_profile', ege_number: 7 },
  { id: 't-geom', title: 'Геометрический смысл производной', exam_type: 'ege_profile', ege_number: 8 },
];

const MD = `---
работа: Контрольная «Производная»
класс: 11
контекст: ege_profile
---

## Вариант 1

### 1
тема: Производная
ответ: 2x

Найдите производную $f(x)=x^2$.

### 2
тема: Геометрический смысл производной

График.

## Вариант 2

### 1
тема: Производная
ответ: 3x^2

Найдите производную $f(x)=x^3$.`;

const setup = (md = MD) => {
  const hook = renderHook(() => useWorkImport({ topics, subtopics: [] }));
  act(() => { hook.result.current.parse(md); });
  return hook;
};

let created = 0;

beforeEach(() => {
  vi.clearAllMocks();
  created = 0;
  api.getTasksForDedup.mockResolvedValue([]);
  api.findTaskBySdamgiaId.mockResolvedValue(null);
  api.createTask.mockImplementation(async () => ({ id: `task-${++created}` }));
  api.createWork.mockResolvedValue({ id: 'w-1', title: 'Контрольная «Производная»' });
  api.getTopic.mockImplementation(async (id) => topics.find((t) => t.id === id));
});

describe('useWorkImport — разбор', () => {
  it('parse раскладывает работу на строки и подбирает темы', () => {
    const { result } = setup();
    expect(result.current.rows).toHaveLength(3);
    expect(result.current.rows.map((r) => r.topicId)).toEqual(['t-prof', 't-geom', 't-prof']);
    expect(result.current.parsed.work.title).toBe('Контрольная «Производная»');
  });

  it('updateRow меняет строку', () => {
    const { result } = setup();
    act(() => result.current.updateRow('v1-1', { topicId: 't-prof' }));
    expect(result.current.rows[1].topicId).toBe('t-prof');
  });

  it('setTopicForRows проставляет тему пачкой', () => {
    const { result } = setup();
    act(() => result.current.setTopicForRows(['v1-0', 'v2-0'], 't-geom'));
    expect(result.current.rows.filter((r) => r.topicId === 't-geom')).toHaveLength(3);
  });

  it('reset очищает состояние', () => {
    const { result } = setup();
    act(() => result.current.reset());
    expect(result.current.rows).toEqual([]);
    expect(result.current.parsed).toBe(null);
  });
});

describe('useWorkImport — поиск дублей', () => {
  it('находит дубль и переключает строку на переиспользование', async () => {
    api.getTasksForDedup.mockImplementation(async (topicId) => (
      topicId === 't-prof'
        ? [{ id: 'old-1', code: '7-001', statement_md: 'Найдите производную $f(x)=x^2$.' }]
        : []
    ));
    const { result } = setup();

    await act(async () => { await result.current.scanDuplicates(); });

    const row = result.current.rows.find((r) => r.key === 'v1-0');
    expect(row.mode).toBe('reuse');
    expect(row.reuseTaskId).toBe('old-1');
    expect(result.current.rows.find((r) => r.key === 'v2-0').mode).toBe('create');
  });
});

describe('useWorkImport — импорт', () => {
  it('создаёт задачи, работу и варианты с порядком', async () => {
    const { result } = setup();
    let summary;
    await act(async () => { summary = await result.current.runImport({ workMeta: { title: 'КР', classNumber: 11 } }); });

    expect(api.createTask).toHaveBeenCalledTimes(3);
    expect(summary.created).toBe(3);

    const first = api.createTask.mock.calls[0][0];
    expect(first.topic).toBe('t-prof');
    expect(first.code).toBe('7-001');
    expect(first.statement_md).toBe('Найдите производную $f(x)=x^2$.');
    expect(first.answer).toBe('2x');
    expect(first.has_image).toBe(false);

    // Вторая задача другой темы — свой префикс кода
    expect(api.createTask.mock.calls[1][0].code).toBe('8-001');

    expect(api.createWork).toHaveBeenCalledTimes(1);
    const workData = api.createWork.mock.calls[0][0];
    expect(workData.title).toBe('КР');
    expect(workData.class).toBe(11);
    expect(workData.topic).toBe('t-prof'); // самая частая тема
    expect(workData.import_meta.tasks_created).toBe(3);

    expect(api.createVariant).toHaveBeenCalledTimes(2);
    const v1 = api.createVariant.mock.calls[0][0];
    expect(v1).toMatchObject({ work: 'w-1', number: 1 });
    expect(v1.tasks).toEqual(['task-1', 'task-2']);
    expect(v1.order).toEqual([
      { taskId: 'task-1', position: 0 },
      { taskId: 'task-2', position: 1 },
    ]);
    expect(api.createVariant.mock.calls[1][0].number).toBe(2);
  });

  it('коды продолжают нумерацию темы', async () => {
    api.getTasksForDedup.mockImplementation(async (topicId) => (
      topicId === 't-prof' ? [{ id: 'x', code: '7-014', statement_md: 'другое' }] : []
    ));
    const { result } = setup();
    await act(async () => { await result.current.runImport({}); });

    const codes = api.createTask.mock.calls.map((c) => c[0].code);
    expect(codes).toEqual(['7-015', '8-001', '7-016']);
  });

  it('переиспользование не создаёт задачу, но попадает в вариант', async () => {
    const { result } = setup();
    act(() => result.current.updateRow('v1-0', { mode: 'reuse', reuseTaskId: 'old-1' }));

    let summary;
    await act(async () => { summary = await result.current.runImport({}); });

    expect(api.createTask).toHaveBeenCalledTimes(2);
    expect(summary.reused).toBe(1);
    expect(api.createVariant.mock.calls[0][0].tasks).toEqual(['old-1', 'task-1']);
  });

  it('исключённые задачи не импортируются', async () => {
    const { result } = setup();
    act(() => result.current.updateRow('v1-1', { mode: 'skip' }));

    await act(async () => { await result.current.runImport({}); });

    expect(api.createTask).toHaveBeenCalledTimes(2);
    expect(api.createVariant.mock.calls[0][0].tasks).toEqual(['task-1']);
  });

  it('задача из «Решу ЕГЭ» берётся из базы по sdamgia_id', async () => {
    api.findTaskBySdamgiaId.mockResolvedValue({ id: 'reshu-1' });
    const { result } = setup(`### 1
тема: Производная
решу: 512345

Найдите производную.`);

    let summary;
    await act(async () => { summary = await result.current.runImport({}); });

    expect(api.findTaskBySdamgiaId).toHaveBeenCalledWith('512345');
    expect(api.createTask).not.toHaveBeenCalled();
    expect(summary.reused).toBe(1);
    expect(api.createVariant.mock.calls[0][0].tasks).toEqual(['reshu-1']);
  });
});

describe('useWorkImport — чертежи', () => {
  const withImage = `### 1
тема: Производная

График функции.

![](рис1)

Найдите производную.`;

  it('единственный чертёж уходит в tasks.image, плейсхолдер вырезается', async () => {
    const { result } = setup(withImage);
    const file = new File(['x'], 'ris1.png', { type: 'image/png' });

    await act(async () => {
      await result.current.runImport({ placeholderFiles: { 'рис1': file } });
    });

    const payload = api.createTask.mock.calls[0][0];
    expect(payload).toBeInstanceOf(FormData);
    expect(payload.get('has_image')).toBe('true');
    expect(payload.get('statement_md')).toBe('График функции.\n\nНайдите производную.');
    expect(payload.get('image')).toBeInstanceOf(File);
    expect(api.createTaskImage).not.toHaveBeenCalled();
  });

  it('два чертежа идут в task_images, ссылки переписываются на локальные', async () => {
    api.createTaskImage.mockImplementation(async ({ original_url }) => ({ id: `img-${original_url}`, original_url }));
    const { result } = setup(`### 1
тема: Производная

![](рис1)

и

![](рис2)`);

    await act(async () => {
      await result.current.runImport({
        placeholderFiles: {
          'рис1': new File(['a'], 'a.png', { type: 'image/png' }),
          'рис2': new File(['b'], 'b.png', { type: 'image/png' }),
        },
      });
    });

    expect(api.createTaskImage).toHaveBeenCalledTimes(2);
    expect(api.createTask.mock.calls[0][0].has_image).toBe(false);
    const patch = api.updateTask.mock.calls[0][1];
    expect(patch.statement_md).toContain('https://pb/api/files/task_images/img-рис1/f.png');
    expect(patch.statement_md).toContain('https://pb/api/files/task_images/img-рис2/f.png');
  });

  it('плейсхолдер без файла — предупреждение, импорт продолжается', async () => {
    const { result } = setup(withImage);
    let summary;
    await act(async () => { summary = await result.current.runImport({}); });

    expect(summary.created).toBe(1);
    expect(summary.warnings.some((w) => w.includes('рис1'))).toBe(true);
  });
});

describe('useWorkImport — оригинал работы', () => {
  it('фото листка прикрепляется к работе', async () => {
    const { result } = setup();
    const photo = new File(['p'], 'list.jpg', { type: 'image/jpeg' });

    await act(async () => { await result.current.runImport({ originalFiles: [photo] }); });

    expect(api.uploadWorkOriginals).toHaveBeenCalledWith('w-1', [photo]);
  });

  it('без файлов загрузка не вызывается', async () => {
    const { result } = setup();
    await act(async () => { await result.current.runImport({}); });
    expect(api.uploadWorkOriginals).not.toHaveBeenCalled();
  });
});
