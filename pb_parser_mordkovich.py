import re
import os
import sys
import yaml
import requests
from collections import OrderedDict

# --------------------------
# Настройки
# --------------------------
PB_URL = "http://127.0.0.1:8090"
ADMIN_EMAIL = "oleg.faust@gmail.com"
ADMIN_PASSWORD = "Zasadazxasqw12#"
COLLECTION_NAME = "tasks"
SOURCE_FOLDER = "source/mordkovich"

# Получаем номер параграфа из аргументов
if len(sys.argv) < 2:
    print("❌ Использование: python3 pb_parser_mordkovich.py <номер_параграфа>")
    print("   Пример: python3 pb_parser_mordkovich.py 14")
    sys.exit(1)

paragraph_num = sys.argv[1]
filename = f"{paragraph_num}.md"
MD_FILE = os.path.join(SOURCE_FOLDER, filename)

# Проверяем существование файла
if not os.path.exists(MD_FILE):
    print(f"❌ Файл не найден: {MD_FILE}")
    print(f"\n📁 Доступные файлы в папке {SOURCE_FOLDER}:")
    if os.path.exists(SOURCE_FOLDER):
        for f in sorted(os.listdir(SOURCE_FOLDER)):
            if f.endswith('.md') and f[:-3].replace('.', '').isdigit():
                print(f"   - {f}")
    sys.exit(1)

# --------------------------
# Авторизация
# --------------------------
def admin_login():
    resp = requests.post(
        f"{PB_URL}/api/collections/_superusers/auth-with-password",
        json={"identity": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    resp.raise_for_status()
    return resp.json()["token"]

TOKEN = admin_login()
HEADERS = {"Authorization": f"Bearer {TOKEN}"}
print("✅ Авторизация прошла успешно")

# --------------------------
# Работа с тегами
# --------------------------
def get_or_create_tag(tag_title: str):
    """Получает или создает тег по названию"""
    tag_title = tag_title.strip()
    if not tag_title:
        return None
    
    try:
        resp = requests.get(
            f"{PB_URL}/api/collections/tags/records",
            headers=HEADERS,
            params={"filter": f'title = "{tag_title}"', "perPage": 1}
        )
        resp.raise_for_status()
        items = resp.json().get("items", [])
        
        if items:
            return items[0]["id"]
        
        import random
        colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8", 
                  "#F7DC6F", "#BB8FCE", "#85C1E2", "#F8B500", "#52BE80"]
        
        create_resp = requests.post(
            f"{PB_URL}/api/collections/tags/records",
            headers=HEADERS,
            json={"title": tag_title, "color": random.choice(colors)}
        )
        
        if create_resp.status_code == 200:
            tag_id = create_resp.json()["id"]
            print(f"   ✓ Создан новый тег: {tag_title}")
            return tag_id
            
    except Exception as e:
        print(f"   ⚠️ Ошибка при работе с тегом '{tag_title}': {e}")
        return None

def get_or_create_tags(tags_str: str):
    """Получает или создает теги по строке с разделителями"""
    if not tags_str or not tags_str.strip():
        return []
    
    tag_list = [t.strip() for t in tags_str.split(",") if t.strip()]
    tag_ids = []
    
    for tag_title in tag_list:
        tag_id = get_or_create_tag(tag_title)
        if tag_id:
            tag_ids.append(tag_id)
    
    return tag_ids

# --------------------------
# Получение/создание топика (ИСПРАВЛЕНО: НЕ СОЗДАЕТ ДУБЛИКАТ)
# --------------------------
def get_or_create_topic(paragraph_num: str, title: str, description: str = ""):
    """Получает или создает топик для параграфа Мордковича"""
    topic_code = f"M{paragraph_num}"
    
    # Ищем существующий топик
    resp = requests.get(
        f"{PB_URL}/api/collections/topics/records",
        headers=HEADERS,
        params={"filter": f'ege_number = "{topic_code}"', "perPage": 1}
    )
    resp.raise_for_status()
    items = resp.json().get("items", [])
    
    if items:
        # Если топик найден, просто возвращаем его ID
        print(f"✓ Топик уже существует: {items[0]['title']} (ID: {items[0]['id']})")
        return items[0]["id"]
    
    # Создаем новый топик только если не нашли
    print(f"🆕 Создаю новый топик для §{paragraph_num}...")
    create_resp = requests.post(
        f"{PB_URL}/api/collections/topics/records",
        headers=HEADERS,
        json={
            "title": title,
            "ege_number": topic_code,
            "description": description or f"Задачник Мордкович, §{paragraph_num}"
        }
    )
    
    if create_resp.status_code == 200:
        topic_id = create_resp.json()["id"]
        print(f"✓ Создан новый топик: {title}")
        return topic_id
    else:
        raise Exception(f"Не удалось создать топик: {create_resp.text}")

# --------------------------
# Генерация кода задачи
# --------------------------
def generate_code(topic_id: str, paragraph_num: str):
    """Генерирует код задачи в формате M{параграф}-{номер}"""
    tasks_resp = requests.get(
        f"{PB_URL}/api/collections/tasks/records",
        headers=HEADERS,
        params={"filter": f'topic = "{topic_id}"', "fields": "code", "perPage": 500}
    )
    tasks_resp.raise_for_status()
    
    counters = []
    prefix = f"M{paragraph_num}-"
    
    for t in tasks_resp.json().get("items", []):
        code = t.get("code", "")
        if code.startswith(prefix):
            try:
                num = code.replace(prefix, "")
                counters.append(int(num))
            except:
                continue
    
    next_num = max(counters, default=0) + 1
    return f"{prefix}{str(next_num).zfill(3)}"

# --------------------------
# Парсинг MD файла
# --------------------------
print(f"\n📄 Читаю файл: {MD_FILE}")
with open(MD_FILE, "r", encoding="utf-8") as f:
    md_text = f.read()

# Парсим YAML-блок
yaml_block = re.search(r"^---\s*\n(.*?)\n---", md_text, re.DOTALL | re.MULTILINE)

if not yaml_block:
    print("❌ YAML-блок не найден!")
    sys.exit(1)

yaml_content = yaml_block.group(1)
metadata = yaml.safe_load(yaml_content)

print("\n📊 Метаданные из YAML:")
for key, value in metadata.items():
    print(f"   {key}: {value}")

topic_name = metadata.get("topic")
paragraph = str(metadata.get("paragraph", paragraph_num))
# Сложность по умолчанию из YAML
default_difficulty = str(metadata.get("difficulty", "1"))
source = metadata.get("source", "Мордкович А.Г. Задачник")
year = metadata.get("year", 2024)
tags_str = metadata.get("tags", "")

if not topic_name:
    print("❌ Поле 'topic' обязательно!")
    sys.exit(1)

print("\n🏷️  Обработка тегов...")
tag_ids = get_or_create_tags(tags_str)

TOPIC_ID = get_or_create_topic(paragraph, topic_name)

# --------------------------
# Парсинг заданий (ИСПРАВЛЕНО: СКЛЕЙКА УСЛОВИЯ + сложность из квадратных скобок)
# --------------------------
print(f"\n📝 Парсинг заданий...")

tasks_section = re.search(r'## Задания\s*\n(.*?)\n## Ответы', md_text, re.DOTALL)
if not tasks_section:
    tasks_section = re.search(r'## Задания\s*\n(.*)', md_text, re.DOTALL)

if not tasks_section:
    print("❌ Не найдена секция '## Задания'")
    sys.exit(1)

tasks_text = tasks_section.group(1)

# Обновленный паттерн для извлечения сложности из квадратных скобок
task_pattern = re.compile(
    r'(?:\*\*)?(\d+\.\d+)\.(?:\*\*)?\s*\[(\d+)\]\s*(.+?)(?=\n(?:\*\*)?\d+\.\d+\.(?:\*\*)?|\n##|\Z)',
    re.MULTILINE | re.DOTALL
)

tasks = OrderedDict()
task_difficulties = {}  # Словарь для хранения сложности каждого задания

for match in task_pattern.finditer(tasks_text):
    task_num = match.group(1)
    difficulty = match.group(2)  # Сложность из квадратных скобок
    task_content = match.group(3).strip()
    
    # Сохраняем сложность задания
    task_difficulties[task_num] = difficulty
    
    # --- НОВЫЙ БЛОК: ИЗВЛЕЧЕНИЕ ИНСТРУКЦИИ (например, "Вычислите:") ---
    # Инструкция - это текст до первого подпункта "а)"
    instruction_parts = re.split(r'^\s*[а-гa-d]\)', task_content, flags=re.MULTILINE)
    instruction = instruction_parts[0].strip() if len(instruction_parts) > 1 else ""
    # ----------------------------------------------------------------
    
    subtask_pattern = re.compile(r'^\s*([а-г]|[a-d])\)\s*(.+)$', re.MULTILINE)
    subtasks = {}
    
    for subtask_match in subtask_pattern.finditer(task_content):
        letter = subtask_match.group(1)
        statement = subtask_match.group(2).strip()
        
        # --- СКЛЕЙКА: "Инструкция + само задание" ---
        full_statement = f"{instruction} {statement}".strip()
        
        letter_map = {'а': 'a', 'б': 'b', 'в': 'c', 'г': 'd'}
        letter_norm = letter_map.get(letter, letter)
        subtasks[letter_norm] = full_statement
    
    if subtasks:
        tasks[task_num] = subtasks

print(f"✓ Найдено заданий: {len(tasks)}")
total_subtasks = sum(len(subtasks) for subtasks in tasks.values())

# --------------------------
# Парсинг ответов
# --------------------------
print(f"\n📝 Парсинг ответов...")

answers = {}
answer_section = re.search(r'## Ответы\s*\n(.*)', md_text, re.DOTALL)
if answer_section:
    answer_text = answer_section.group(1)
    row_pattern = re.compile(r'\|\s*\*\*(\d+\.\d+)\*\*\s*\|\s*(.*?)\s*\|', re.DOTALL)
    subanswer_pattern = re.compile(r'\*\*([а-г])\)\*\*\s*([^;|]+)', re.DOTALL)
    letter_map = {'а': 'a', 'б': 'b', 'в': 'c', 'г': 'd'}

    for t_num, cell in row_pattern.findall(answer_text):
        subtask_answers = {}
        for letter, value in subanswer_pattern.findall(cell):
            letter_norm = letter_map[letter]
            subtask_answers[letter_norm] = value.strip()
        if subtask_answers:
            answers[t_num] = subtask_answers

# --------------------------
# Проверка дубликатов
# --------------------------
print(f"\n🔍 Проверяю дубликаты в базе...")
existing_statements = set()
existing_tasks_resp = requests.get(
    f"{PB_URL}/api/collections/tasks/records",
    headers=HEADERS,
    params={"perPage": 1000, "filter": f'topic = "{TOPIC_ID}"', "fields": "statement_md"}
)
existing_tasks_resp.raise_for_status()

for t in existing_tasks_resp.json().get("items", []):
    existing_statements.add(t.get("statement_md", "").strip())

# --------------------------
# Загрузка в PocketBase
# --------------------------
print(f"\n📤 Начинаю загрузку задач...")
print("="*60)

added_count = 0
skipped_count = 0
error_count = 0

for task_num, subtasks in tasks.items():
    for letter, statement in subtasks.items():
        full_task_name = f"{task_num}{letter}"
        
        if statement in existing_statements:
            print(f"⚠️  {full_task_name}: пропущено (дубликат)")
            skipped_count += 1
            continue
        
        answer = answers.get(task_num, {}).get(letter, "")
        code = generate_code(TOPIC_ID, paragraph)
        
        # Определяем сложность: из квадратных скобок или из YAML по умолчанию
        difficulty = task_difficulties.get(task_num, default_difficulty)
        
        record_data = {
            "code": code,
            "topic": TOPIC_ID,
            "difficulty": difficulty,
            "statement_md": statement,
            "answer": answer,
            "source": f"{source}, §{paragraph}, №{full_task_name}",
            "year": year,
        }
        
        if tag_ids:
            record_data["tags"] = tag_ids
        
        try:
            r = requests.post(
                f"{PB_URL}/api/collections/{COLLECTION_NAME}/records",
                headers=HEADERS,
                json=record_data
            )
            if r.status_code == 200:
                print(f"✅ {full_task_name}: добавлено ({code}), сложность: {difficulty}")
                added_count += 1
            else:
                print(f"❌ {full_task_name}: ошибка {r.status_code}")
                error_count += 1
        except Exception as e:
            print(f"❌ {full_task_name}: исключение - {e}")
            error_count += 1

print("\n" + "="*60)
print(f"📊 ИТОГОВАЯ СТАТИСТИКА:")
print(f"   ✅ Добавлено: {added_count}")
print(f"   ⚠️  Пропущено: {skipped_count}")
print(f"   ❌ Ошибки: {error_count}")

