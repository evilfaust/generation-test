#!/usr/bin/env bash
# Заводит auth-коллекцию `users` в pb-files + одного пользователя и закрывает
# запись в `materials` под этот логин. Запускать НА малине против loopback-порта.
#
#   PB_URL=http://127.0.0.1:8091 SU_EMAIL=... SU_PASS=... USER_EMAIL=... ./bootstrap-users-auth.sh
#
# Пароль пользователя генерируется и печатается в конце (сменить при желании в админке).
set -euo pipefail

PB_URL="${PB_URL:-http://127.0.0.1:8091}"
SU_EMAIL="${SU_EMAIL:?нужен SU_EMAIL}"
SU_PASS="${SU_PASS:?нужен SU_PASS}"
USER_EMAIL="${USER_EMAIL:?нужен USER_EMAIL}"
USER_PASS="${USER_PASS:-$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-18)}"

echo "[1/4] auth superuser"
TOKEN=$(curl -s "$PB_URL/api/collections/_superusers/auth-with-password" \
  -H 'Content-Type: application/json' \
  -d "{\"identity\":\"$SU_EMAIL\",\"password\":\"$SU_PASS\"}" \
  | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
[ -n "$TOKEN" ] || { echo "auth FAILED"; exit 1; }
echo "    ok"

echo "[2/4] create auth collection users (token 60d)"
curl -s "$PB_URL/api/collections" -H "Authorization: $TOKEN" -H 'Content-Type: application/json' -d @- <<'JSON' \
  | sed -n 's/.*"\(id\|message\)":"\([^"]*\)".*/  \1: \2/p' | head -2
{
  "name": "users",
  "type": "auth",
  "passwordAuth": { "enabled": true, "identityFields": ["email"] },
  "authToken": { "duration": 5184000 },
  "listRule": null,
  "viewRule": "id = @request.auth.id",
  "createRule": null,
  "updateRule": "id = @request.auth.id",
  "deleteRule": null,
  "fields": [
    { "name": "name", "type": "text", "max": 200 }
  ]
}
JSON

echo "[3/4] create user $USER_EMAIL"
curl -s "$PB_URL/api/collections/users/records" -H "Authorization: $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$USER_EMAIL\",\"emailVisibility\":true,\"password\":\"$USER_PASS\",\"passwordConfirm\":\"$USER_PASS\",\"name\":\"Oleg\",\"verified\":true}" \
  | sed -n 's/.*"\(id\|message\)":"\([^"]*\)".*/  \1: \2/p' | head -2

echo "[4/4] lock materials write to users collection"
curl -s -X PATCH "$PB_URL/api/collections/materials" -H "Authorization: $TOKEN" -H 'Content-Type: application/json' \
  -d '{"createRule":"@request.auth.collectionName = \"users\"","updateRule":"@request.auth.collectionName = \"users\"","deleteRule":"@request.auth.collectionName = \"users\""}' \
  | sed -n 's/.*"\(updateRule\|message\)":"\([^"]*\)".*/  \1: \2/p' | head -2

echo
echo "==================================================="
echo " USER LOGIN:  $USER_EMAIL"
echo " USER PASS:   $USER_PASS"
echo "==================================================="
