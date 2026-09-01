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

## 2. 宿主機線上快照 (`VACUUM INTO`)

若宿主機已安裝 `sqlite3` 命令列工具且不希望中斷服務：

```bash
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
sqlite3 ~/Ecoku/data/ecoku.sqlite3 "VACUUM INTO '$HOME/backups/backup_${BACKUP_DATE}.sqlite3'"
```

> [!NOTE]
> 容器執行環境採用極簡 Alpine 映像檔，未內建 `sqlite3` 命令列工具。停服冷備份仍為最推薦、零依賴的備份方式。

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
