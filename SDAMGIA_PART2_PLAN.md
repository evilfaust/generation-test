# План: парсер задач части 2 ЕГЭ-профиль (sdamgia.ru)

**Статус:** утверждён, в работе
**Бэкап БД:** `/opt/pocketbase/backups/pre_part2_parser_20260526_213536.db` (VPS, 11 MB)
**Baseline pdf-service.js:** скачан с VPS в `pocketbase/pdf-service.js` (737 строк)

## Цель

Расширить существующий импорт «РЕШУ ЕГЭ» (`TaskImporter.jsx` → `/parse-sdamgia`) для задач **части 2** (развёрнутое решение):
- Несколько чертежей в условии и в решении.
- Все чертежи — хранить у себя в PocketBase, не ссылками на sdamgia.
- Аккуратное решение с LaTeX (KaTeX-совместимый синтаксис).
- Критерии оценивания, балл, ссылка на «РЕШУ ЕГЭ», номер задачи.

## Решения по дизайну (зафиксировано с пользователем)

1. Задачи части 2 — **в существующую коллекцию `tasks`**, отличаются полем `exam_part=2`.
2. Картинки — **отдельная коллекция `task_images`** (cascade delete), поле `role` = `condition`/`solution`/`criteria`.
3. Плейсхолдеры в md-текстах: `[[img:condition:1]]`, `[[img:solution:3]]` и т.п. Рендерер по образцу `RouteStatementRenderer`.
4. LaTeX — конвертируем, не оставляем как картинки. Стратегия в три уровня:
   - alt-атрибут SVG (уже работает через `cleanLatexFormula` на сервере) + расширение эвристик.
   - Валидация через `katex.renderToString` (на сервере, в try-catch).
   - **LLM fallback** — только по явному клику учителя на проблемных задачах. Endpoint `/latex-fix` на l.oipav.ru (по образцу `/define`).
5. Существующим задачам выставляем `exam_part=1` миграцией (default).
6. Критерии — md-таблица (не картинка).
7. `solution_html_raw` решили **не делать** — избыточно, перепарсить можно по `sdamgia_url`.

## Миграции БД

### `1772000038_extend_tasks_for_part2.js`
Добавить в `tasks`:
| Поле | Тип | По умолчанию |
|---|---|---|
| `sdamgia_id` | text, index | null |
| `sdamgia_url` | text | null |
| `exam_part` | number | 1 |
| `criteria_md` | text | "" |
| `max_score` | number | null |
| `latex_needs_review` | bool | false |

### `1772000039_create_task_images.js`
Новая коллекция `task_images`:
| Поле | Тип | Примечание |
|---|---|---|
| `task` | relation → tasks | cascadeDelete=true, maxSelect=1 |
| `role` | select | `condition` / `solution` / `criteria` |
| `order` | number | 1..N в рамках (task, role) |
| `file` | file | maxSelect=1 |
| `sdamgia_file_id` | text, index | для дедупа |
| `original_url` | text | для отладки |
| `width` / `height` | number | для рендера без layout shift |

Правила доступа — как у `tasks`.

## Серверная часть (`pocketbase/pdf-service.js` на VPS)

Текущее состояние (зафиксировано в репо как baseline):
- Уже умеет: `parseProblemFromDiv`, извлечение id из `.prob_nums a`, условие из `.pbody`, ответ из `.answer`, решение из `.solution` (с уже выделенными `solution_images`).
- Уже есть `cleanLatexFormula` со словарём русских описаний (alt SVG-формул).
- ⚠️ Сейчас **удаляет** `.prob_crits` внутри `.solution` — для части 2 надо сохранять.

### Что доработать:
1. **`parseProblemFromDiv`**:
   - Извлекать `sdamgia_url` из `.prob_nums a[href]` (+ baseUrl).
   - Парсить `.prob_crits` отдельно → `criteria_md` (HTML-таблица → md-таблица через существующий `tableToMarkdown`) + `criteria_images`.
   - Извлекать `max_score` из текста критериев (паттерн «N баллов»).
2. **`processCondition`** — расширить:
   - Картинки возвращать как объекты `{url, file_id, width, height}`, а не плоские url.
   - Вместо `![image](url)` ставить плейсхолдер `[[img:{role}:{N}]]` (роль передавать аргументом).
   - `file_id` извлекать из `?id=NNNNN` в URL — для будущего дедупа.
3. **`cleanLatexFormula`** — добавить пост-нормализатор KaTeX (см. ниже).
4. **`/parse-sdamgia`** ответ:
   ```js
   {
     count, problems: [{
       id, sdamgia_url, condition, answer, solution,
       criteria_md, max_score,
       condition_images: [{url, file_id, width, height}, ...],
       solution_images: [...],
       criteria_images: [...],
       latex_needs_review: bool
     }]
   }
   ```

### LaTeX-нормализатор (новый файл `pocketbase/latex-fixer.js`)
Правила (приоритет — то что упоминал пользователь):
1. Аргументы команд `\sin \cos \tan \cot \log \ln \sqrt \frac` в `(...)` → `{...}` (whitelist + смотрим контекст).
2. `\sqrt(x)` → `\sqrt{x}`.
3. `x^23` (многозначная степень без скобок) → `x^{23}`. Аналогично `_`.
4. `0,5` → `0{,}5` (десятичная запятая в KaTeX).
5. `30°` / `30^\circ` → `30^{\circ}`.
6. Текстовые операторы без бэкслеша: `\bsin x\b` → `\sin x` (cos/tan/lg/ln тоже).
7. MathML-артефакты: `\mn{...}` `\mi{...}` `\mo{...}` → содержимое.
8. `&nbsp;` `&minus;` → пробел / `-`.
9. Парные `\dfrac` оставлять как есть, `/dfrac/` исправлять.

Покрыть **юнит-тестами на ≥30 формулах из реальных задач sdamgia** (тестовый файл `pocketbase/latex-fixer.test.js`, node:test). Это первое, что пишем после миграций.

### Валидатор
```js
import katex from 'katex';
function validateLatex(formula) {
  try { katex.renderToString(formula, { throwOnError: true }); return true; }
  catch { return false; }
}
```
Если хоть одна формула в решении не валидируется — `latex_needs_review: true` на задаче.

### LLM endpoint `/latex-fix`
- Новый сервис или ручка на существующем gateway `l.oipav.ru` (там уже есть `/define` на deepseek).
- Body: `{ text, role: 'condition'|'solution', context?: string }`.
- Response: `{ text, latex_needs_review: bool }`.
- Промпт строгий, с примерами KaTeX-болевых точек (см. план в чате).
- Кэш ответов по `sha256(input)` (sqlite-файл рядом с сервисом).

## Frontend

### `parseSdamgiaResult` (`ege-tasks/src/utils/markdownTaskParser.js`)
Пробросить новые поля в task-объект:
```js
{
  ...уже есть...,
  sdamgia_id,            // уже было `sdamgiaId`, переименовать в snake_case консистентно или оставить
  sdamgia_url,           // НОВОЕ
  exam_part,             // из метаданных формы
  max_score,             // НОВОЕ (если есть)
  criteria_md,           // НОВОЕ
  condition_images: [],  // [{url, file_id, width, height}, ...]
  solution_images: [],
  criteria_images: [],
  latex_needs_review,    // НОВОЕ
}
```

### `useTaskImport.js` — `handleImport()`
После `createTask` (или `updateTask` при идемпотентности по `sdamgia_id`):
1. Скачать каждую картинку через fetch → blob.
2. Создать запись `task_images` с file, role, order, file_id, original_url.
3. Идемпотентность: перед созданием искать существующую задачу с тем же `sdamgia_id`.

### `TaskImporter.jsx`
В sdamgia-форме (шаг 1):
- Переключатель «Часть экзамена: 1 / 2».
- При `exam_part=2`: селектор «Макс. балл» (1/2/3/4).

В предпросмотре (шаг 2):
- Для задач с `latex_needs_review=true` — бейдж «⚠ Проверить LaTeX» + кнопка **«🤖 Перепарсить формулы через LLM»** (на этой одной задаче).
- Отображать количество картинок (условие/решение).

### Рендерер `TaskStatementRenderer.jsx` (новый)
По образцу `components/route-sheet/RouteStatementRenderer.jsx`:
- Принимает `task` с `expand.task_images` (или отдельный массив).
- Токенизация `/\[\[img:(condition|solution|criteria):(\d+)\]\]/g`.
- Между плейсхолдерами — `<MathRenderer>`, на местах плейсхолдеров — `<img>`.

### Подключение
TaskCard, TaskEditModal, StudentTaskView, печатные лейауты (PrintableWorksheet и т.п.) — заменить вывод `statement_md` на `<TaskStatementRenderer task={task} />`.
⚠️ Перед каждой правкой — проверять, что компонент реально подключён к роуту.

### UI-маркеры
- Бейдж «Часть 2» в TaskCard при `exam_part===2`.
- Бейдж «{max_score} б.» при наличии.
- Кнопка «↗ Решу ЕГЭ» в TaskEditModal по `sdamgia_url`.
- Раскрывающийся блок «Критерии оценивания» в просмотре решения.
- Фильтр «Часть: 1/2/любая» в TaskList.

## Порядок работ

1. ✅ Бэкап БД (VPS, готов).
2. ✅ Сохранён baseline `pdf-service.js` в репо.
3. Миграции 038 + 039 — локально проверить + накатить на VPS.
4. **`latex-fixer.js` + юнит-тесты** (≥30 формул) — это критический модуль.
5. Расширение `parseProblemFromDiv` и `processCondition` (criteria, плейсхолдеры, объекты картинок).
6. `/latex-fix` endpoint на l.oipav.ru + кэш.
7. `parseSdamgiaResult` + `useTaskImport.handleImport` (новые поля + загрузка картинок в `task_images`).
8. `TaskImporter.jsx` UI: переключатель «Часть 2», селектор балла, кнопка LLM-fix.
9. `TaskStatementRenderer.jsx` + тесты.
10. Подключение рендерера во всех точках вывода задач.
11. UI-маркеры части 2.
12. Прогон полного импорта на одной категории (например, `category_id=276`).
13. `SDAMGIA_PART2_PARSING.md` (документация для будущего) + `CHANGELOG.md` + version bump в корневом `package.json`.

## Открытые вопросы (закрыты)

- ✅ `latex_needs_review` — да, добавляем.
- ✅ LLM — только по ручному клику на проблемных задачах.
- ✅ Категории sdamgia — маппинг как сейчас (тема выбирается в UI, при отсутствии — создаётся через существующий механизм).
- ✅ Критерии — md-таблица.
- ✅ Существующим задачам — `exam_part=1` (default).
- ✅ `solution_html_raw` — не делаем.
