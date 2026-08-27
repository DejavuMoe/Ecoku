# 升级

只改 Compose 里的**精确镜像 tag**，不要整体覆盖现有 Compose 文件。操作顺序见下文；各版本变更见页末索引。

## 操作顺序

1. 阅读目标版本说明，确认 schema、环境变量和挂载是否有变化。
2. 按 [备份与恢复](./backup) 停服冷备份（数据库、配置、密钥、Compose）。
3. 保留现有资源限制与挂载，只修改镜像 tag。
4. 若版本说明要求补充环境变量或配置，一并改好。
5. 拉取并启动，检查日志与健康接口。
6. 验证管理登录、站点、评论、回复、通知，以及已启用的人机验证。

```bash
sudo docker compose config --quiet
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail=200 ecoku
curl --fail http://127.0.0.1:12123/api/health
```

`/api/health` 只表示进程可响应，不证明迁移或依赖全部正常。

## 数据库

迁移在 `data/ecoku.sqlite3` 内按版本、按事务执行。成功只追加 `schema_migrations` 记录，不自动删除数据库、WAL 或备份；失败版本不会标记完成，服务会拒绝启动。没有向下迁移。

| 镜像 | Schema |
| --- | --- |
| `v0.1.0`–`v0.1.2` | v4 |
| `v0.1.3`–`v0.1.4` | v5 |
| `v0.1.5`–`v0.1.7` | v6 |
| `v0.1.8` | v7 |

已写入更高 schema 的数据库不能只换回旧镜像；需要恢复停服前的整库备份后再用旧 tag 启动。

## 回滚

停服，保留失败现场，按 [备份与恢复](./backup) 恢复，把 Compose 改回旧的精确 tag，再启动。

## 版本索引

| 版本 | 日期 | Schema | 要点 |
| --- | --- | --- | --- |
| [v0.1.8](./upgrades/v0.1.8) | 2026-08-27 | v6 → v7 | Smoji 表情包；站点新增两项配置 |
| [v0.1.7](./upgrades/v0.1.7) | 2026-08-26 | v6 | 构建工具链与文档站；运行时契约不变 |
| [v0.1.6](./upgrades/v0.1.6) | 2026-08-18 | v6 | Cap instrumentation 的管理端 CSP |
| [v0.1.5](./upgrades/v0.1.5) | 2026-08-17 | v5 → v6 | Turnstile / Cap 三态 |
| [v0.1.4](./upgrades/v0.1.4) | 2026-08-15 | v5 | 保存口令时回填 `is_blogger` |
| [v0.1.3](./upgrades/v0.1.3) | 2026-08-15 | v4 → v5 | 博主口令、outbox 按目标拆行 |
| [v0.1.2](./upgrades/v0.1.2) | 2026-08-15 | v4 | 评论元信息字号 |
| [v0.1.1](./upgrades/v0.1.1) | 2026-08-15 | v4 | 折叠按钮等宽 |
| [v0.1.0](./upgrades/v0.1.0) | 2026-08-15 | v4 | 首个正式版 |
| [更早候选](./upgrades/earlier) | 2026-08-14 | v1–v4 | 目录布局、WAL、时区、Turnstile 初版 |
