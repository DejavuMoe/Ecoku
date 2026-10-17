# 備份與還原

使用預設 Compose 掛載時，持久狀態位於部署目錄。完整備份至少包含：

| 路徑 | 內容 |
| --- | --- |
| `data/` | SQLite 資料庫及其 `-wal`、`-shm` 檔案，以及持久金鑰 `ecoku-secrets.json`。站點、評論、通知設定、人機驗證設定和管理員帳戶都在這裡。 |
| `app/config.yaml` | 實例設定。 |
| `compose.yaml` | 映像檔版本和掛載方式。 |

舊實例若仍使用 `ecoku.env`，也要一起備份：只要其中還有舊管理員憑證或通知加密主金鑰的環境變數，Ecoku 每次啟動都會讀取。

自訂 SQLite 路徑時，改為備份實際資料庫所在的完整目錄及同目錄金鑰，並保留對應掛載。額外的 `env_file` 或從宿主環境注入的憑證也要安全保存；下方腳本只涵蓋表中預設路徑與可選的 `ecoku.env`。

## 停服冷備份 {#cold-backup}

```bash
(
set -eu
umask 077
cd "$HOME/Ecoku"
install -d -m 700 backups
sudo docker compose stop ecoku
archive=$(mktemp "backups/ecoku-$(date +%Y%m%d_%H%M%S)-XXXXXX.tar.gz")
set -- data/ app/config.yaml compose.yaml
if [ -f ecoku.env ]; then set -- "$@" ecoku.env; fi
sudo tar -czf - "$@" > "$archive"
tar -tzf "$archive" >/dev/null
printf 'Verified backup: %s\n' "$archive"
)
```

命令會自動帶上仍存在的 `ecoku.env`，並使用不覆寫既有檔案的歸檔名稱。歸檔必須包含整個 `data/`，不能只複製 SQLite 主檔案。看到 `Verified backup` 表示歸檔已寫入且能列出內容，不代表做過還原演練。

**備份後服務保持停止。** 升級、匯入或還原時繼續對應步驟，避免備份後又產生新寫入。僅做日常備份時，確認成功後恢復服務：

```bash
cd ~/Ecoku
sudo docker compose up -d --wait --wait-timeout 120 ecoku
```

## 從備份還原 {#restore}

在新主機還原時，先安裝 Docker 與 Compose，建立 `~/Ecoku/backups/` 並把完整歸檔複製進去；不必先啟動空實例或產生新金鑰。

選擇自己保存的完整冷備份，把下方的 `REPLACE-WITH-YOUR-BACKUP.tar.gz` 換成實際檔名。腳本先檢查歸檔，再停服，將目前資料與設定移入 `before-restore.*` 目錄留存，最後還原同一份歸檔並等待健康。還原的 `compose.yaml` 會同時恢復備份時的映像檔版本。

```bash
(
set -eu
cd "$HOME/Ecoku"
archive="$PWD/backups/REPLACE-WITH-YOUR-BACKUP.tar.gz"
test -f "$archive"
tar -tzf "$archive" >/dev/null
if [ -f compose.yaml ]; then sudo docker compose stop ecoku; fi
saved=$(mktemp -d "$PWD/before-restore.XXXXXX")
for path in data app compose.yaml ecoku.env; do
  if [ -e "$path" ]; then sudo mv -- "$path" "$saved/"; fi
done
sudo tar -xzf "$archive" -C "$PWD"
sudo chown -R 10001:10001 data
sudo chmod 750 data
sudo chmod 600 data/ecoku-secrets.json
sudo chown "$(id -u):$(id -g)" app app/config.yaml
sudo chmod 755 app
sudo chmod 644 app/config.yaml
sudo docker compose config --quiet
sudo docker compose up -d --force-recreate --wait --wait-timeout 120 ecoku
curl --fail --silent --show-error http://127.0.0.1:12123/api/health
printf '\nPrevious files retained in: %s\n' "$saved"
)
```

不要覆寫執行中的資料庫，也不要混用不同時間的檔案：新版本的 WAL 不能配舊資料庫，新的 `data/` 也不能配舊的 `ecoku-secrets.json`。金鑰與資料庫不相符時，已儲存的通知憑證無法解密，啟動時會報 `通知凭据校验失败` 並結束。`ecoku-secrets.json` 不能向群組或其他使用者開放任何權限，否則啟動時報 `持久密钥文件权限过宽；请设为 600` 並結束。

還原會捨棄備份之後產生的評論與設定修改。還原後確認能登入後台、站點數量正確、歷史評論、通知與人機驗證設定都在；健康介面不檢查資料庫內容。任一步失敗時停止後續操作，查看容器日誌與保留的 `before-restore.*`，不要刪除原資料後重試。

## 備份守則

- `ecoku-secrets.json` 與資料庫同樣敏感，不能提交到 Git，也不能放在公開目錄。
- `ECOKU_NOTIFICATION_ENCRYPTION_KEY` 等舊環境變數已遷入持久金鑰檔案後，先停服備份，再從 Compose 或 `ecoku.env` 中刪除。
- 回滾前先閱讀目標版本的升級說明。schema 不同時，只能用升級前的冷備份還原。
