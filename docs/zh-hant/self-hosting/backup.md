# 備份與還原

Ecoku 的全部狀態都在部署目錄中。完整備份至少包含：

| 路徑 | 內容 |
| --- | --- |
| `data/` | SQLite 資料庫及其 `-wal`、`-shm` 檔案，以及持久金鑰 `ecoku-secrets.json`。站點、評論、通知設定、人機驗證設定和管理員帳戶都在這裡。 |
| `app/config.yaml` | 實例設定。 |
| `compose.yaml` | 映像檔版本和掛載方式。 |

舊實例若仍使用 `ecoku.env`，也要一起備份：只要其中還有舊管理員憑證或通知加密主金鑰的環境變數，Ecoku 每次啟動都會讀取。

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

命令會自動帶上仍存在的 `ecoku.env`。歸檔必須包含整個 `data/`，不能只複製 SQLite 主檔案。看到 `Verified backup` 表示歸檔已寫入且能列出內容，不代表做過還原演練。備份失敗時服務保持停止；修正原因後重試，或執行 `sudo docker compose up -d ecoku` 恢復執行。

## 從備份還原 {#restore}

1. 停止服務，把目前的 `data/` 移到另一個目錄留存。
2. 從同一份備份完整解壓縮 `data/`、`app/config.yaml` 和 `compose.yaml`；舊實例同時還原 `ecoku.env`。
3. 修正權限並啟動：

```bash
cd ~/Ecoku
sudo chown -R 10001:10001 data
sudo chmod 750 data
sudo chmod 600 data/ecoku-secrets.json
sudo docker compose up -d
curl --fail --silent --show-error http://127.0.0.1:12123/api/health
```

不要覆寫執行中的資料庫，也不要混用不同時間的檔案：新版本的 WAL 不能配舊資料庫，新的 `data/` 也不能配舊的 `ecoku-secrets.json`。金鑰與資料庫不相符時，已儲存的通知憑證無法解密，啟動時會報 `通知凭据校验失败` 並結束。`ecoku-secrets.json` 不能向群組或其他使用者開放任何權限，否則啟動時報 `持久密钥文件权限过宽；请设为 600` 並結束。

還原後確認能登入後台、站點數量正確、歷史評論和通知設定都在。

## 備份守則

- `ecoku-secrets.json` 與資料庫同樣敏感，不能提交到 Git，也不能放在公開目錄。
- `ECOKU_NOTIFICATION_ENCRYPTION_KEY` 等舊環境變數已遷入持久金鑰檔案後，先停服備份，再從 Compose 或 `ecoku.env` 中刪除。
- 回滾前先閱讀目標版本的升級說明。schema 不同時，只能用升級前的冷備份還原。
