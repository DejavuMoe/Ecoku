# 备份与恢复

Ecoku 的状态在部署目录中。新部署的完整备份至少包含：

| 路径 | 内容 |
| --- | --- |
| `data/` | SQLite 数据库、`-wal`、`-shm` 和 `ecoku-secrets.json`。站点、评论、通知、人机验证和管理员账户都在这里。 |
| `app/config.yaml` | 实例配置。 |
| `compose.yaml` | 镜像版本和挂载方式。 |

旧实例如果仍在使用 `ecoku.env`，也要把它放进备份。环境变量迁移完成前，通知加密主密钥和旧管理员凭据仍可能从其中读取。

## 停服冷备份 {#cold-backup}

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

如果旧实例有 `ecoku.env`，请在打包前设置 `ECOKU_BACKUP_ENV=ecoku.env`；新实例不要设置。归档必须包含整个 `data/`，不能只复制 `ecoku.sqlite3`，因为 WAL 和持久密钥也在其中。

## 从备份恢复 {#restore}

停服后恢复整个 `data/`、`app/config.yaml` 和 `compose.yaml`。旧实例还原 `ecoku.env`。恢复后修正权限：

```bash
cd ~/Ecoku
sudo chown -R 10001:10001 data
sudo chmod 750 data
sudo docker compose up -d
curl --fail --silent --show-error http://127.0.0.1:12123/api/health
```

不要把新版本的 `data/` 与旧版本的 `ecoku-secrets.json` 混用，也不要只恢复 SQLite 主文件而丢弃对应的 WAL 文件。恢复后确认能登录后台、站点数量正确、历史评论和通知设置都存在。

## 备份纪律

- `ecoku-secrets.json` 与数据库同等敏感，不能提交 Git 或放到公开目录；
- `ECOKU_NOTIFICATION_ENCRYPTION_KEY` 一旦迁移到持久文件，旧环境变量可以在停服备份后删除；
- 回滚前先阅读目标版本的升级说明，schema 不同的时候只能用对应版本的冷备份恢复。
