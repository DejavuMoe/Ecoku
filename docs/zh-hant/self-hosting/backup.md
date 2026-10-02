# 備份與還原

新部署至少要備份：

| 路徑 | 內容 |
| --- | --- |
| `data/` | SQLite、`-wal`、`-shm` 和 `ecoku-secrets.json`。站點、評論、通知、人機驗證和管理員帳戶都在這裡。 |
| `app/config.yaml` | 實例設定。 |
| `compose.yaml` | 映像檔版本和掛載方式。 |

舊實例若仍使用 `ecoku.env`，遷移完成前也要一起備份。

## 停服冷備份 {#cold-backup}

```bash
(
set -eu
umask 077
cd "$HOME/Ecoku"
install -d -m 700 backups
sudo docker compose stop ecoku
archive="backups/ecoku-$(date +%Y%m%d_%H%M%S).tar.gz"
set -- data/ app/config.yaml compose.yaml
if [ -f ecoku.env ]; then set -- "$@" ecoku.env; fi
sudo tar -czf - "$@" > "$archive"
tar -tzf "$archive" >/dev/null
printf 'Verified backup: %s\n' "$archive"
sudo docker compose up -d
)
```

命令會自動包含仍存在的 `ecoku.env`。歸檔必須包含整個 `data/`，不能只複製 SQLite 主檔案。`Verified backup` 表示歸檔已寫入且可以列出內容，不代表已完成還原演練。備份失敗時服務保持停止；修正後重試，或執行 `sudo docker compose up -d ecoku` 恢復執行。

## 還原 {#restore}

還原時先停止服務，將目前的 `data/` 移到另一個目錄留存，再完整解壓縮同一份備份。不要直接覆寫執行中的資料庫，也不要混用新版本的 WAL 和舊資料庫。

停止服務後還原完整的 `data/`、`app/config.yaml` 和 `compose.yaml`。舊實例再還原 `ecoku.env`：

```bash
cd ~/Ecoku
sudo chown -R 10001:10001 data
sudo chmod 750 data
sudo chmod 600 data/ecoku-secrets.json
sudo docker compose up -d
curl --fail --silent --show-error http://127.0.0.1:12123/api/health
```

不要混用不同版本的 `ecoku-secrets.json`，也不要只還原 SQLite 主檔案而遺失對應的 WAL。還原後確認能登入後台、站點數量正確，歷史評論和通知設定仍存在。

`ecoku-secrets.json` 與資料庫同樣敏感，不能提交 Git 或放在公開目錄。金鑰遷移完成後，先停服備份，再刪除舊環境變數。
