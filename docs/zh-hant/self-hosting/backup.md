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
install -d -m 700 "$HOME/backups"
sudo docker compose down
archive="$HOME/backups/ecoku-$(date +%Y%m%d_%H%M%S).tar.gz"
sudo tar -czf - data/ app/config.yaml compose.yaml ${ECOKU_BACKUP_ENV:-} > "$archive"
printf 'Verified backup: %s\n' "$archive"
sudo docker compose up -d
)
```

舊實例備份前設定 `ECOKU_BACKUP_ENV=ecoku.env`；新實例不要設定。必須打包整個 `data/`，不能只複製 SQLite 主檔案。

## 還原 {#restore}

停止服務後還原完整的 `data/`、`app/config.yaml` 和 `compose.yaml`。舊實例再還原 `ecoku.env`：

```bash
cd ~/Ecoku
sudo chown -R 10001:10001 data
sudo chmod 750 data
sudo docker compose up -d
curl --fail --silent --show-error http://127.0.0.1:12123/api/health
```

不要混用不同版本的 `ecoku-secrets.json`，也不要只還原 SQLite 主檔案而遺失對應的 WAL。還原後確認能登入後台、站點數量正確，歷史評論和通知設定仍存在。

`ecoku-secrets.json` 與資料庫同樣敏感，不能提交 Git 或放在公開目錄。金鑰遷移完成後，先停服備份，再刪除舊環境變數。
