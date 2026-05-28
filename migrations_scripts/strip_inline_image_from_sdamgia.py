#!/usr/bin/env python3
"""
Миграция: убираем inline ![image](url) из statement_md sdamgia-задач.
Картинка хранится в file-поле tasks.image и/или в task_images — мы это
проверили: у всех 286 задач локальная копия есть.

Запуск:
  DRY-RUN: python3 strip_inline_image.py
  APPLY:   python3 strip_inline_image.py --apply

Бэкап перед запуском обязателен.
"""
import re
import sqlite3
import sys

DB = '/opt/pocketbase/pb_data/data.db'
APPLY = '--apply' in sys.argv

# ![image](url) с возможными переводами строк вокруг (сервер их добавлял)
PAT = re.compile(r'\n?!\[image\]\([^)]+\)\n?')

conn = sqlite3.connect(DB)
cur = conn.cursor()

rows = cur.execute("""
  SELECT t.id, t.statement_md, t.image,
    (SELECT COUNT(*) FROM task_images WHERE task = t.id AND role = 'condition') AS img_count
  FROM tasks t
  WHERE t.statement_md LIKE '%![image](%'
""").fetchall()

print(f'[migration] Задач с inline ![image]: {len(rows)}')
print(f'[migration] Режим: {"🔴 APPLY" if APPLY else "🟢 DRY-RUN"}')
print()

touched = 0
skipped = 0
unchanged = 0
samples = []

for task_id, statement, image, img_count in rows:
    has_backup = bool(image) or img_count > 0
    if not has_backup:
        skipped += 1
        print(f'  ⚠ {task_id}: ни image, ни task_images — пропускаем')
        continue

    cleaned = PAT.sub('', statement)
    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned).strip()
    if cleaned == statement:
        unchanged += 1
        continue

    touched += 1
    if len(samples) < 3:
        samples.append((task_id, statement, cleaned))

    if APPLY:
        cur.execute('UPDATE tasks SET statement_md = ? WHERE id = ?', (cleaned, task_id))

if APPLY:
    conn.commit()

print()
print(f'[migration] Обновлено:                {touched}')
print(f'[migration] Пропущено (нет копии):    {skipped}')
print(f'[migration] Не изменилось:            {unchanged}')

if samples and not APPLY:
    print()
    print('=== Примеры (ДО → ПОСЛЕ) ===')
    for task_id, before, after in samples:
        print(f'\n--- {task_id} ---')
        print('ДО:    ', repr(before[-150:]))
        print('ПОСЛЕ: ', repr(after[-150:]))

if not APPLY:
    print()
    print('Это DRY-RUN. Для применения: --apply')

conn.close()
