# SQLite 备份、升级、重建与恢复 SOP

Ecoku 只支持 SQLite3。当前版本不迁移历史 schema。生产 Compose 把部署目录的 `./data/` 绑定到
容器 `/data/`，不使用 Docker 命名卷。遇到不兼容数据库时，必须停服、创建数据目录外的备份并
校验，然后在获得目标环境的破坏性授权后重建空库。

## 数据持久化边界

生产 Compose 的 SQLite、站点、通知配置和评论都保存在宿主部署目录的
`./data/`；镜像和容器中不保存这些数据。`sudo docker compose pull` 后执行
`sudo docker compose up -d ecoku` 只替换容器，不会删除绑定挂载的 `./data/`、`app/config.yaml`、
`app/logs/` 或 `ecoku.env`。不得删除 `./data/`，不得把另一个实例指向同一 SQLite 文件。

精确镜像 tag 直接写在 `compose.yaml` 的 `image:`。`ecoku.env` 只保存首次初始化必须的管理员和
通知密钥，不用于 Compose 镜像插值。

## 兼容版本常规升级

只有新版发行说明明确标记当前 schema 可直接升级时，才使用本流程。以下命令在包含
`compose.yaml`、`ecoku.env`、`app/config.yaml`、`app/logs/` 和 `data/` 的实际部署目录执行：

```bash
sudo docker compose config --quiet
sudo docker compose ps
curl --fail http://127.0.0.1:12123/api/health

# 先把 compose.yaml 的 image 改为新的精确 tag。
vi compose.yaml
sudo docker compose config --images
sudo docker compose pull ecoku

# 停服后创建一致的短期回滚点。
sudo docker compose stop ecoku
sudo test ! -e ./data/ecoku.sqlite3-wal
sudo test ! -e ./data/ecoku.sqlite3-shm
mkdir -p ./backups
chmod 700 ./backups
ecoku_backup_stamp="$(date +%Y%m%d-%H%M%S)"
sudo cp --reflink=auto --preserve=mode,timestamps \
  ./data/ecoku.sqlite3 "./backups/ecoku-before-upgrade-${ecoku_backup_stamp}.sqlite3"
sudo chown "$USER":"$USER" \
  "./backups/ecoku-before-upgrade-${ecoku_backup_stamp}.sqlite3"
chmod 600 "./backups/ecoku-before-upgrade-${ecoku_backup_stamp}.sqlite3"
sha256sum "./backups/ecoku-before-upgrade-${ecoku_backup_stamp}.sqlite3" \
  > "./backups/ecoku-before-upgrade-${ecoku_backup_stamp}.sqlite3.sha256"
chmod 600 "./backups/ecoku-before-upgrade-${ecoku_backup_stamp}.sqlite3.sha256"

sudo docker compose up -d ecoku
sudo docker compose ps
curl --fail http://127.0.0.1:12123/api/health
sudo docker compose logs --tail=100 ecoku
```

Ecoku RC3 第一次打开既有数据库时会把持久化 `journal_mode` 切换为 WAL；这不是 schema 迁移，
不会改写评论、站点或通知数据。应用运行期间出现 `ecoku.sqlite3-wal` 与 `ecoku.sqlite3-shm` 是
正常现象。Compose 正常停止会发送 SIGTERM；RC3 会先停止接收请求、等待通知任务退出，再执行
`wal_checkpoint(TRUNCATE)` 并关闭 SQLite。上面的停服和边车检查是冷备份的强制边界：若容器
停止后边车仍存在，不要继续复制、删除或手工合并文件，先用 `sudo docker compose ps`、
`sudo docker compose logs ecoku` 和 `sudo lsof +D ./data` 排查仍持有数据库的进程。不得在服务
运行时只复制主数据库，也不得用 `sudo docker compose kill` 代替正常停止。

再验收管理员登录、站点数、评论总数、时间范围、页面分布、深层回复、墓碑、通知密钥
可读性和实例重启持久性。健康检查成功只证明进程可用，不等于数据验收完成。

验收期内保留旧镜像和本次备份。验收完成后才能按精确文件名删除短期备份；不要用
模糊匹配批量删除。删除旧镜像前先确认它不再是回滚目标。

如果新镜像拒绝当前 schema、发行说明要求迁移或数据验收失败，不得反复重启或手改版本表；
停服并按[恢复旧版本](#恢复旧版本)处理。

## 从 v0.1.0-rc.2 迁移到 v0.1.0-rc.3

本次调整宿主目录和日志路径，并在首次启动时把 SQLite 日志模式切换为 WAL；不改变 SQLite
schema。以下命令假定旧部署目录包含
`compose.yaml`、`config.yaml`、`ecoku.env` 与 `data/ecoku.sqlite3`。必须在实际部署目录逐条执行，
不能把示例目录直接用于其他实例。

先只读确认目标并停服、备份：

```bash
pwd
sudo docker compose ps
test -f ./compose.yaml
test -f ./config.yaml
test -f ./ecoku.env
sudo test -f ./data/ecoku.sqlite3
curl --fail http://127.0.0.1:12123/api/health

sudo docker compose stop ecoku
sudo test ! -e ./data/ecoku.sqlite3-wal
sudo test ! -e ./data/ecoku.sqlite3-shm
mkdir -p ./backups ./app/logs
chmod 700 ./backups
ecoku_rc3_stamp="$(date +%Y%m%d-%H%M%S)"
sudo cp --reflink=auto --preserve=mode,timestamps \
  ./data/ecoku.sqlite3 "./backups/ecoku-before-rc3-${ecoku_rc3_stamp}.sqlite3"
sudo chown "$USER":"$USER" \
  "./backups/ecoku-before-rc3-${ecoku_rc3_stamp}.sqlite3"
chmod 600 "./backups/ecoku-before-rc3-${ecoku_rc3_stamp}.sqlite3"
sha256sum "./backups/ecoku-before-rc3-${ecoku_rc3_stamp}.sqlite3" \
  > "./backups/ecoku-before-rc3-${ecoku_rc3_stamp}.sqlite3.sha256"
chmod 600 "./backups/ecoku-before-rc3-${ecoku_rc3_stamp}.sqlite3.sha256"
cp -p ./compose.yaml "./backups/compose-before-rc3-${ecoku_rc3_stamp}.yaml"
cp -p ./config.yaml "./backups/config-before-rc3-${ecoku_rc3_stamp}.yaml"
```

再移动配置与已有日志。`data/ecoku.log` 不存在时跳过该步，不创建假日志：

```bash
sudo mv ./config.yaml ./app/config.yaml
if sudo test -f ./data/ecoku.log; then
  sudo mv ./data/ecoku.log ./app/logs/ecoku.log
fi

sudo sed -i \
  's#log_path: "/data/ecoku.log"#log_path: "/var/log/ecoku/ecoku.log"#' \
  ./app/config.yaml

sudo chown "$USER":10001 ./app/config.yaml
sudo chmod 0640 ./app/config.yaml
sudo chown -R 10001:10001 ./app/logs ./data
sudo chmod 0750 ./app/logs ./data
```

把仓库 RC3 的 `compose.yaml` 复制到当前部署目录，然后在启动前强制核验所有短绑定路径：

```bash
test -f ./compose.yaml
test -f ./app/config.yaml
test -f ./ecoku.env
test -d ./app/logs
test -d ./data
grep -F 'git.via.moe/dejavu/ecoku:v0.1.0-rc.3' ./compose.yaml
grep -F 'log_path: "/var/log/ecoku/ecoku.log"' ./app/config.yaml
sudo docker compose config --quiet
sudo docker compose pull ecoku
sudo docker compose up -d ecoku
sudo docker compose ps
curl --fail http://127.0.0.1:12123/api/health
sudo docker compose logs --tail=100 ecoku
```

登录管理端核对站点、458 条导入评论（以实际实例总数为准）、深层线程、通知密钥和重启持久性。
再运行 `sudo docker compose stop ecoku`，确认 WAL 边车已完成干净关闭，然后
`sudo docker compose up -d ecoku` 并复查健康与数据，证明 WAL 模式下的停止/重启持久性。成功前
不要删除 RC2 镜像或本节创建的备份。

若 RC3 启动或数据验收失败，停止服务，把备份的 RC2 `compose.yaml` 与 `config.yaml` 恢复到部署
目录根部，并把 `app/logs/ecoku.log` 移回 `data/ecoku.log`（仅当它确实来自该位置），然后用 RC2
镜像重新启动。数据库未被迁移，正常情况下无需覆盖；只有确认数据库已被意外修改且明确选择恢复点
后，才按[恢复旧版本](#恢复旧版本)覆盖 SQLite。

## 停服与备份

1. 解析实际 Compose 文件和容器，确认目标不是其他实例。
2. 停止 Ecoku，确认没有其他进程打开 SQLite。
3. 创建权限为 `0700` 的独立备份目录，用全新文件名复制数据库并写入 SHA-256：

   ```bash
   sudo docker compose stop ecoku
   sudo test ! -e ./data/ecoku.sqlite3-wal
   sudo test ! -e ./data/ecoku.sqlite3-shm
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

## 不兼容版本的已授权重建

只有明确授权清理该实例历史数据时才执行：

1. 再次记录当前部署目录、绑定目录、备份路径、备份大小和哈希。
2. 保留私有 `app/config.yaml`、`ecoku.env` 和管理员凭据文件；不要输出内容。
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
