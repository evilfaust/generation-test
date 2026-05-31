#!/bin/bash
# ============================================================================
# deploy-raspberry.sh — ЕДИНСТВЕННЫЙ скрипт деплоя учительского фронтенда Lemma.
#
# Учительское приложение (Lemma) = статика на Raspberry Pi через Docker-nginx.
#   Боевой URL:   https://l.oipav.ru   (DNS → Pi)
#   Цель rsync:   faust@88.201.208.15:/opt/docker/nginx/html/  (= mount nginx)
#   nginx в Docker раздаёт статику — рестарт НЕ нужен.
#
# ⚠️ НЕ путать домены:
#   - l.oipav.ru        → учительский фронт (этот скрипт, Raspberry Pi)
#   - oipav.ru (apex)   → отдельный Astro-хаб на VPS (к Lemma отношения не имеет)
#   - task-ege.oipav.ru → PocketBase + PDF (backend, VPS, деплоится отдельно)
#   - student.oipav.ru  → ученическое приложение (VPS, ./raspberry/deploy-student-to-vps.sh)
#
# Использование:  ./deploy-raspberry.sh --build   (собрать и задеплоить)
#                 ./deploy-raspberry.sh           (задеплоить готовый dist)
# ============================================================================

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST="$SCRIPT_DIR/ege-tasks/dist"
REMOTE="faust@88.201.208.15"
REMOTE_PATH="/opt/docker/nginx/html/"
SSH_PORT=22222
PUBLIC_URL="https://l.oipav.ru"

echo -e "${BLUE}╔═══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       Деплой Lemma → Raspberry Pi         ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════╝${NC}"

# Флаг --build: собрать перед деплоем
if [ "$1" = "--build" ]; then
  echo -e "${BLUE}→ Сборка...${NC}"
  cd "$SCRIPT_DIR/ege-tasks" && npm run build
  if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Сборка завершилась с ошибкой${NC}"
    exit 1
  fi
  echo ""
fi

# Проверяем наличие dist
if [ ! -d "$DIST" ]; then
  echo -e "${RED}✗ Папка dist не найдена. Запусти: cd ege-tasks && npm run build${NC}"
  exit 1
fi

# Версия
VERSION=$(python3 -c "import json; d=json.load(open('$DIST/version.json')); print(d.get('releaseId','?'))" 2>/dev/null || echo "?")
echo -e "${YELLOW}Версия:${NC} $VERSION"
echo -e "${YELLOW}Цель:${NC}   $REMOTE:$REMOTE_PATH"
echo ""

echo -e "${BLUE}→ Синхронизация...${NC}"
rsync -az --delete --exclude='.DS_Store' \
  -e "ssh -p $SSH_PORT" \
  "$DIST/" "$REMOTE:$REMOTE_PATH"

if [ $? -ne 0 ]; then
  echo -e "${RED}✗ Ошибка rsync${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Готово — nginx раздаёт новую версию${NC}"

# Health-check: версия в проде должна совпасть со свежим билдом
echo ""
echo -e "${BLUE}→ Проверка $PUBLIC_URL ...${NC}"
LIVE=$(curl -fsS -m 15 "$PUBLIC_URL/version.json" 2>/dev/null \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('releaseId','?'))" 2>/dev/null || echo "?")
if [ "$LIVE" = "$VERSION" ]; then
  echo -e "${GREEN}✓ В проде версия $LIVE — совпадает${NC}"
  echo -e "${YELLOW}🌐 $PUBLIC_URL${NC}"
else
  echo -e "${YELLOW}⚠ В проде версия '$LIVE', ожидалась '$VERSION' (мог кэшировать CDN/браузер)${NC}"
fi
