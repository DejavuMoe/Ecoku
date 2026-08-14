# SQLite 备份、重建与恢复 SOP

Ecoku 只支持 SQLite3。当前版本不迁移历史 schema。遇到不兼容数据库时，必须停服、创建卷外
备份并校验，然后在获得目标环境的破坏性授权后重建空库。

## 停服与备份

1. 解析实际 Compose 文件和容器，确认目标不是其他实例。
2. 停止 Ecoku，确认没有其他进程打开 SQLite。
3. 创建权限为 `0700` 的卷外备份目录，用全新文件名复制数据库并写入 SHA-256：

   ```bash
   docker compose stop ecoku
   mkdir -p /var/backups/ecoku
   chmod 700 /var/backups/ecoku
   docker compose cp \
     ecoku:/data/ecoku.sqlite3 \
     /var/backups/ecoku/ecoku-before-reset.sqlite3
   sha256sum /var/backups/ecoku/ecoku-before-reset.sqlite3 \
     > /var/backups/ecoku/ecoku-before-reset.sqlite3.sha256
   chmod 600 /var/backups/ecoku/ecoku-before-reset.sqlite3*
   ```

`docker compose cp` 由当前 Compose 项目解析实际容器，避免硬编码项目名前缀后的卷名。文件名只能在
只读核验后替换。检测到 `-wal`、`-shm` 或 `-journal` 边车文件时不要盲目复制，先调查仍在运行的
进程并完成一致性停机。

## 已授权重建

只有明确授权清理该实例历史数据时才执行：

1. 再次记录当前卷名、备份路径、备份大小和哈希。
2. 保留私有 `config.yaml`、`ecoku.env` 和管理员凭据文件；不要输出内容。
3. 删除数据卷内的 SQLite 主文件及边车文件，或删除并以相同名称重建该专用数据卷。
4. 使用当前镜像启动，等待空库初始化。
5. 验收健康、管理员登录、站点注册、公开提交/读取、线程与墓碑、通知设置和重启持久性。

健康检查成功只证明进程可用，不等于数据或业务验收完成。

## 恢复旧版本

恢复会覆盖当前数据，必须再次停服并先备份故障现场：

1. 校验目标历史备份的 SHA-256。
2. 在隔离临时卷中使用与备份 schema 匹配的旧镜像验证可启动和可读取。
3. 获得明确恢复点确认后，把备份复制到专用数据卷的 `/data/ecoku.sqlite3`。
4. 使用匹配的旧镜像启动并验收公开线程、管理端和通知设置。

本仓库不提供向下迁移，也不允许通过手改 `schema_migrations` 绕过版本或校验和检查。

## 定期演练

- 用不含真实个人数据的 fixture 创建临时实例，停服、卷外备份并校验哈希；
- 在另一临时卷恢复，校验 schema、线程、墓碑隐私和站点配置；
- 记录镜像版本、备份哈希、耗时和验证结果；
- 删除临时卷前确认它不是当前实例数据卷。
