# 备份与恢复

使用默认 Compose 挂载时，持久状态位于部署目录。完整备份至少包含：

| 路径 | 内容 |
| --- | --- |
| `data/` | SQLite 数据库及其 `-wal`、`-shm` 文件，以及持久密钥 `ecoku-secrets.json`。站点、评论、通知设置、人机验证设置和管理员账户都在这里。 |
| `app/config.yaml` | 实例配置。 |
| `compose.yaml` | 镜像版本和挂载方式。 |

若旧实例仍在使用 `ecoku.env`，也需一同备份：只要其中还保留旧管理员凭据或通知加密主密钥的环境变量，Ecoku 启动时仍会读取。

自定义 SQLite 路径时，改为备份实际数据库所在的完整目录及同目录密钥，并保留对应挂载。额外的 `env_file` 或从宿主环境注入的凭据也要安全保存；下面的脚本只覆盖表中默认路径和可选的 `ecoku.env`。

## 停服冷备份 {#cold-backup}

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

命令会自动带上仍存在的 `ecoku.env`，并使用不覆盖已有文件的归档名。归档必须包含整个 `data/`，不能只复制 SQLite 主文件。看到 `Verified backup` 表示归档已写入且能列出内容，不代表做过恢复演练。

**备份后服务保持停止。** 升级、导入或恢复时继续对应步骤，避免备份后又产生新写入。仅做日常备份时，确认成功后恢复服务：

```bash
cd ~/Ecoku
sudo docker compose up -d --wait --wait-timeout 120 ecoku
```

## 从备份恢复 {#restore}

在新主机恢复时，先安装 Docker 与 Compose，创建 `~/Ecoku/backups/` 并把完整归档复制进去；无需先启动空实例或生成新密钥。

选择自己保存的完整冷备份，把下面的 `REPLACE-WITH-YOUR-BACKUP.tar.gz` 换成实际文件名。脚本先检查归档，再停服，将当前数据和配置移入 `before-restore.*` 目录留存，最后恢复同一份归档并等待健康。恢复的 `compose.yaml` 会同时恢复备份时的镜像版本。

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

不要覆盖运行中的数据库，也不要混用不同时间的文件：新版本的 WAL 不能配旧数据库，新的 `data/` 也不能配旧的 `ecoku-secrets.json`。密钥与数据库不匹配时，已保存的通知凭据无法解密，启动时会报 `通知凭据校验失败` 并退出。`ecoku-secrets.json` 不能向组或其他用户开放任何权限，否则启动时报 `持久密钥文件权限过宽；请设为 600` 并退出。

恢复会丢弃备份之后产生的评论和设置修改。恢复后确认能登录后台、站点数量正确、历史评论、通知和人机验证设置都在；健康接口不检查数据库内容。任一步失败时停止后续操作，查看容器日志和保留的 `before-restore.*`，不要删除原数据后重试。

## 备份纪律

- `ecoku-secrets.json` 与数据库同等敏感，不能提交到 Git，也不能放在公开目录。
- `ECOKU_NOTIFICATION_ENCRYPTION_KEY` 等旧环境变量已迁入持久密钥文件后，先停服备份，再从 Compose 或 `ecoku.env` 中删除。
- 回滚前先阅读目标版本的升级说明。schema 不同时，只能用升级前的冷备份恢复。
