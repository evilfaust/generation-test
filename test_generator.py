import os
import re
import random
import argparse


COUNTER_DIR = 'counters'
CARDS_DIR = 'cards'
ANSWERS_DIR = 'answers'


# =========================
# Счётчик карточек
# =========================

def get_next_card_numbers(file_num, count):
    """Получает следующие номера карточек для конкретного файла задания"""
    os.makedirs(COUNTER_DIR, exist_ok=True)
    counter_file = os.path.join(COUNTER_DIR, f'card_counter_{file_num}.txt')

    if os.path.exists(counter_file):
        with open(counter_file, 'r') as f:
            current = int(f.read().strip())
    else:
        current = 0

    numbers = []
    for i in range(current + 1, current + count + 1):
        numbers.append(f"{file_num}-{i:03d}")

    with open(counter_file, 'w') as f:
        f.write(str(current + count))

    return numbers


# =========================
# Парсинг md
# =========================

def parse_md_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    tasks = {}
    answers = {}

    # -------- задания --------
    for line in lines:
        line = line.strip()
        m = re.match(r'^(\d+)\.\s*(.+)$', line)
        if m:
            tasks[int(m.group(1))] = m.group(2)

    # -------- ответы --------
    in_keys = False
    for line in lines:
        line = line.strip()

        if line.lower() == 'keys':
            in_keys = True
            continue

        if not in_keys:
            continue

        if not line.startswith('|') or '---' in line:
            continue

        cells = [c.strip().replace('**', '') for c in line.split('|') if c.strip()]

        # читаем парами: № — ответ
        for i in range(0, len(cells) - 1, 2):
            if cells[i].isdigit():
                answers[int(cells[i])] = cells[i + 1]

    if not tasks:
        raise ValueError("Задания не найдены")

    return tasks, answers


# =========================
# Генерация карточек
# =========================

def generate_cards(file_num, tasks_per_card, cards_count):
    tasks, answers = parse_md_file(f'source/{file_num}.md')
    task_numbers = list(tasks.keys())

    card_ids = get_next_card_numbers(file_num, cards_count)
    cards = []

    for card_id in card_ids:
        selected = random.sample(task_numbers, tasks_per_card)
        cards.append({
            'id': card_id,
            'tasks': [{
                'expr': tasks[n],
                'answer': answers.get(n, '—')
            } for n in selected]
        })

    return cards


# =========================
# Сохранение карточек в отдельные файлы
# =========================

def write_cards_separate(cards):
    """Сохраняет каждую карточку в отдельный файл"""
    os.makedirs(CARDS_DIR, exist_ok=True)

    for card in cards:
        filename = os.path.join(CARDS_DIR, f"{card['id']}.md")

        md = f"# Карточка №{card['id']}\n\n"
        for i, t in enumerate(card['tasks'], 1):
            md += f"{i}. {t['expr']}\n"

        with open(filename, 'w', encoding='utf-8') as f:
            f.write(md)


def write_answers_separate(cards):
    """Сохраняет ответы для каждой карточки в отдельный файл"""
    os.makedirs(ANSWERS_DIR, exist_ok=True)

    for card in cards:
        filename = os.path.join(ANSWERS_DIR, f"{card['id']}.md")

        md = f"# Ответы к карточке №{card['id']}\n\n"
        for i, t in enumerate(card['tasks'], 1):
            md += f"{i}. {t['answer']}\n"

        with open(filename, 'w', encoding='utf-8') as f:
            f.write(md)


# =========================
# CLI
# =========================

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Генератор карточек (md)')
    parser.add_argument('file')
    parser.add_argument('tasks', type=int)
    parser.add_argument('--cards', type=int, default=20)

    args = parser.parse_args()

    cards = generate_cards(args.file, args.tasks, args.cards)

    write_cards_separate(cards)
    write_answers_separate(cards)

    print(f"✓ Сгенерировано карточек: {len(cards)}")
    print(f"Карточки сохранены в: {CARDS_DIR}/")
    print(f"Ответы сохранены в: {ANSWERS_DIR}/")

