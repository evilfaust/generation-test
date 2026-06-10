#!/usr/bin/env bash
# Папки Библиотеки материалов: коллекция `folders` (иерархия через parent) +
# relation-поле `materials.folder`. Запускать НА малине против loopback pb-files:
#
#   PB_URL=http://127.0.0.1:8091 SU_EMAIL=... SU_PASS=... ./bootstrap-folders.sh
#
# Идемпотентность: существующая коллекция/поле — скрипт сообщит и продолжит.
set -euo pipefail

PB_URL="${PB_URL:-http://127.0.0.1:8091}"
SU_EMAIL="${SU_EMAIL:?нужен SU_EMAIL}"
SU_PASS="${SU_PASS:?нужен SU_PASS}"

echo "[1/4] auth superuser @ $PB_URL"
TOKEN=$(curl -s "$PB_URL/api/collections/_superusers/auth-with-password" \
  -H 'Content-Type: application/json' \
  -d "{\"identity\":\"$SU_EMAIL\",\"password\":\"$SU_PASS\"}" \
  | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
[ -n "$TOKEN" ] || { echo "auth FAILED"; exit 1; }
echo "    ok"

# Явный id коллекции — чтобы self-relation parent можно было добавить вторым шагом
# и чтобы materials.folder ссылался на стабильный id.
FOLDERS_ID="pbcfilesfolders"

echo "[2/4] create collection folders (без parent)"
curl -s "$PB_URL/api/collections" \
  -H "Authorization: $TOKEN" -H 'Content-Type: application/json' \
  -d @- <<JSON | sed -n 's/.*"\(id\|message\)":"\([^"]*\)".*/  \1: \2/p' | head -2
{
  "id": "$FOLDERS_ID",
  "name": "folders",
  "type": "base",
  "listRule": "",
  "viewRule": "",
  "createRule": "@request.auth.id != \\"\\"",
  "updateRule": "@request.auth.id != \\"\\"",
  "deleteRule": "@request.auth.id != \\"\\"",
  "fields": [
    { "name": "id", "type": "text", "system": true, "primaryKey": true, "required": true, "min": 15, "max": 15, "pattern": "^[a-z0-9]+$", "autogeneratePattern": "[a-z0-9]{15}" },
    { "name": "name", "type": "text", "required": true, "max": 200 },
    { "name": "created", "type": "autodate", "onCreate": true, "onUpdate": false },
    { "name": "updated", "type": "autodate", "onCreate": true, "onUpdate": true }
  ]
}
JSON

# PATCH коллекции в PB заменяет fields ЦЕЛИКОМ → читаем текущие поля и дополняем.
add_field() {
  local coll="$1" field_json="$2" field_name="$3"
  local cur
  cur=$(curl -s "$PB_URL/api/collections/$coll" -H "Authorization: $TOKEN")
  if echo "$cur" | grep -q "\"name\":\"$field_name\""; then
    echo "    $coll.$field_name уже есть — пропуск"
    return 0
  fi
  echo "$cur" | python3 -c "
import json, sys
c = json.load(sys.stdin)
c['fields'].append(json.loads('''$field_json'''))
print(json.dumps({'fields': c['fields']}))
" | curl -s -X PATCH "$PB_URL/api/collections/$coll" \
      -H "Authorization: $TOKEN" -H 'Content-Type: application/json' -d @- \
      | sed -n 's/.*"\(message\)":"\([^"]*\)".*/  \1: \2/p' | head -1
  echo "    $coll.$field_name ok"
}

echo "[3/4] add folders.parent (self-relation)"
add_field "folders" "{\"name\": \"parent\", \"type\": \"relation\", \"collectionId\": \"$FOLDERS_ID\", \"maxSelect\": 1, \"minSelect\": 0, \"cascadeDelete\": false}" "parent"

echo "[4/4] add materials.folder"
add_field "materials" "{\"name\": \"folder\", \"type\": \"relation\", \"collectionId\": \"$FOLDERS_ID\", \"maxSelect\": 1, \"minSelect\": 0, \"cascadeDelete\": false}" "folder"

echo
echo "done."
