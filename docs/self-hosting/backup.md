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

命令会自动包含仍存在的 `ecoku.env`。归档必须包含整个 `data/`，不能只复制 SQLite 主文件。看到 `Verified backup` 表示归档已成功写入并可列出内容，不代表已经做过恢复演练。备份失败时服务保持停止；修正原因后重试，或执行 `sudo docker compose up -d ecoku` 恢复运行。

## 从备份恢复 {#restore}

恢复时先停止服务，将当前 `data/` 移到另一个目录留存，再完整解压同一份备份。不要直接覆盖运行中的数据库，也不要把新版本的 WAL 与旧数据库混在一起。

停服后恢复整个 `data/`、`app/config.yaml` 和 `compose.yaml`。旧实例还原 `ecoku.env`。恢复后修正权限：

```bash
cd ~/Ecoku
sudo chown -R 10001:10001 data
sudo chmod 750 data
sudo chmod 600 data/ecoku-secrets.json
sudo docker compose up -d
curl --fail --silent --show-error http://127.0.0.1:12123/api/health
```

不要把新版本的 `data/` 与旧版本的 `ecoku-secrets.json` 混用，也不要只恢复 SQLite 主文件而丢弃对应的 WAL 文件。恢复后确认能登录后台、站点数量正确、历史评论和通知设置都存在。

## 备份纪律

- `ecoku-secrets.json` 与数据库同等敏感，不能提交 Git 或放到公开目录；
- `ECOKU_NOTIFICATION_ENCRYPTION_KEY` 一旦迁移到持久文件，旧环境变量可以在停服备份后删除；
- 回滚前先阅读目标版本的升级说明，schema 不同的时候只能用对应版本的冷备份恢复。
