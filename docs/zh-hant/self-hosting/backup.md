# 備份與還原

生產庫路徑為 `data/ecoku.sqlite3`（另有 WAL / SHM）。停掉容器後會完成 WAL 檢查點。備份須同時包含設定與金鑰。

## 冷備份

在執行個體目錄：

```bash
cd ~/Ecoku
sudo docker compose down

backup_stamp="$(date +%Y%m%d-%H%M%S)"
backup_dir="./backups/$backup_stamp"
mkdir -p "$backup_dir"
sudo cp --preserve=mode,timestamps data/ecoku.sqlite3 "$backup_dir/"
sudo cp --preserve=mode,timestamps app/config.yaml "$backup_dir/"
sudo cp --preserve=mode,timestamps ecoku.env "$backup_dir/"
sudo cp --preserve=mode,timestamps compose.yaml "$backup_dir/"
sudo sha256sum "$backup_dir"/*

sudo docker compose up -d
```

備份目錄與金鑰檔僅管理員可讀。長期留存時複製整個備份目錄到受控儲存，不要只拷貝 SQLite 檔。

## 還原

先停服並另留一份現狀備份，再還原：

```bash
cd ~/Ecoku
sudo docker compose down

backup_file="./backups/YYYYMMDD-HHMMSS/ecoku.sqlite3" # 改為實際路徑
test -f "$backup_file"
sudo cp --preserve=mode,timestamps "$backup_file" ./data/ecoku.sqlite3
sudo rm -f ./data/ecoku.sqlite3-wal ./data/ecoku.sqlite3-shm
sudo chown 10001:10001 ./data/ecoku.sqlite3

sudo docker compose up -d
sudo docker compose ps
curl --fail http://127.0.0.1:12123/api/health
```

若設定或金鑰也損壞，從同一備份目錄還原 `app/config.yaml`、`ecoku.env` 與 `compose.yaml` 後再啟動。還原後檢查管理端、站點、評論與通知測試。
