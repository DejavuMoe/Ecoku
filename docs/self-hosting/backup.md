# 备份与恢复

Ecoku 的全部状态都在部署目录里。一份完整备份包含四项：

| 路径 | 内容 |
| --- | --- |
| `data/` | SQLite 数据库，以及运行时的 `-wal`、`-shm` 文件。站点、评论、通知和验证设置都在这里。 |
| `ecoku.env` | 管理员凭据和加密主密钥。没有主密钥，数据库中已保存的 SMTP、Telegram 和验证凭据就无法解密，服务会拒绝启动。 |
| `app/config.yaml` | 实例配置。 |
| `compose.yaml` | 其中记录了正在使用的镜像版本，恢复时要用同一版本启动。 |

`ecoku.env` 包含密钥，备份文件请只保存在自己可控的位置。

## 停服冷备份 {#cold-backup}

推荐的方式。先停止服务，把四项打包成一个归档，校验后再启动。停服期间评论区无法加载，整个过程通常只需几秒。

整段复制执行。任何一步失败都会中止，服务保持停止状态，排查原因后再手动启动。

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

这段脚本：

- 在 `~/backups/` 下生成 `ecoku-日期_时间.tar.gz`，目录和文件只有当前用户可读；
- 用 `sudo` 读取属于 UID 10001 的数据文件；
- 把整个 `data/` 目录一起打包，包括可能残留的 WAL 文件；
- 最后检查归档能否读取、必要文件是否都在。这只能说明归档完整，不等于演练过恢复。

## 在线快照

不想停服时，可以用宿主机上的 `sqlite3` 命令对运行中的数据库做一致性快照。需要先安装 sqlite3（Debian/Ubuntu：`sudo apt install sqlite3`）。

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

结果是一个目录，里面有数据库快照 `database.sqlite3`（属主 root，权限 600）和配置归档 `config.tar.gz`。它的格式与冷备份不同，不能直接用于下面的恢复脚本。快照期间如果修改了配置，数据库和配置可能不一致。需要两者严格对应时，请用冷备份。

从快照恢复时，先停止服务，删掉残留的 WAL 文件，再以容器用户的属主放回数据库（`snapshot=` 改成快照目录）：

```bash
cd ~/Ecoku
snapshot="$HOME/backups/ecoku-snapshot-XXXXXXXX"
sudo docker compose down
sudo rm -f data/ecoku.sqlite3-wal data/ecoku.sqlite3-shm
sudo install -o 10001 -g 10001 -m 600 "$snapshot/database.sqlite3" data/ecoku.sqlite3
sudo docker compose up -d
```

需要同时恢复配置时，在启动前解开 `config.tar.gz`，并按下文恢复脚本修正属主和权限。

## 从冷备份恢复 {#restore}

恢复会用备份中的状态替换当前的数据库和配置，备份之后产生的评论和设置修改都会丢失。

先把脚本中的 `archive=` 改成要恢复的归档路径。脚本在原部署目录中运行，在新主机上恢复时先按 [Docker 部署](./docker)第 1 步建好 `~/Ecoku`。脚本会：

1. 检查归档中包含必要文件；
2. 停止服务；
3. 把当前的 `data/`、配置和环境文件移到 `recovery-before-日期_时间/`，以便需要时找回；
4. 解开归档，修正属主和权限；
5. 启动服务并检查健康接口。

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

整个 `data/` 目录会被替换，旧的 WAL 文件不会混进恢复后的数据库。`compose.yaml` 也来自备份，服务会以备份时的镜像版本启动。

健康接口正常只说明进程在运行。恢复后请再确认：能登录后台、站点设置正确、文章页能看到历史评论。

只恢复可信来源的归档。
