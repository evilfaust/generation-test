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
IMAGES_FOLDER = "./images"
SOURCE_FOLDER = "source"

# Получаем имя файла из аргументов командной строки
if len(sys.argv) < 2:
    print("❌ Использование: python3 pb_parser.py <имя_файла>")
    print("   Пример: python3 pb_parser.py 14.md")
    print("   Пример: python3 pb_parser.py 15")
    sys.exit(1)

filename = sys.argv[1]
# Добавляем .md если не указано
if not filename.endswith('.md'):
    filename = f"{filename}.md"

MD_FILE = os.path.join(SOURCE_FOLDER, filename)

# Проверяем существование файла
if not os.path.exists(MD_FILE):
    print(f"❌ Файл не найден: {MD_FILE}")
    print(f"\n📁 Доступные файлы в папке {SOURCE_FOLDER}:")
    if os.path.exists(SOURCE_FOLDER):
        for f in sorted(os.listdir(SOURCE_FOLDER)):
            if f.endswith('.md'):
                print(f"   - {f}")
    sys.exit(1)

# --------------------------
# 1. Авторизация
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
# 2. Получаем topic_id по title
# --------------------------
def get_topic_id_by_title(title: str):
    params = {
        "perPage": 50,
        "filter": f'title = "{title}"'
    }
    resp = requests.get(f"{PB_URL}/api/collections/topics/records", headers=HEADERS, params=params)
    resp.raise_for_status()
    items = resp.json().get("items", [])
    if not items:
        raise ValueError(f"Тема с названием '{title}' не найдена в PB")
    return items[0]["id"]

def search_topic_interactive(search_term: str):
    """Интерактивный поиск темы"""
    print(f"🔍 Ищу тему: '{search_term}'")
    
    # Сначала точное совпадение
    try:
        topic_id = get_topic_id_by_title(search_term)
        print(f"✓ Найдена тема (точное совпадение): {search_term}")
        return topic_id
    except ValueError:
        pass
    
    # Получаем все темы
    resp = requests.get(
        f"{PB_URL}/api/collections/topics/records",
        headers=HEADERS,
        params={"perPage": 100}
    )
    resp.raise_for_status()
    all_topics = resp.json().get("items", [])
    
    # Поиск по частичному совпадению
    matching_topics = [
        t for t in all_topics 
        if search_term.lower() in t.get("title", "").lower()
    ]
    
    if not matching_topics:
        print(f"❌ Темы содержащие '{search_term}' не найдены")
        print("\n📋 Доступные темы в базе:")
        for i, t in enumerate(all_topics[:20], 1):
            print(f"   {i}. {t.get('title')}")
        
        choice = input("\nВведите номер темы или точное название: ").strip()
        if choice.isdigit():
            idx = int(choice) - 1
            if 0 <= idx < len(all_topics):
                return all_topics[idx]["id"]
        return get_topic_id_by_title(choice)
    
    if len(matching_topics) == 1:
        print(f"✓ Автоматически выбрана: {matching_topics[0]['title']}")
        return matching_topics[0]["id"]
    
    print(f"\n📋 Найдено {len(matching_topics)} подходящих тем:")
    for i, t in enumerate(matching_topics, 1):
        print(f"   {i}. {t.get('title')}")
    
    choice = int(input("\nВыберите номер темы: ")) - 1
    if 0 <= choice < len(matching_topics):
        selected = matching_topics[choice]
        print(f"✓ Выбрана тема: {selected['title']}")
        return selected["id"]
    
    raise ValueError("Неверный выбор")

# --------------------------
# 3. Работа с тегами
# --------------------------
def get_or_create_tag(tag_title: str):
    """
    Получает или создает тег по названию (title).
    Возвращает ID тега или None в случае ошибки.
    """
    tag_title = tag_title.strip()
    if not tag_title:
        return None
    
    try:
        # Ищем существующий тег по title
        resp = requests.get(
            f"{PB_URL}/api/collections/tags/records",
            headers=HEADERS,
            params={"filter": f'title = "{tag_title}"', "perPage": 1}
        )
        resp.raise_for_status()
        items = resp.json().get("items", [])
        
        if items:
            return items[0]["id"]
        
        # Создаем новый тег
        # Генерируем случайный цвет для тега
        import random
        colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8", 
                  "#F7DC6F", "#BB8FCE", "#85C1E2", "#F8B500", "#52BE80"]
        
        create_resp = requests.post(
            f"{PB_URL}/api/collections/tags/records",
            headers=HEADERS,
            json={
                "title": tag_title,
                "color": random.choice(colors)
            }
        )
        
        if create_resp.status_code == 200:
            tag_id = create_resp.json()["id"]
            print(f"   ✓ Создан новый тег: {tag_title}")
            return tag_id
        else:
            print(f"   ⚠️ Не удалось создать тег '{tag_title}': {create_resp.text}")
            return None
            
    except Exception as e:
        print(f"   ⚠️ Ошибка при работе с тегом '{tag_title}': {e}")
        return None

def get_or_create_tags(tags_str: str):
    """
    Получает или создает теги по строке с разделителями.
    Возвращает список ID тегов.
    """
    if not tags_str or not tags_str.strip():
        return []
    
    # Разделяем по запятой
    tag_list = [t.strip() for t in tags_str.split(",") if t.strip()]
    tag_ids = []
    
    for tag_title in tag_list:
        tag_id = get_or_create_tag(tag_title)
        if tag_id:
            tag_ids.append(tag_id)
    
    return tag_ids

# --------------------------
# 4. Генерация кода задачи
# --------------------------
def generate_code(topic_id: str):
    topic_resp = requests.get(f"{PB_URL}/api/collections/topics/records/{topic_id}", headers=HEADERS)
    topic_resp.raise_for_status()
    topic = topic_resp.json()
    ege_number = topic.get("ege_number")
    if not ege_number:
        raise ValueError("У темы не указан ege_number")

    tasks_resp = requests.get(
        f"{PB_URL}/api/collections/tasks/records",
        headers=HEADERS,
        params={"filter": f'topic = "{topic_id}"', "fields": "code", "perPage": 500}
    )
    tasks_resp.raise_for_status()
    counters = []
    for t in tasks_resp.json().get("items", []):
        code = t.get("code")
        if code and "-" in code:
            try:
                _, num = code.split("-")
                counters.append(int(num))
            except:
                continue
    next_num = max(counters, default=0) + 1
    return f"{ege_number}-{str(next_num).zfill(3)}"

# --------------------------
# 4. ПАРСИНГ MD С YAML
# --------------------------
print(f"\n📄 Читаю файл: {MD_FILE}")
with open(MD_FILE, "r", encoding="utf-8") as f:
    md_text = f.read()

# Парсим YAML-блок
yaml_block = re.search(r"^---\s*\n(.*?)\n---", md_text, re.DOTALL | re.MULTILINE)

if not yaml_block:
    print("❌ YAML-блок не найден!")
    print("Убедитесь что файл начинается с:")
    print("---")
    print("topic: Название темы")
    print("difficulty: 1")
    print("source: Источник")
    print("year: 2026")
    print("tags: тег1, тег2")
    print("---")
    exit(1)

# Парсим YAML
yaml_content = yaml_block.group(1)
metadata = yaml.safe_load(yaml_content)

print("\n📊 Метаданные из YAML:")
for key, value in metadata.items():
    print(f"   {key}: {value}")

# Извлекаем поля (точные названия из PocketBase)
topic_name = metadata.get("topic")
subtopic_name = metadata.get("subtopic")  # Парсим подтему из YAML
difficulty = str(metadata.get("difficulty", "1"))
source = metadata.get("source", "Не указан")
year = metadata.get("year", 2026)
tags_str = metadata.get("tags", "")

# Если subtopic не указана в YAML, пытаемся определить из имени файла
# Например: 16-1.md -> subtopic = "1", 16-2.md -> subtopic = "2"
if not subtopic_name:
    filename_match = re.match(r"(\d+)-(\d+)\.md$", filename)
    if filename_match:
        subtopic_name = filename_match.group(2)
        print(f"ℹ️  Подтема определена из имени файла: {subtopic_name}")

# Проверяем обязательные поля
if not topic_name:
    print("❌ Поле 'topic' обязательно!")
    exit(1)

# Получаем ID тегов (если есть)
print("\n🏷️  Обработка тегов...")
tag_ids = get_or_create_tags(tags_str)
if tag_ids:
    print(f"✓ Найдено/создано тегов: {len(tag_ids)}")
else:
    print("✓ Теги не используются")

# Интерактивный поиск темы
TOPIC_ID = search_topic_interactive(topic_name)

# Обновляем subtopic в topics если она указана
if subtopic_name:
    try:
        update_resp = requests.patch(
            f"{PB_URL}/api/collections/topics/records/{TOPIC_ID}",
            headers=HEADERS,
            json={"subtopic": subtopic_name}
        )
        if update_resp.status_code == 200:
            print(f"✓ Подтема '{subtopic_name}' установлена для темы")
        else:
            print(f"⚠️ Не удалось обновить подтему: {update_resp.text}")
    except Exception as e:
        print(f"⚠️ Ошибка при обновлении подтемы: {e}")

# --------------------------
# 5. Парсим задания
# --------------------------
tasks_block = re.search(r"### Задания\s*\n(.*?)\n### Ответы", md_text, re.DOTALL)
if not tasks_block:
    raise ValueError("Не найден блок '### Задания'")

tasks_lines = tasks_block.group(1).splitlines()
tasks = OrderedDict()
task_counter = 1

for line in tasks_lines:
    line = line.strip()
    if not line:
        continue
    m = re.match(r"^(\d+)\.\s+(.+)$", line)
    if m:
        num, statement = m.groups()
        tasks[task_counter] = {"statement_md": statement.strip()}
        task_counter += 1

print(f"\n📝 Найдено заданий: {len(tasks)}")

# --------------------------
# 6. Парсим ответы
# --------------------------
answers_block = re.search(r"### Ответы\s*\n(.*)", md_text, re.DOTALL)
if answers_block:
    answers_lines = answers_block.group(1).splitlines()
    answer_pattern = re.compile(r"^\|\s*(\d+)\s*\|\s*(.+?)\s*\|$")
    
    for line in answers_lines:
        m = answer_pattern.match(line.strip())
        if m:
            num, answer = m.groups()
            num = int(num)
            if num in tasks:
                tasks[num]["answer"] = answer.strip()

answers_count = sum(1 for t in tasks.values() if "answer" in t)
print(f"✓ Найдено ответов: {answers_count}")

if answers_count != len(tasks):
    print(f"⚠️ ВНИМАНИЕ: Количество ответов ({answers_count}) не совпадает с количеством заданий ({len(tasks)})")
    missing = [num for num, task in tasks.items() if "answer" not in task]
    if missing:
        print(f"   Отсутствуют ответы для заданий: {missing[:10]}{'...' if len(missing) > 10 else ''}")

# --------------------------
# 7. Проверяем дубли
# --------------------------
print(f"\n🔍 Проверяю дубликаты в базе...")
existing_statements = set()
existing_tasks_resp = requests.get(
    f"{PB_URL}/api/collections/tasks/records",
    headers=HEADERS,
    params={"perPage": 500, "filter": f'topic = "{TOPIC_ID}"', "fields": "statement_md"}
)
existing_tasks_resp.raise_for_status()

for t in existing_tasks_resp.json().get("items", []):
    existing_statements.add(t.get("statement_md", "").strip())

print(f"✓ Существующих задач в базе: {len(existing_statements)}")

# --------------------------
# 8. Загружаем в PB
# --------------------------
print(f"\n📤 Начинаю загрузку задач...")
print("="*60)

added_count = 0
skipped_count = 0
error_count = 0

for num, task in tasks.items():
    statement = task["statement_md"]
    
    if statement in existing_statements:
        print(f"⚠️  Задание {num}: пропущено (дубликат)")
        skipped_count += 1
        continue

    code = generate_code(TOPIC_ID)
    
    # Все поля из PocketBase schema
    record_data = {
        "code": code,
        "topic": TOPIC_ID,
        "difficulty": difficulty,
        "statement_md": statement,
        "answer": task.get("answer", ""),
        "solution_md": "",
        "explanation_md": "",
        "source": source,
        "year": year,
        "has_image": False,
    }
    
    # Добавляем теги только если они есть
    if tag_ids:
        record_data["tags"] = tag_ids

    # Обработка изображений
    files = None
    image_name = task.get("image", "")
    if image_name:
        image_path = os.path.join(IMAGES_FOLDER, image_name)
        if os.path.exists(image_path):
            files = {"image": open(image_path, "rb")}
            record_data["has_image"] = True
        else:
            print(f"⚠️  Задание {num}: картинка не найдена: {image_name}")

    try:
        r = requests.post(
            f"{PB_URL}/api/collections/{COLLECTION_NAME}/records",
            headers=HEADERS,
            data=record_data,
            files=files
        )

        if r.status_code == 200:
            print(f"✅ Задание {num}: добавлено с кодом {code}")
            added_count += 1
        else:
            print(f"❌ Задание {num}: ошибка {r.status_code}")
            print(f"   Ответ: {r.text}")
            error_count += 1
    except Exception as e:
        print(f"❌ Задание {num}: исключение - {e}")
        error_count += 1
    finally:
        if files:
            files["image"].close()

print("\n" + "="*60)
print(f"📊 ИТОГОВАЯ СТАТИСТИКА:")
print(f"   ✅ Добавлено: {added_count}")
print(f"   ⚠️  Пропущено (дубликаты): {skipped_count}")
print(f"   ❌ Ошибки: {error_count}")
print(f"   📝 Всего обработано: {len(tasks)}")
print("="*60)