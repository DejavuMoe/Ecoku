# SQLite 备份、重建与恢复 SOP

Ecoku 只支持 SQLite3。当前版本不迁移历史 schema。生产 Compose 把部署目录的 `./data/` 绑定到
容器 `/data/`，不使用 Docker 命名卷。遇到不兼容数据库时，必须停服、创建数据目录外的备份并
校验，然后在获得目标环境的破坏性授权后重建空库。

## 停服与备份

1. 解析实际 Compose 文件和容器，确认目标不是其他实例。
2. 停止 Ecoku，确认没有其他进程打开 SQLite。
3. 创建权限为 `0700` 的独立备份目录，用全新文件名复制数据库并写入 SHA-256：

   ```bash
   docker compose stop ecoku
   mkdir -p ./backups
   chmod 700 ./backups
   sudo cp --reflink=auto --preserve=mode,timestamps \
     ./data/ecoku.sqlite3 ./backups/ecoku-before-reset.sqlite3
   sudo chown "$USER":"$USER" ./backups/ecoku-before-reset.sqlite3
   chmod 600 ./backups/ecoku-before-reset.sqlite3
   sha256sum ./backups/ecoku-before-reset.sqlite3 \
     > ./backups/ecoku-before-reset.sqlite3.sha256
   chmod 600 ./backups/ecoku-before-reset.sqlite3*
   ```

这些命令必须在包含当前 `compose.yaml` 的部署目录执行。文件名只能在只读核验后替换。检测到
`-wal`、`-shm` 或 `-journal` 边车文件时不要盲目复制，先调查仍在运行的进程并完成一致性停机。

## 已授权重建

只有明确授权清理该实例历史数据时才执行：

1. 再次记录当前部署目录、绑定目录、备份路径、备份大小和哈希。
2. 保留私有 `config.yaml`、`ecoku.env` 和管理员凭据文件；不要输出内容。
3. 只删除已经核验过的 `./data/ecoku.sqlite3` 及其边车文件；不得删除部署目录或其他实例目录。
4. 使用当前镜像启动，等待空库初始化。
5. 验收健康、管理员登录、站点注册、公开提交/读取、线程与墓碑、通知设置和重启持久性。

健康检查成功只证明进程可用，不等于数据或业务验收完成。

## 恢复旧版本

恢复会覆盖当前数据，必须再次停服并先备份故障现场：

1. 校验目标历史备份的 SHA-256。
2. 在隔离临时目录中使用与备份 schema 匹配的旧镜像验证可启动和可读取。
3. 获得明确恢复点确认后，把备份复制到当前实例的 `./data/ecoku.sqlite3`，并恢复 UID/GID
   `10001:10001` 与仅实例可读写的权限。
4. 使用匹配的旧镜像启动并验收公开线程、管理端和通知设置。

本仓库不提供向下迁移，也不允许通过手改 `schema_migrations` 绕过版本或校验和检查。

## 定期演练

- 用不含真实个人数据的 fixture 创建临时实例，停服、目录外备份并校验哈希；
- 在另一临时目录恢复，校验 schema、线程、墓碑隐私和站点配置；
- 记录镜像版本、备份哈希、耗时和验证结果；
- 删除临时目录前确认它不是当前实例的绑定数据目录。
