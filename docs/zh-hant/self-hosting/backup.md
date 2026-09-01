# 備份與還原

Ecoku 的所有資料均儲存在單個 SQLite 檔案中。

---

## 1. 停服冷備份（推薦）

```bash
cd ~/Ecoku
sudo docker compose down
tar -czvf "ecoku-backup-$(date +%Y%m%d_%H%M%S).tar.gz" data/ app/config.yaml ecoku.env compose.yaml
sudo docker compose up -d
```

---

## 2. 線上備份 (`VACUUM INTO`)

```bash
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
sudo docker compose exec ecoku sqlite3 /data/ecoku.sqlite3 "VACUUM INTO '/data/backup_${BACKUP_DATE}.sqlite3'"
mv ~/Ecoku/data/backup_${BACKUP_DATE}.sqlite3 ~/backups/
```

---

## 3. 還原 SOP

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
