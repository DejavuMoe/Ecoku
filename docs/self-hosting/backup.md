# 备份与恢复

SQLite 启用 WAL。运行中可能同时存在：

```text
data/ecoku.sqlite3
data/ecoku.sqlite3-wal
data/ecoku.sqlite3-shm
```

不要在服务运行时只复制主文件。正常停服后确认边车文件已 checkpoint，再复制。

## 一次性冷备份

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

## 定时备份

把下面脚本保存为 `~/Ecoku/scripts/backup-ecoku.sh` 并 `chmod 700`。备份期间服务会短暂不可用。

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

systemd 定时器示例（每天 03:15）：

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

cron：`15 3 * * * /home/ecoku/Ecoku/scripts/backup-ecoku.sh`。

## 恢复

先停止失败版本，保留现场副本，把 Compose 改回旧镜像 tag，再用停服前备份替换主库。若新版本已写入旧程序不认识的 schema，不能只回退镜像。

```bash
set -euo pipefail
sudo docker compose down
sudo cp --preserve=mode,timestamps ./data/ecoku.sqlite3 "./backups/ecoku-failed-$(date +%Y%m%d-%H%M%S).sqlite3"
sudo rm -f ./data/ecoku.sqlite3 ./data/ecoku.sqlite3-wal ./data/ecoku.sqlite3-shm
sudo cp --preserve=mode,timestamps "./backups/ecoku-${backup_stamp}.sqlite3" ./data/ecoku.sqlite3
sudo chown 10001:10001 ./data/ecoku.sqlite3
sudo chmod 600 ./data/ecoku.sqlite3
# 把 compose.yaml 的 image 改回旧精确 tag 后：
sudo docker compose up -d
curl --fail http://127.0.0.1:12123/api/health
```

停服后只读查看库结构：

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

不要手工改 `schema_migrations` 或伪造版本。升级步骤见 [升级流程](/self-hosting/upgrade)。
