# Backup and restore

SQLite runs with WAL. While the service is up you may see:

```text
data/ecoku.sqlite3
data/ecoku.sqlite3-wal
data/ecoku.sqlite3-shm
```

Do not copy only the main file from a running instance. Stop cleanly, confirm sidecars are checkpointed, then copy.

## One-shot cold backup

```bash
set -euo pipefail
sudo docker compose down
sudo test ! -e ./data/ecoku.sqlite3-wal
sudo test ! -e ./data/ecoku.sqlite3-shm

umask 077
mkdir -p ./backups
backup_stamp="$(date +%Y%m%d-%H%M%S)"
sudo cp --reflink=auto --preserve=mode,timestamps \
  ./data/ecoku.sqlite3 "./backups/ecoku-${backup_stamp}.sqlite3"
sudo chown "$USER":"$USER" "./backups/ecoku-${backup_stamp}.sqlite3"
chmod 600 "./backups/ecoku-${backup_stamp}.sqlite3"
sha256sum "./backups/ecoku-${backup_stamp}.sqlite3" \
  > "./backups/ecoku-${backup_stamp}.sqlite3.sha256"
sudo cp --preserve=mode,timestamps ./compose.yaml "./backups/compose-${backup_stamp}.yaml"
sudo cp --preserve=mode,timestamps ./app/config.yaml "./backups/config-${backup_stamp}.yaml"
sudo cp --preserve=mode,timestamps ./ecoku.env "./backups/ecoku-${backup_stamp}.env"
```

## Scheduled backup

Save as `~/Ecoku/scripts/backup-ecoku.sh` and `chmod 700`. The service is briefly down.

```bash
#!/usr/bin/env bash
set -euo pipefail
cd ~/Ecoku
umask 077
mkdir -p ./backups
backup_stamp="$(date +%Y%m%d-%H%M%S)"
sudo docker compose down
sudo test ! -e ./data/ecoku.sqlite3-wal
sudo test ! -e ./data/ecoku.sqlite3-shm
sudo cp --reflink=auto --preserve=mode,timestamps \
  ./data/ecoku.sqlite3 "./backups/ecoku-${backup_stamp}.sqlite3"
sudo chown "$USER":"$USER" "./backups/ecoku-${backup_stamp}.sqlite3"
chmod 600 "./backups/ecoku-${backup_stamp}.sqlite3"
sha256sum "./backups/ecoku-${backup_stamp}.sqlite3" \
  > "./backups/ecoku-${backup_stamp}.sqlite3.sha256"
sudo cp --preserve=mode,timestamps ./compose.yaml "./backups/compose-${backup_stamp}.yaml"
sudo cp --preserve=mode,timestamps ./app/config.yaml "./backups/config-${backup_stamp}.yaml"
sudo cp --preserve=mode,timestamps ./ecoku.env "./backups/ecoku-${backup_stamp}.env"
ls -1t ./backups/ecoku-*.sqlite3 2>/dev/null | tail -n +31 | xargs -r rm -f
ls -1t ./backups/ecoku-*.sqlite3.sha256 2>/dev/null | tail -n +31 | xargs -r rm -f
sudo docker compose up -d
```

systemd timer (03:15 daily):

```ini
# /etc/systemd/system/ecoku-backup.service
[Unit]
Description=Ecoku cold backup
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
User=ecoku
WorkingDirectory=/home/ecoku/Ecoku
ExecStart=/home/ecoku/Ecoku/scripts/backup-ecoku.sh
```

```ini
# /etc/systemd/system/ecoku-backup.timer
[Unit]
Description=Daily Ecoku cold backup

[Timer]
OnCalendar=*-*-* 03:15:00
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ecoku-backup.timer
```

cron: `15 3 * * * /home/ecoku/Ecoku/scripts/backup-ecoku.sh`.

## Restore

Stop the failed version, keep a copy of the broken file, restore the pre-upgrade backup, pin the old image tag. If the new version already wrote a schema the old binary does not know, do not roll back the image alone.

```bash
set -euo pipefail
sudo docker compose down
sudo cp --preserve=mode,timestamps ./data/ecoku.sqlite3 "./backups/ecoku-failed-$(date +%Y%m%d-%H%M%S).sqlite3"
sudo rm -f ./data/ecoku.sqlite3 ./data/ecoku.sqlite3-wal ./data/ecoku.sqlite3-shm
sudo cp --preserve=mode,timestamps "./backups/ecoku-${backup_stamp}.sqlite3" ./data/ecoku.sqlite3
sudo chown 10001:10001 ./data/ecoku.sqlite3
sudo chmod 600 ./data/ecoku.sqlite3
# set compose.yaml image back to the old exact tag, then:
sudo docker compose up -d
curl --fail http://127.0.0.1:12123/api/health
```

Read-only inspect after stop:

```bash
python3 - <<'PY'
import sqlite3
db = sqlite3.connect("./data/ecoku.sqlite3")
print("migrations:")
for row in db.execute("SELECT version, name FROM schema_migrations ORDER BY version"):
    print(row)
print("comments columns:")
for row in db.execute("PRAGMA table_info(comments)"):
    print(row)
PY
```

Do not edit `schema_migrations` by hand. Upgrades: [Upgrade procedure](/en/self-hosting/upgrade).
