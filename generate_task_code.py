import requests

PB_URL = "http://127.0.0.1:8090"
ADMIN_EMAIL = "oleg.faust@gmail.com"     # ← замени
ADMIN_PASSWORD = "Zasadazxasqw12#"        # ← замени



def admin_login() -> str:
    resp = requests.post(
        f"{PB_URL}/api/collections/_superusers/auth-with-password",
        json={
            "identity": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }
    )
    resp.raise_for_status()
    return resp.json()["token"]


def generate_code(topic_id: str) -> str:
    token = admin_login()
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Получаем тему
    topic_resp = requests.get(
        f"{PB_URL}/api/collections/topics/records/{topic_id}",
        headers=headers
    )
    topic_resp.raise_for_status()
    topic = topic_resp.json()

    ege_number = topic.get("ege_number")
    if ege_number is None:
        raise ValueError("У темы не указан ege_number")

    # 2. Получаем задачи этой темы
    tasks_resp = requests.get(
        f"{PB_URL}/api/collections/tasks/records",
        headers=headers,
        params={
            "filter": f'topic="{topic_id}"',
            "fields": "code",
            "perPage": 200
        }
    )
    tasks_resp.raise_for_status()
    tasks = tasks_resp.json().get("items", [])

    counters = []
    for task in tasks:
        code = task.get("code")
        if not code:
            continue
        try:
            _, num = code.split("-")
            counters.append(int(num))
        except ValueError:
            continue

    next_number = max(counters, default=0) + 1
    return f"{ege_number}-{str(next_number).zfill(3)}"


if __name__ == "__main__":
    topic_id = input("Введите topic_id: ").strip()
    code = generate_code(topic_id)
    print(f"Новый код задачи: {code}")
