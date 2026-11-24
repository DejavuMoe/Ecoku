# 備份與還原

Ecoku 的全部狀態都在部署目錄裡：

| 路徑 | 內容 |
| --- | --- |
| `data/` | SQLite 資料庫（含 `-wal`、`-shm` 檔案）和金鑰檔案 `ecoku-secrets.json`。站點、評論、通知和驗證設定、管理員帳戶都在這裡。 |
| `app/config.yaml` | 實例設定 |
| `compose.yaml` | 映像檔版本和掛載方式 |

資料庫和 `ecoku-secrets.json` 必須來自同一時刻。SMTP 密碼等憑證是用這個金鑰加密的，兩者對不上，Ecoku 就無法啟動。

## 停服冷備份 {#cold-backup}

先停服再打包，這樣不會漏掉還在寫入的資料：

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

看到 `Verified backup` 表示歸檔已寫好、能讀出檔案清單。舊實例如果還有 `ecoku.env`，腳本會一併打包。

腳本結束後服務仍是停止狀態，方便你接著升級或匯入。只做日常備份的話，確認成功後啟動：

```bash
cd ~/Ecoku
sudo docker compose up -d --wait --wait-timeout 120 ecoku
```

把歸檔複製到別的機器上保存。它和資料庫一樣敏感：不要提交到 Git，不要放在公開目錄。

自訂了資料庫路徑的話，備份實際資料庫所在的整個目錄（金鑰檔案在同一目錄）。

## 從備份還原 {#restore}

還原會捨棄備份之後的所有評論和設定修改。

在新主機上還原時，先裝好 Docker 和 Compose，建立 `~/Ecoku/backups/`，把歸檔複製進去，不需要先啟動一個空實例。

把下面的 `REPLACE-WITH-YOUR-BACKUP.tar.gz` 換成你的歸檔檔名。腳本會先檢查歸檔、停服，把現有檔案移到 `before-restore.*` 目錄裡留著，再解壓歸檔並啟動。歸檔裡的 `compose.yaml` 會把映像檔也還原到備份時的版本。

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

還原後登入後台，確認站點、歷史評論、通知和驗證設定都在。健康介面只說明程序在執行，不檢查資料。

任何一步出錯就停下，查看容器日誌和 `before-restore.*` 裡的原檔案，不要刪掉原資料重試。

兩個常見的啟動錯誤：

- `通知凭据校验失败`：`ecoku-secrets.json` 和資料庫不是同一份備份。
- `持久密钥文件权限过宽；请设为 600`：`ecoku-secrets.json` 的權限需要是 `600`。

## 回滾與 schema

回滾到舊版本前，先讀目標版本的升級說明。兩個版本的 schema 不同時，只能用升級前的冷備份還原，見 [升級 · 回滾](./upgrade#rollback)。
