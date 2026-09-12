# 備份與資料復原

Ecoku 的所有資料（包含站點設定、評論記錄、加密憑證與遷移日誌）均持久化在單個 SQLite3 資料庫檔案中。

---

## 1. 停服冷備份（最推薦、絕對安全）

在執行系統升級、遷移主機或重大設定變更前，**停服冷備份是最安全可靠的方式**。

```bash
cd ~/Ecoku

# 1. 停止執行中的容器，確保 SQLite WAL 完整合併
sudo docker compose down

# 2. 對資料目錄、設定與環境變數打包封存
BACKUP_NAME="ecoku-backup-$(date +%Y%m%d_%H%M%S).tar.gz"
tar -czvf "$BACKUP_NAME" data/ app/config.yaml ecoku.env compose.yaml

# 3. 將備份檔案移出目前目錄，妥善保存在安全的離線或異地儲存中
chmod 600 "$BACKUP_NAME"
mkdir -p ~/backups && mv "$BACKUP_NAME" ~/backups/

# 4. 重新啟動服務
sudo docker compose up -d
```

---

## 2. 宿主機線上快照（`VACUUM INTO`）

若宿主機已安裝 `sqlite3` 命令列工具且不希望短暫中斷服務，可以在宿主機上對資料檔案直接執行 SQLite 原生原子快照指令 `VACUUM INTO`，線上產生一份無鎖、已重組的高品質單檔案備份：

```bash
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)

# 宿主機直接執行 VACUUM INTO 產生快照
mkdir -p ~/backups
sqlite3 ~/Ecoku/data/ecoku.sqlite3 "VACUUM INTO '$HOME/backups/backup_${BACKUP_DATE}.sqlite3'"
```

> [!NOTE]
> 容器執行環境採用極簡 Alpine 映像檔，未內建 `sqlite3` 命令列工具。若宿主機未安裝 `sqlite3`，推薦使用上述「停服冷備份」（最可靠、零額外依賴）。

---

## 3. 資料復原 SOP

當發生資料損壞、誤操作或需要整站遷移時，請按以下步驟執行精確復原：

```bash
cd ~/Ecoku

# 步驟 1：停止容器
sudo docker compose down

# 步驟 2：保留故障現場（將現有損壞目錄重新命名備份）
mv data data_corrupted_$(date +%Y%m%d_%H%M%S)
mkdir -p data

# 步驟 3：解壓縮備份封存
tar -xzvf ~/backups/ecoku-backup-YYYYMMDD_HHMMSS.tar.gz

# 步驟 4：校驗並修復檔案所有者權限（必須為 10001:10001）
sudo chown -R 10001:10001 data app/config.yaml
sudo chmod 750 data
sudo chmod 640 app/config.yaml
sudo chmod 600 ecoku.env

# 步驟 5：啟動容器
sudo docker compose up -d

# 步驟 6：檢查日誌與健康狀態
sudo docker compose logs --tail=100 ecoku
curl -f http://127.0.0.1:12123/api/health
```

---

## 4. 備份驗證與災難演練

復原完成後，請按以下清單進行業務功能驗收：

- [ ] `curl -f http://127.0.0.1:12123/api/health` 正常回傳，`data.status` 為 `healthy`。
- [ ] 管理後台 `/admin/` 可以正常登入。
- [ ] 站點列表與設定完好，站長通關密語與徽章正常展示。
- [ ] 部落格前台評論區能夠正常載入歷史樹狀評論。
- [ ] 嘗試提交一則新評論，確認能夠即時發表。
