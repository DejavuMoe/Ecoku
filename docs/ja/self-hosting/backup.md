# バックアップと復元

SQLite は WAL。稼働中は次が同時に存在し得ます。

```text
data/ecoku.sqlite3
data/ecoku.sqlite3-wal
data/ecoku.sqlite3-shm
```

稼働中に本体だけコピーしないでください。正常停止後、サイドカーが checkpoint されたことを確認してからコピーします。

## 単発のコールドバックアップ

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

## 定期バックアップ

`~/Ecoku/scripts/backup-ecoku.sh` に保存し `chmod 700`。バックアップ中は短時間停止します。

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

systemd（毎日 03:15）：

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

cron: `15 3 * * * /home/ecoku/Ecoku/scripts/backup-ecoku.sh`。

## 復元

失敗版を止め、現場コピーを残し、アップグレード前バックアップで本体を置き換え、古い正確なタグに戻します。新しい schema を書いた DB を古いイメージだけで戻さないでください。

```bash
set -euo pipefail
sudo docker compose down
sudo cp --preserve=mode,timestamps ./data/ecoku.sqlite3 "./backups/ecoku-failed-$(date +%Y%m%d-%H%M%S).sqlite3"
sudo rm -f ./data/ecoku.sqlite3 ./data/ecoku.sqlite3-wal ./data/ecoku.sqlite3-shm
sudo cp --preserve=mode,timestamps "./backups/ecoku-${backup_stamp}.sqlite3" ./data/ecoku.sqlite3
sudo chown 10001:10001 ./data/ecoku.sqlite3
sudo chmod 600 ./data/ecoku.sqlite3
sudo docker compose up -d
curl --fail http://127.0.0.1:12123/api/health
```

`schema_migrations` を手で書き換えないでください。手順は [アップグレード](/ja/self-hosting/upgrade)。
