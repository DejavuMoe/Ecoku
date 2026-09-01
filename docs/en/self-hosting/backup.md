# Backup & Restore

All Ecoku data resides in a single SQLite database file.

---

## 1. Cold Snapshot Backup (Recommended)

```bash
cd ~/Ecoku
sudo docker compose down
tar -czvf "ecoku-backup-$(date +%Y%m%d_%H%M%S).tar.gz" data/ app/config.yaml ecoku.env compose.yaml
sudo docker compose up -d
```

---

## 2. Host Online Snapshot (`VACUUM INTO`)

If `sqlite3` CLI is installed on the host and zero downtime is desired:

```bash
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
sqlite3 ~/Ecoku/data/ecoku.sqlite3 "VACUUM INTO '$HOME/backups/backup_${BACKUP_DATE}.sqlite3'"
```

> [!NOTE]
> The minimal Alpine container image does not bundle the `sqlite3` CLI. Cold backup remains the recommended, dependency-free method.

---

## 3. Restore SOP

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
