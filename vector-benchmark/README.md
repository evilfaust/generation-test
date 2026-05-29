# Бенчмарк эмбеддингов (Этап 0)

Цель: до постройки инфраструктуры проверить, что `bge-m3` адекватно ловит
похожесть математических задач, и выбрать **порог** + **калибровку процента** для UI.

См. контекст: `../lemma_vector_search_idea.md` § «Решения на 2026-05-29».

## Требования

- Ollama запущен (`ollama serve`) с моделью `bge-m3` (`ollama pull bge-m3`)
- Node 20+
- Доступ к PB API (`https://task-ege.oipav.ru`) — только чтение

## Пайплайн

```bash
cd vector-benchmark

node 1-fetch.mjs     # тянет ~1500 случайных задач из PB → data/tasks-sample.json
node 2-embed.mjs     # эмбеддит "тема + условие" через bge-m3 → data/vectors.json
node 3-pairs.mjs     # генерит ~90 пар на разметку → data/pairs-to-label.csv
```

### Ручная разметка (твой шаг)

1. Открой `data/pairs-to-label.csv` (Excel/Numbers/Google Sheets).
2. В колонке **label** проставь `1` (задачи похожи) или `0` (не похожи).
   Смотри на `text_a` / `text_b`. Колонку `cosine` можешь скрыть, чтобы
   размечать «вслепую» и не подыгрывать модели.
3. Сохрани как `data/pairs-labeled.csv`.

```bash
node 4-metrics.mjs   # precision/recall, лучший порог, формула калибровки %
```

## Индексатор (продакшн) — `index.mjs`

Держит `vec.db` на VPS свежим. Инкрементальный по `text_hash`.

```bash
node index.mjs            # инкремент в локальную vec.db
node index.mjs --full     # пересчитать всё заново (~20 мин)
node index.mjs --push     # инкремент + отправка новых векторов на VPS
```

`--push` шлёт на `POST {PDF_URL}/index-vectors` с заголовком `X-Index-Token`
(env `INDEX_TOKEN`, должен совпадать с тем, что в systemd override pdf-service).

### Авто-обновление (launchd на Mac)

Агент `~/Library/LaunchAgents/com.lemma.vecindex.plist` запускает
`node index.mjs --push` раз в 30 мин (пока Mac включён). Управление:

```bash
launchctl load   ~/Library/LaunchAgents/com.lemma.vecindex.plist   # включить
launchctl unload ~/Library/LaunchAgents/com.lemma.vecindex.plist   # выключить
launchctl start  com.lemma.vecindex                                # прямо сейчас
tail -f data/vecindex.log                                          # логи
```

⚠️ Токен `INDEX_TOKEN` хранится в plist и в systemd override на VPS —
**не коммитить**. Для дедуп-вкладки (B2) кластеры в `dedup-clusters.json`
обновляются отдельно: `node dedup-scan.mjs` + scp файла на VPS.

## Настройка

Через env-переменные (см. `lib/config.mjs`):

```bash
SAMPLE_SIZE=3000 node 1-fetch.mjs        # больше пул → больше шанс найти дубли
EMBED_MODEL=bge-large node 2-embed.mjs   # сравнить другую модель
PAIRS_TO_LABEL=120 node 3-pairs.mjs
```

## Что эмбеддим

`Тема: <topic.title>.\n<очищенный statement_md>` — решение от 2026-05-29
(условие + тема, лёгкая чистка LaTeX, см. `lib/cleanLatex.mjs`).

## Результат этапа

- precision@порог и recall на размеченных парах;
- рекомендованный порог косинуса «похожа / нет»;
- формула пересчёта косинуса в честный процент для UI
  (у bge-m3 косинус несвязанных пар ≈ 0.4–0.6, сырой как % врёт).

Если метрики хорошие → катим bge-m3 и переходим к инфраструктуре
(sqlite-vec в PB + коллекции `task_embeddings` / `task_families`).
Если плохие → меняем модель или состав текста и повторяем.
