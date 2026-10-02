# 備份與還原

Ecoku 的所有狀態都在部署目錄裡。一份完整的備份包含四項：

| 路徑 | 內容 |
| --- | --- |
| `data/` | SQLite 資料庫，以及執行時產生的 `-wal`、`-shm` 檔案。站點、評論、通知和驗證設定都在這裡。 |
| `ecoku.env` | 管理員憑據和加密主金鑰。沒有主金鑰，資料庫中已儲存的 SMTP、Telegram 和驗證憑據就無法解密，服務會拒絕啟動。 |
| `app/config.yaml` | 實例設定。 |
| `compose.yaml` | 其中記錄了正在使用的映像檔版本，還原時要用同一版本啟動。 |

`ecoku.env` 包含金鑰，備份檔案請只保存在自己能掌控的位置。

## 停止服務後冷備份 {#cold-backup}

建議採用的方式。先停止服務，把四項打包成一個封存檔，驗證後再啟動。停止服務期間評論區無法載入，整個過程通常只需幾秒。

請整段複製執行。任何一步失敗都會中止，服務維持停止狀態，排查原因後再手動啟動。

```bash
(
set -eu
umask 077
cd "$HOME/Ecoku"
install -d -m 700 "$HOME/backups"
sudo docker compose down
archive="$HOME/backups/ecoku-$(date +%Y%m%d_%H%M%S).tar.gz"
[ ! -e "$archive" ]
sudo tar -czf - data/ app/config.yaml ecoku.env compose.yaml > "$archive"
contents=$(tar -tzf "$archive")
for required in data/ecoku.sqlite3 app/config.yaml ecoku.env compose.yaml; do
  printf '%s\n' "$contents" | grep -Fx "$required" > /dev/null
done
printf 'Verified backup: %s\n' "$archive"
sudo docker compose up -d
)
```

這段腳本會：

- 在 `~/backups/` 下產生 `ecoku-日期_時間.tar.gz`，目錄和檔案只有目前使用者可讀取；
- 用 `sudo` 讀取屬於 UID 10001 的資料檔案；
- 把整個 `data/` 目錄一起打包，包括可能殘留的 WAL 檔案；
- 最後檢查封存檔能否讀取、必要檔案是否齊全。這只能說明封存檔完整，不代表已經演練過還原。

## 線上快照

不想停止服務時，可以用主機上的 `sqlite3` 指令對執行中的資料庫建立一致性快照。需要先安裝 sqlite3（Debian/Ubuntu：`sudo apt install sqlite3`）。

```bash
(
set -eu
umask 077
cd "$HOME/Ecoku"
install -d -m 700 "$HOME/backups"
snapshot=$(mktemp -d "$HOME/backups/ecoku-snapshot-XXXXXXXX")
sudo sh -c 'umask 077; cd "$1"; sqlite3 "$2" ".backup database.sqlite3"' sh "$snapshot" "$PWD/data/ecoku.sqlite3"
sudo tar -czf - app/config.yaml ecoku.env compose.yaml > "$snapshot/config.tar.gz"
printf 'Snapshot: %s\n' "$snapshot"
)
```

結果是一個目錄，裡面有資料庫快照 `database.sqlite3`（擁有者為 root，權限 600）和設定封存檔 `config.tar.gz`。它的格式與冷備份不同，不能直接用於下面的還原腳本。如果在快照期間修改了設定，資料庫和設定可能不一致。需要兩者嚴格對應時，請使用冷備份。

從快照還原時，先停止服務，刪除殘留的 WAL 檔案，再以容器使用者為擁有者放回資料庫（`snapshot=` 改成快照目錄）：

```bash
cd ~/Ecoku
snapshot="$HOME/backups/ecoku-snapshot-XXXXXXXX"
sudo docker compose down
sudo rm -f data/ecoku.sqlite3-wal data/ecoku.sqlite3-shm
sudo install -o 10001 -g 10001 -m 600 "$snapshot/database.sqlite3" data/ecoku.sqlite3
sudo docker compose up -d
```

需要同時還原設定時，在啟動前解開 `config.tar.gz`，並依照下文的還原腳本修正擁有者和權限。

## 從冷備份還原 {#restore}

還原會用備份中的狀態取代目前的資料庫和設定，備份之後產生的評論和設定修改都會遺失。

先把腳本中的 `archive=` 改成要還原的封存檔路徑。腳本在原部署目錄中執行；在新主機上還原時，先依照 [Docker 部署](./docker)第 1 步建立 `~/Ecoku`。腳本會：

1. 檢查封存檔中包含必要檔案；
2. 停止服務；
3. 把目前的 `data/`、設定和環境檔案移到 `recovery-before-日期_時間/`，以便需要時找回；
4. 解開封存檔，修正擁有者和權限；
5. 啟動服務並檢查健康檢查端點。

```bash
(
set -eu
umask 077
cd "$HOME/Ecoku"
archive="$HOME/backups/ecoku-YYYYMMDD_HHMMSS.tar.gz"
contents=$(tar -tzf "$archive")
for required in data/ecoku.sqlite3 app/config.yaml ecoku.env compose.yaml; do
  printf '%s\n' "$contents" | grep -Fx "$required" > /dev/null
done
sudo docker compose down
saved="recovery-before-$(date +%Y%m%d_%H%M%S)"
mkdir -m 700 "$saved"
for item in data app/config.yaml ecoku.env compose.yaml; do
  [ ! -e "$item" ] || sudo mv "$item" "$saved/"
done
sudo tar -xzf "$archive" --no-same-owner
sudo chown -R 10001:10001 data
sudo chmod 750 data
sudo chown "$(id -u):$(id -g)" app app/config.yaml ecoku.env compose.yaml
chmod 755 app
chmod 644 app/config.yaml
chmod 600 ecoku.env
sudo docker compose up -d
curl --fail --silent --show-error --retry 15 --retry-delay 2 --retry-all-errors \
  http://127.0.0.1:12123/api/health
)
```

整個 `data/` 目錄都會被取代，舊的 WAL 檔案不會混進還原後的資料庫。`compose.yaml` 也來自備份，服務會以備份時的映像檔版本啟動。

健康檢查端點正常只能說明程式在執行。還原後請再確認：能登入後台、站點設定正確、文章頁能看到歷史評論。

只還原來源可信的封存檔。
