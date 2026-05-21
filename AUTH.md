# Система авторизации (v3.9.29+)

Документ описывает архитектуру авторизации учителей в Lemma.
Кратко — в корневом `CLAUDE.md` → раздел `Authorization`.

## Архитектура

### Роли

| Роль | Что может |
|------|-----------|
| **superadmin** | Всё. Управление пользователями, журнал действий, все секции автоматически. |
| **editor** | Создавать/редактировать/удалять контент в доступных секциях. |
| **viewer** | Просматривать, использовать генераторы, печатать, экспортировать в PDF. Не может создавать/удалять. |

### Секции (`ALL_SECTIONS`)

Определены в `ege-tasks/src/contexts/AuthContext.jsx`:

| Ключ | Что входит |
|------|-----------|
| `tasks` | Все задачи + Аналитика |
| `worksheets` | Рабочие листы (генератор, ЕГЭ, контрольные, тесты A/B/C/D) |
| `gamification` | QR, пиксель-арт, шифровки, маршруты, марафон, кроссворд |
| `works` | Мои работы + Редактор работ |
| `students` | Прогресс, тепловая карта, достижения |
| `geometry` | Геометрия (задачи, темы) |
| `tdf` | ТДФ + карточки + формулы |
| `trig` | Тригонометрические генераторы |
| `arith` | Устный счёт |
| `theory` | Теория |
| `lab` | Лаборатория (Excalidraw) |
| `import` | Импорт задач (только editor+) |
| `admin` | Управление пользователями (только superadmin) |

Если у editor/viewer нет ключа секции в `allowed_sections` — соответствующие пункты меню скрыты. superadmin видит всё автоматически.

### Уровни защиты

```
┌─────────────────────────────────────────────────────────┐
│ Уровень 1: ProtectedRoute (App.jsx)                     │
│  • Не залогинен → /login                                │
│  • requireSuperAdmin → /app/tasks если не superadmin    │
│  • requireEdit → /app/tasks если viewer                 │
│  • requireSection → /app/tasks если нет секции          │
├─────────────────────────────────────────────────────────┤
│ Уровень 2: Фильтрация меню (AppLayout)                  │
│  • section: '...' → скрыто если !hasSection(...)        │
│  • editOnly: true → скрыто если !canEdit                │
│  • Группа без видимых детей → группа скрыта             │
├─────────────────────────────────────────────────────────┤
│ Уровень 3: Скрытие кнопок (компоненты)                  │
│  • {canEdit && <Button>...} вокруг create/edit          │
│  • {canDelete && <Button danger>...} вокруг delete      │
├─────────────────────────────────────────────────────────┤
│ Уровень 4: PocketBase rules                             │
│  • teachers/audit_log — защищены rule'ами               │
│  • Остальные коллекции — публичные (UI-only защита)     │
└─────────────────────────────────────────────────────────┘
```

**ВАЖНО:** защита уровня 4 для бизнес-коллекций (tasks, works, etc.) НЕ настроена — это договорённость для приватной платформы. Если в будущем платформа станет публичной — обновить правила.

## Коллекции PocketBase

### `teachers` (auth)

```
{
  id, username (unique, login identity), password (min 8),
  email (system, не используется), name,
  role: "superadmin" | "editor" | "viewer",
  allowed_sections: json[],
  created, updated
}
```

**Rules:**
- listRule: `@request.auth.collectionName = "teachers" && @request.auth.role = "superadmin"`
- viewRule: `... && (id = @request.auth.id || @request.auth.role = "superadmin")`
- createRule: только superadmin
- updateRule: superadmin или сам учитель
- deleteRule: только superadmin

Самостоятельная регистрация невозможна (createRule требует superadmin).

### `audit_log` (base)

```
{
  id, teacher_id (text), teacher_name (text),
  action: "create" | "update" | "delete",
  collection_name (text), record_id (text),
  record_summary (text, max 500),
  created
}
```

**Rules:**
- list/view: только superadmin
- create: любой залогиненный учитель
- update/delete: запрещены (иммутабельный лог)

**Зачем `teacher_id` как text, не relation:** при удалении учителя лог его действий сохраняется.

## Frontend: основные точки

| Файл | Назначение |
|------|-----------|
| `src/contexts/AuthContext.jsx` | Provider + `useAuth()` |
| `src/components/auth/LoginPage.jsx` | Форма входа |
| `src/components/auth/ProtectedRoute.jsx` | Защита маршрутов |
| `src/components/auth/UserMenu.jsx` | Блок пользователя в шапке |
| `src/components/auth/UserManager.jsx` | CRUD учителей |
| `src/components/auth/AuditLogPage.jsx` | Журнал действий |
| `src/components/auth/CanEdit.jsx` | `<CanEdit>` / `<CanDelete>` / `<SuperAdminOnly>` |
| `src/shared/services/pocketbase.js` | `_logAudit()`, `getAuditLog`, `createTeacher`, etc. |

## Operational

### Первый superadmin

Создан внутри миграции `1779000000_create_teachers.js`:
- username: `evilfaust`
- password: `Zxasqw12#` (поменять после первого логина!)

### Сбросить пароль учителя (если потерян)

```bash
# Через PocketBase Admin Panel:
# https://task-ege.oipav.ru/_/  → коллекция teachers → выбрать → сбросить пароль

# Или через CLI:
ssh root@147.45.158.148
cd /opt/pocketbase
./pocketbase --dir pb_data superuser upsert <admin-email> <admin-password>
# Затем через Admin Panel.
```

### Сделать существующего учителя superadmin

```bash
ssh root@147.45.158.148 "sqlite3 /opt/pocketbase/pb_data/data.db \"UPDATE teachers SET role='superadmin' WHERE username='X'\""
systemctl restart pocketbase-ege  # на всякий случай
```

### Очистка audit_log (если разрастётся)

```sql
-- Удалить записи старше 90 дней
DELETE FROM audit_log WHERE created < datetime('now', '-90 days');
```

Можно поставить cron на VPS, но пока объёмы небольшие — не обязательно.

### Откат всей системы авторизации

```bash
# 1. Backend (миграции вниз)
ssh root@147.45.158.148
cd /opt/pocketbase
systemctl stop pocketbase-ege
# PocketBase auto-applied; чтобы откатить — удалить файлы миграций и восстановить БД
rm pb_migrations/1779000000_create_teachers.js
rm pb_migrations/1779000001_create_audit_log.js
# Восстановить БД из бэкапа:
tar -xzf backups/backup_2026-05-21_19-40-45.tar.gz -C pb_data/
systemctl start pocketbase-ege

# 2. Frontend
cd /Users/evilfaust/Documents/APP/generation-test
git reset --hard 9893b56  # коммит до внедрения auth
cd ege-tasks && npm run build
# rsync на Raspberry Pi
```

Локальный бэкап БД до миграции: `backups/vps/pre-auth-backup_2026-05-21_19-40-45.tar.gz`.

## Правила для будущих фич

См. `CLAUDE.md` → раздел `Authorization` → пункты 1-5.

Кратко:
1. Новый пункт меню → обязательно `section`, при необходимости `editOnly: true`
2. Новый редактор → роут под `<ProtectedRoute requireEdit />`
3. Новый мутирующий API-метод → `_logAudit('action', 'collection', id, summary)` после успеха
4. Новая кнопка create/edit/delete → `{canEdit && ...}` или `<CanEdit>`
5. Новая секция → добавить в `ALL_SECTIONS` (AuthContext) + `SECTION_LABELS` (UserManager)
