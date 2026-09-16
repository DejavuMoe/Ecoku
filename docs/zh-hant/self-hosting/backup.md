# 備份與資料恢復

## 1. 停服冷備份

請執行完整程式區塊。任何命令失敗都會停止區塊並保持停服，排除原因後再恢復服務。備份位於掛載卷外，從建立時限制存取，透過 sudo 讀取 UID 10001 的檔案。整個 data 目錄（包括仍存在的 WAL/SHM）一起封存；停止成功不代表 checkpoint 已完成。檢查只確認封存可讀與必要檔案存在，不能取代恢復演練。

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

## 2. 線上資料庫快照

需要主機 sqlite3。快照由 root 建立、權限 600，目錄權限 700。設定封存與解密主金鑰必須配套保存；擷取期間勿修改設定，需要嚴格一致時使用冷備份。此快照不是下方恢復區塊使用的冷備份封存。

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

## 3. 恢復冷備份

僅使用可信封存，先替換檔名。命令保留目前 data、設定與環境檔案後整體恢復，避免混入舊 WAL。原鏡像 tag 和解密金鑰一併恢復。完成後檢查管理登入、站點設定、歷史留言與經授權的新留言；健康介面僅證明程序回應。

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
sudo mv data app/config.yaml ecoku.env compose.yaml "$saved/"
sudo tar -xzf "$archive" --no-same-owner
sudo chown -R 10001:10001 data app/config.yaml
sudo chmod 750 data
sudo chmod 640 app/config.yaml
sudo chown "$(id -u):$(id -g)" ecoku.env compose.yaml
chmod 600 ecoku.env
sudo docker compose up -d
curl --fail --silent --show-error http://127.0.0.1:12123/api/health
)
```
