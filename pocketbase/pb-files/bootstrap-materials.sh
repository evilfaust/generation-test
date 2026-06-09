#!/usr/bin/env bash
# Bootstrap коллекции `materials` во втором PocketBase (pb-files) на малине.
# Запускать НА малине против локального loopback-порта pb-files.
#
#   PB_URL=http://127.0.0.1:8091 SU_EMAIL=... SU_PASS=... ./bootstrap-materials.sh
#
# Идемпотентность: если коллекция уже есть — PB вернёт 400, скрипт это переживёт.
set -euo pipefail

PB_URL="${PB_URL:-http://127.0.0.1:8091}"
SU_EMAIL="${SU_EMAIL:?нужен SU_EMAIL}"
SU_PASS="${SU_PASS:?нужен SU_PASS}"

echo "[1/2] auth superuser @ $PB_URL"
TOKEN=$(curl -s "$PB_URL/api/collections/_superusers/auth-with-password" \
  -H 'Content-Type: application/json' \
  -d "{\"identity\":\"$SU_EMAIL\",\"password\":\"$SU_PASS\"}" \
  | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
[ -n "$TOKEN" ] || { echo "auth FAILED"; exit 1; }
echo "    ok"

echo "[2/2] create collection materials"
curl -s "$PB_URL/api/collections" \
  -H "Authorization: $TOKEN" \
  -H 'Content-Type: application/json' \
  -d @- <<'JSON' | sed -n 's/.*"\(id\|message\)":"\([^"]*\)".*/  \1: \2/p' | head -3
{
  "name": "materials",
  "type": "base",
  "listRule": "",
  "viewRule": "",
  "createRule": "@request.auth.id != \"\"",
  "updateRule": "@request.auth.id != \"\"",
  "deleteRule": "@request.auth.id != \"\"",
  "fields": [
    { "name": "id", "type": "text", "system": true, "primaryKey": true, "required": true, "min": 15, "max": 15, "pattern": "^[a-z0-9]+$", "autogeneratePattern": "[a-z0-9]{15}" },
    { "name": "title", "type": "text", "required": true, "max": 500 },
    { "name": "file", "type": "file", "required": false, "maxSelect": 1, "maxSize": 524288000 },
    { "name": "original_name", "type": "text", "max": 500 },
    { "name": "category", "type": "select", "maxSelect": 1, "values": ["textbook","worksheet","generated","methodical","reference","other"] },
    { "name": "subject", "type": "text", "max": 200 },
    { "name": "tags", "type": "json", "maxSize": 50000 },
    { "name": "size", "type": "number" },
    { "name": "mime", "type": "text", "max": 200 },
    { "name": "lesson_ids", "type": "json", "maxSize": 50000 },
    { "name": "note_ids", "type": "json", "maxSize": 50000 },
    { "name": "description", "type": "text", "max": 5000 },
    { "name": "created", "type": "autodate", "onCreate": true, "onUpdate": false },
    { "name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true }
  ],
  "indexes": [
    "CREATE INDEX idx_materials_category ON materials (category)",
    "CREATE INDEX idx_materials_created ON materials (created)"
  ]
}
JSON
echo
echo "done."
