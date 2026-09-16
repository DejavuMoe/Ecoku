# 备份与数据恢复

## 1. 停服冷备份

复制整个代码块执行。任何命令失败都会终止代码块并保持停服；排查失败原因后再恢复服务。备份在卷外从创建时即限制访问，使用 sudo 读取 UID 10001 的文件。整个 data 目录（包括仍存在的 WAL/SHM）一起归档；停止成功不保证 WAL 已全部合并。归档检查只验证压缩包可读及必需文件存在，不等于完整恢复演练。

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

## 2. 在线数据库快照

需要宿主机 sqlite3。快照文件由 root 创建、权限 600；目录权限 700。配置归档须与数据库一起保存，特别是解密主密钥。在线复制期间请勿修改配置；需要配置与数据库严格一致时使用冷备份。该快照不是可直接套用下方恢复步骤的冷备份归档。

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

## 3. 恢复冷备份

仅使用可信归档。把文件名改为已验证备份；命令先保留当前 data、配置和环境文件，再整体恢复，避免旧 WAL 混入。恢复配置包含原镜像 tag 和解密密钥。恢复后检查后台登录、站点设置、历史评论和经授权的新评论；健康接口仅证明进程响应。

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
