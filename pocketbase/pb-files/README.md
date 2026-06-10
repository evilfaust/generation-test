# pb-files — файловое хранилище учителя (второй PocketBase на малине)

Отдельный экземпляр PocketBase для «Библиотеки материалов» (учительское фло):
учебники, методички, сгенерированные в Лемме PDF. Живёт на **Raspberry Pi**
(не на VPS — чтобы занять свободное место малины и не нагружать боевой PB).

- **URL:** https://files.l.oipav.ru  · **Admin:** https://files.l.oipav.ru/_/
- **Хост:** малина `ssh -p 22222 faust@88.201.208.15`
- **Контейнер:** `pb-files` (alpine:3 + статич. бинарь PocketBase 0.36.4 arm64),
  сеть `docker_default`, `--restart unless-stopped`.
  - бинарь: `/opt/docker/pb-files/pocketbase`
  - данные: `/opt/docker/pb-files/pb_data` (= `data.db` + `storage/`, на SD)
  - порты: внутри `8090` (nginx проксирует по имени `pb-files:8090`),
    на хосте `127.0.0.1:8091→8090` (loopback — для admin/bootstrap)
- **nginx:** `/opt/docker/nginx/etc/files.conf` (proxy на `pb-files:8090`,
  `client_max_body_size 200m`). TLS Let's Encrypt, авто-renew недельным cron.

## Запуск контейнера (с нуля / после переустановки)

```bash
sudo mkdir -p /opt/docker/pb-files/pb_data
cd /opt/docker/pb-files
sudo curl -sL -o pb.zip https://github.com/pocketbase/pocketbase/releases/download/v0.36.4/pocketbase_0.36.4_linux_arm64.zip
sudo unzip -o pb.zip pocketbase && sudo rm pb.zip && sudo chmod +x pocketbase
sudo docker run -d --name pb-files --restart unless-stopped \
  --network docker_default -p 127.0.0.1:8091:8090 \
  -v /opt/docker/pb-files/pb_data:/pb_data \
  -v /opt/docker/pb-files/pocketbase:/usr/local/bin/pocketbase:ro \
  alpine:3 pocketbase serve --http=0.0.0.0:8090 --dir=/pb_data
# суперюзер:
sudo docker exec pb-files pocketbase superuser upsert <EMAIL> <PASS> --dir /pb_data
```

## Коллекции (bootstrap)

Схема хранится в `data.db` (на смонтированном volume), скрипты — для
воспроизводимости/DR. Запускать НА малине против `127.0.0.1:8091`:

```bash
PB_URL=http://127.0.0.1:8091 SU_EMAIL=<админ> SU_PASS=<пароль> ./bootstrap-materials.sh
PB_URL=http://127.0.0.1:8091 SU_EMAIL=<админ> SU_PASS=<пароль> USER_EMAIL=<email> ./bootstrap-users-auth.sh
PB_URL=http://127.0.0.1:8091 SU_EMAIL=<админ> SU_PASS=<пароль> ./bootstrap-folders.sh   # папки (v3.9.72)
```

- **`materials`** (base) — файлы: `title, file (≤500MB), original_name, category
  (textbook|worksheet|generated|methodical|reference|other), subject, tags, size,
  mime, lesson_ids, note_ids, description, folder→folders (опц.)`. Read публичный,
  write — логин `users`.
- **`folders`** (base, v3.9.72, `bootstrap-folders.sh`) — иерархия папок Библиотеки:
  `name, parent→folders (self-relation, опц.)`. Явный id коллекции `pbcfilesfolders`.
  Read публичный, write — логин `users`. Удаление папки: PB вычищает ссылки →
  подпапки и файлы оказываются в корне. Фронт работает и БЕЗ этой коллекции
  (listFolders → 404 → null → UI прячет папки).
- **`users`** (auth) — логин фронта (identity=email, токен 60 дней). Запись в
  `materials` закрыта под него. Управление юзерами — только суперюзер.

## Бэкап (Фаза 4 — TODO)

`/opt/docker/pb-files/pb_data` (data.db + storage) на SD **без копии**.
Нужен cron → S3 `tws3:math-lemma/...`, зеркало боевого `/opt/pocketbase/backup.sh`.

## Фронт

Клиент `ege-tasks/src/shared/services/pb/filesClient.js` (`pbFiles`, env
`VITE_PB_FILES_URL`). Раздел «Библиотека» — `components/workspace/MaterialsLibrary.jsx`.
Прикрепление к урокам/заметкам — `MaterialPickerModal.jsx` (пишет в
`lessons.materials` / `teacher_notes.links` как `{type:'material', id, title, url}`).
