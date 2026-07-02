# Lemma — платформа для учителя математики

[![Version](https://img.shields.io/badge/version-3.9.116-blue.svg)](./CHANGELOG.md)
[![Stack](https://img.shields.io/badge/stack-React%2018%20%2B%20PocketBase-green.svg)]()
[![Tests](https://img.shields.io/badge/tests-418%20passing-brightgreen.svg)]()

**Lemma** — веб-платформа для учителей математики: база задач, генераторы вариантов работ, тригонометрические и арифметические тренажёры, онлайн-тесты для учеников, аналитика результатов, модуль геометрии с GeoGebra и теоретический модуль ТДФ.

> **Production:** [lemma.oipav.ru](https://lemma.oipav.ru) — лендинг · [task-ege.oipav.ru](https://task-ege.oipav.ru) — backend (PocketBase)

---

## Что внутри

### Три интерфейса в одном репозитории

| Интерфейс | URL (production) | Что делает |
|-----------|------------------|-----------|
| **Учительский** | `task-ege.oipav.ru` (закрытый) | Управление задачами, генераторы, выдача тестов, аналитика |
| **Ученический** | `student.oipav.ru/student/{sessionId}` | Прохождение тестов, личный кабинет, достижения |
| **Лендинг** | `lemma.oipav.ru` | Промо-страница |

### Ключевые возможности

**База задач:**
- Каталог с фильтрами (темы / подтемы / теги / сложность / источник / год / изображения)
- LaTeX (KaTeX) + Markdown, GeoGebra-чертежи, импорт из MD/YAML/sdamgia.ru
- Уникальные коды задач, массовые операции, поиск дублей и слияние

**Генераторы рабочих листов:**
- Универсальный генератор листов и карточек (A4/A5/A6, варианты, дистракторы)
- Полные варианты ЕГЭ (база/профиль) с пагинацией в КИМ-стиле
- Контрольные работы с раздачей и автопроверкой
- Тесты A/B/C/D с перемешиванием

**Тригонометрия (11 генераторов):** единичная окружность, значения функций, выражения, обратные функции, уравнения, формулы приведения/сложения, двойной аргумент, шифровки и др.

**Устный счёт (7 генераторов):** арифметика, степени и логарифмы, корни, действия с десятичными и обыкновенными дробями.

**Геймификация:** QR-листы, пиксель-арт (одиночный и командный), шифровки, маршрутные листы, марафон защиты задач с live-доской, кроссворды.

**Геометрия:** база задач с GeoGebra-чертежами (живой апплет + PNG/SVG-экспорт), компоновка листов S/M/L/XL, печать с физическими mm/pt.

**ТДФ (Теоремы, Определения, Формулы):** структурированные конспекты по классам, опросники, КИМ-стиль печати с двухфазной пагинацией.

**Ученики:** прогресс, тепловая карта ошибок, достижения (random + conditional), маршрутные листы, личный кабинет ученика с историей попыток.

**Авторизация (v3.9.29+):** роли `superadmin` / `editor` / `viewer`, доступ по секциям, журнал действий. См. [AUTH.md](./AUTH.md).

---

## Tech Stack

**Frontend** (`ege-tasks/`):
- React 18.2 + Vite 5.0
- Ant Design 5.12
- KaTeX + react-markdown (GFM)
- Monaco Editor (lazy)
- React Router v7
- PocketBase SDK 0.21
- GeoGebra applet API + JSXGraph (SVG export)
- Печать/PDF на клиенте: `window.print()` + `@media print`, html2pdf.js (серверный Puppeteer выпилен в июне 2026)
- Vitest (418 тестов)

**Backend** (`pocketbase/`):
- PocketBase 0.36.4 (SQLite, REST API, Auth, File storage)
- PDF Service на Node.js + Puppeteer + Chromium (порт 3001)
- Telegram-бот мониторинга VPS

**Infrastructure:**
- VPS: PocketBase + PDF service + nginx + cron-бэкапы
- Raspberry Pi (или CDN): статический фронтенд через nginx в Docker
- GitHub Actions: автодеплой лендинга

---

## Быстрый старт

```bash
# 1. Установка зависимостей
git clone https://github.com/evilfaust/lemma.git
cd lemma
cd ege-tasks && npm install && cd ..

# 2. Backend — PocketBase на production
# По умолчанию приложение смотрит на task-ege.oipav.ru.
# Для локального бэкенда измените PB_BASE_URL в ege-tasks/src/shared/services/pocketbaseUrl.js

# 3. Dev-сервер фронтенда
cd ege-tasks
npm run dev
# → http://localhost:5173
```

### Полезные команды

```bash
# Только фронтенд (backend на VPS)
./start.sh

# С локальным PDF-сервисом
./start.sh --local-pdf

# Полностью офлайн (+ локальный PocketBase, требует ./pocketbase бинарника)
./start.sh --full

# Сборка production (3 приложения: index.html + student.html + landing.html)
cd ege-tasks && npm run build

# Тесты (Vitest, ~4 сек)
cd ege-tasks && npm test
cd ege-tasks && npm run test:watch
```

---

## Структура проекта

```
lemma/
├── ege-tasks/                      # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/             # ~80+ компонентов
│   │   │   ├── auth/               # AuthContext UI: LoginPage, UserManager, AuditLog, …
│   │   │   ├── catalog/            # Управление справочниками (темы, теги, источники)
│   │   │   ├── geometry/           # Модуль геометрии (редактор, чертежи)
│   │   │   ├── tdf/                # Теоремы, определения, формулы
│   │   │   ├── theory/             # Теория (Markdown + GeoGebra)
│   │   │   ├── student/            # Ученический интерфейс
│   │   │   ├── trig/               # Тригонометрические подкомпоненты
│   │   │   ├── worksheet/          # Переиспользуемые элементы листов
│   │   │   └── mc-test/            # Тесты A/B/C/D
│   │   ├── contexts/               # ReferenceDataContext, AuthContext
│   │   ├── hooks/                  # ~25 custom хуков
│   │   ├── shared/services/        # PocketBase API (133+ методов)
│   │   ├── utils/                  # Helpers (LaTeX, shuffle, QR, normalize, …)
│   │   ├── landing/                # Автономный лендинг (без Ant Design)
│   │   ├── App.jsx                 # Teacher routes
│   │   └── StudentApp.jsx          # Student routes
│   ├── public/                     # Static assets (ачивки, логотипы)
│   └── __tests__/                  # 418 тестов (Vitest)
│
├── pocketbase/                     # Backend (deployed to VPS)
│   ├── pb_migrations/              # SQL миграции (~40 шт.)
│   ├── pb_hooks/                   # JS-хуки PocketBase (статистика, PDF)
│   └── pdf-service.js              # Puppeteer-сервис генерации PDF
│
├── .github/workflows/              # CI: автодеплой лендинга
│
├── README.md                       # ← вы здесь
├── CHANGELOG.md                    # История релизов
└── AUTH.md                         # Архитектура системы авторизации
```

---

## Деплой

**Backend (VPS, разово):**
1. PocketBase на порту 8095 как systemd-сервис (`pocketbase-ege`)
2. PDF-сервис на порту 3001 (`pdf-service-ege`)
3. nginx проксирует `task-ege.oipav.ru` → PocketBase (API + Admin) + PDF
4. cron каждые 6h создаёт бэкапы БД, max 20 шт.
5. Миграции из `pocketbase/pb_migrations/` применяются автоматически при рестарте

**Frontend (по push в `main`):**
- Лендинг (`lemma.oipav.ru`) — автоматически через GitHub Actions
- Учительский + ученический (`student.oipav.ru`) — через rsync (см. `deploy-raspberry.sh`)

---

## Авторизация

С v3.9.29 учительский интерфейс требует логина. Подробно — в [AUTH.md](./AUTH.md).

| Роль | Что может |
|------|-----------|
| `superadmin` | Всё + управление пользователями + журнал действий |
| `editor` | CRUD задач/работ/тестов в разрешённых секциях |
| `viewer` | Просмотр, генерация, печать, экспорт PDF — без изменений |

Регистрация отключена — пользователей создаёт суперадмин через `/app/admin/users`.

---

## История изменений

См. [CHANGELOG.md](./CHANGELOG.md). Последняя версия — **3.9.116** (2026-07-02).

---

## Лицензия

Приватный проект. Все права защищены.
