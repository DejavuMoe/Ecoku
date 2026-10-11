# 备份与恢复

Ecoku 的全部状态都在部署目录中。完整备份至少包含：

| 路径 | 内容 |
| --- | --- |
| `data/` | SQLite 数据库及其 `-wal`、`-shm` 文件，以及持久密钥 `ecoku-secrets.json`。站点、评论、通知设置、人机验证设置和管理员账户都在这里。 |
| `app/config.yaml` | 实例配置。 |
| `compose.yaml` | 镜像版本和挂载方式。 |

若旧实例仍在使用 `ecoku.env`，也需一同备份：只要其中还保留旧管理员凭据或通知加密主密钥的环境变量，Ecoku 启动时仍会读取。

## 停服冷备份 {#cold-backup}

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

命令会自动带上仍存在的 `ecoku.env`。归档必须包含整个 `data/`，不能只复制 SQLite 主文件。看到 `Verified backup` 表示归档已写入且能列出内容，不代表做过恢复演练。备份失败时服务保持停止；修正原因后重试，或执行 `sudo docker compose up -d ecoku` 恢复运行。

## 从备份恢复 {#restore}

1. 停止服务，把当前的 `data/` 移到另一个目录留存。
2. 从同一份备份完整解压 `data/`、`app/config.yaml` 和 `compose.yaml`；旧实例同时还原 `ecoku.env`。
3. 修正权限并启动：

```bash
cd ~/Ecoku
sudo chown -R 10001:10001 data
sudo chmod 750 data
sudo chmod 600 data/ecoku-secrets.json
sudo docker compose up -d
curl --fail --silent --show-error http://127.0.0.1:12123/api/health
```

不要覆盖运行中的数据库，也不要混用不同时间的文件：新版本的 WAL 不能配旧数据库，新的 `data/` 也不能配旧的 `ecoku-secrets.json`。密钥与数据库不匹配时，已保存的通知凭据无法解密，启动时会报 `通知凭据校验失败` 并退出。`ecoku-secrets.json` 不能向组或其他用户开放任何权限，否则启动时报 `持久密钥文件权限过宽；请设为 600` 并退出。

恢复后确认能登录后台、站点数量正确、历史评论和通知设置都在。

## 备份纪律

- `ecoku-secrets.json` 与数据库同等敏感，不能提交到 Git，也不能放在公开目录。
- `ECOKU_NOTIFICATION_ENCRYPTION_KEY` 等旧环境变量已迁入持久密钥文件后，先停服备份，再从 Compose 或 `ecoku.env` 中删除。
- 回滚前先阅读目标版本的升级说明。schema 不同时，只能用升级前的冷备份恢复。
