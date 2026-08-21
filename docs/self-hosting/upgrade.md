# 升级流程

每次发版后，把对应说明放进 [升级说明](/self-hosting/upgrades/)。升级前读该版本页面与仓库 `CHANGELOG.md`。

## 固定顺序

1. 确认目标 tag、schema、环境变量与目录变化。
2. [停服冷备份](/self-hosting/backup) 数据库与配置。
3. 把 `compose.yaml` 的精确镜像 tag 改为新版本；若旧文件没有 `logging` 段，按当前仓库补上。
4. 若该版本要求新环境变量（例如 `TZ`），写入 `ecoku.env` 后再启动，不要写进 `config.yaml`。
5. 拉取并启动，观察迁移日志，确认 `healthy`。
6. 验证管理登录、站点、评论时间、提交、回复与通知。若启用了 Turnstile 或 Cap，登录和发表都要能完成当前验证。

```bash
sudo docker compose config --quiet
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail=200 ecoku
curl --fail http://127.0.0.1:12123/api/health
```

## Schema

迁移在原 `data/ecoku.sqlite3` 内按版本事务执行。成功只增加 `schema_migrations` 记录，不会自动删除数据库、WAL 或 `backups/`。失败的版本不会被记为完成，服务拒绝启动。没有向下迁移。

已写入更高 schema 的库不能只换回旧镜像，必须用停服前整库备份恢复。

| 镜像 | Schema |
| --- | --- |
| `v0.1.0` – `v0.1.2` | v4 |
| `v0.1.3` – `v0.1.4` | v5 |
| `v0.1.5` – `v0.1.6` | v6 |

当前最新为 schema v6：`turnstile_settings` 已重命名为 `captcha_settings`，并增加 Cap 字段。

## 回滚

停服 → 保留失败现场 → 恢复备份 → 改回旧精确 tag → 启动。细节见 [备份与恢复](/self-hosting/backup#恢复)。
