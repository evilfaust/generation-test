#!/usr/bin/env bash
#
# deploy-landing.sh — РУЧНОЙ деплой лендинга (lemma.oipav.ru) на VPS.
#
# Зачем отдельный скрипт: авто-деплой лендинга через GitHub Actions при push
# в main отключён (лендинг меняется редко). Этот скрипт собирает лендинг
# локально на Mac и заливает его на VPS по SSH.
#
# ┌─ Что делает ────────────────────────────────────────────────────────────┐
# │ 1. Собирает лёгкую сборку лендинга (vite.config.landing.js — без antd/   │
# │    Monaco/teacher/student), результат → ege-tasks/dist/                   │
# │ 2. Копирует landing.html → index.html (как делает GitHub Action)          │
# │ 3. rsync --delete dist/ → root@VPS:/var/www/landings/lemma/               │
# │ 4. Health-check: дёргает https://lemma.oipav.ru/ (ждёт HTTP 200)          │
# └───────────────────────────────────────────────────────────────────────────┘
#
# Запуск (из корня репозитория):
#     ./deploy-landing.sh
#
# Требования: ssh-доступ root@147.45.158.148 (тот же, что для бэкапов БД),
#             установленный rsync (есть в macOS из коробки).
#
# Откатить: лендинг статичен; залить предыдущую версию = git checkout нужного
#           коммита лендинга + повторный запуск скрипта.

set -euo pipefail

# ── Конфиг ──────────────────────────────────────────────────────────────────
VPS_HOST="${LANDING_VPS_HOST:-root@147.45.158.148}"
VPS_PATH="${LANDING_VPS_PATH:-/var/www/landings/lemma/}"
HEALTH_URL="${LANDING_HEALTH_URL:-https://lemma.oipav.ru/}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FE_DIR="$SCRIPT_DIR/ege-tasks"
DIST_DIR="$FE_DIR/dist"

cyan() { printf "\033[36m%s\033[0m\n" "$1"; }
green() { printf "\033[32m%s\033[0m\n" "$1"; }
red() { printf "\033[31m%s\033[0m\n" "$1"; }

# ── [1/4] Сборка ──────────────────────────────────────────────────────────────
cyan "[1/4] Сборка лендинга (vite.config.landing.js)…"
cd "$FE_DIR"
npx vite build --config vite.config.landing.js

if [[ ! -f "$DIST_DIR/landing.html" ]]; then
  red "✗ Не найден $DIST_DIR/landing.html — сборка не дала лендинг. Прерываю."
  exit 1
fi

# ── [2/4] landing.html → index.html ────────────────────────────────────────────
cyan "[2/4] Копирую landing.html → index.html…"
cp "$DIST_DIR/landing.html" "$DIST_DIR/index.html"

# ── [3/4] Заливка на VPS ────────────────────────────────────────────────────────
cyan "[3/4] rsync → $VPS_HOST:$VPS_PATH …"
rsync -avzr --delete "$DIST_DIR/" "$VPS_HOST:$VPS_PATH"

# ── [4/4] Health-check ──────────────────────────────────────────────────────────
cyan "[4/4] Health-check $HEALTH_URL …"
code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$HEALTH_URL" || echo "000")"
if [[ "$code" == "200" ]]; then
  green "✓ Лендинг задеплоен. $HEALTH_URL → HTTP $code"
else
  red "⚠ Залито, но health-check вернул HTTP $code (ожидался 200). Проверь вручную: $HEALTH_URL"
  exit 1
fi
