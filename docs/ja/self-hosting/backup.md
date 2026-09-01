# バックアップと復元

Ecoku のデータはすべて単一の SQLite データベースファイルに保存されます。

---

## 1. コールドバックアップ（推奨）

```bash
cd ~/Ecoku
sudo docker compose down
tar -czvf "ecoku-backup-$(date +%Y%m%d_%H%M%S).tar.gz" data/ app/config.yaml ecoku.env compose.yaml
sudo docker compose up -d
```

---

## 2. オンラインバックアップ (`VACUUM INTO`)

```bash
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
sudo docker compose exec ecoku sqlite3 /data/ecoku.sqlite3 "VACUUM INTO '/data/backup_${BACKUP_DATE}.sqlite3'"
mv ~/Ecoku/data/backup_${BACKUP_DATE}.sqlite3 ~/backups/
```

---

## 3. 復元手順

```bash
cd ~/Ecoku
sudo docker compose down
tar -xzvf ~/backups/ecoku-backup-YYYYMMDD_HHMMSS.tar.gz
sudo chown -R 10001:10001 data app/config.yaml
sudo chmod 750 data
sudo chmod 640 app/config.yaml
sudo chmod 600 ecoku.env
sudo docker compose up -d
```
