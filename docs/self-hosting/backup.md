# 备份与数据恢复

Ecoku 的所有数据（包含站点配置、评论记录、加密凭据与迁移日志）均持久化在单个 SQLite3 数据库文件中。

---

## 1. 停服冷备份（最推荐、绝对安全）

在执行系统升级、迁移主机或重大配置变更前，**停服冷备份是最安全可靠的方式**。

```bash
cd ~/Ecoku

# 1. 停止运行中的容器，确保 SQLite WAL 完整合并
sudo docker compose down

# 2. 对数据目录、配置与环境变量打包归档
BACKUP_NAME="ecoku-backup-$(date +%Y%m%d_%H%M%S).tar.gz"
tar -czvf "$BACKUP_NAME" data/ app/config.yaml ecoku.env compose.yaml

# 3. 将备份文件移出当前目录，妥善保存在安全的离线或异地存储中
chmod 600 "$BACKUP_NAME"
mv "$BACKUP_NAME" ~/backups/

# 4. 重新启动服务
sudo docker compose up -d
```

---

## 2. 宿主机在线快照（`VACUUM INTO`）

若宿主机已安装 `sqlite3` 命令行工具且不希望短暂停服，可以在宿主机上对数据文件直接执行 SQLite 原生原子快照命令 `VACUUM INTO`，在线生成一份无锁、已整理的高质量单文件备份：

```bash
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)

# 宿主机直接执行 VACUUM INTO 生成快照
sqlite3 ~/Ecoku/data/ecoku.sqlite3 "VACUUM INTO '$HOME/backups/backup_${BACKUP_DATE}.sqlite3'"
```

> [!NOTE]
> 容器运行环境采用极简 Alpine 镜像，未内置 `sqlite3` 命令行工具。若宿主机未安装 `sqlite3`，推荐使用上述「停服冷备份」（最可靠、零额外依赖）。

---

## 3. 数据恢复 SOP

当发生数据损坏、误操作或需要整站迁移时，请按以下步骤执行精确恢复：

```bash
cd ~/Ecoku

# 步骤 1：停止容器
sudo docker compose down

# 步骤 2：保留故障现场（将现有损坏目录重命名备份）
mv data data_corrupted_$(date +%Y%m%d_%H%M%S)
mkdir -p data

# 步骤 3：解压备份归档
tar -xzvf ~/backups/ecoku-backup-YYYYMMDD_HHMMSS.tar.gz

# 步骤 4：校验并修复文件所有者权限（必须为 10001:10001）
sudo chown -R 10001:10001 data app/config.yaml
sudo chmod 750 data
sudo chmod 640 app/config.yaml
sudo chmod 600 ecoku.env

# 步骤 5：启动容器
sudo docker compose up -d

# 步骤 6：检查日志与健康状态
sudo docker compose logs --tail=100 ecoku
curl -f http://127.0.0.1:12123/api/health
```

---

## 4. 备份验证与灾难演练

恢复完成后，请按以下清单进行业务功能验收：

- [ ] `curl -f http://127.0.0.1:12123/api/health` 正常返回，`data.status` 为 `healthy`。
- [ ] 管理后台 `/admin/` 可以正常登录。
- [ ] 站点列表与配置完好，博主口令与徽章正常展示。
- [ ] 博客前台评论区能够正常加载历史树状评论。
- [ ] 尝试提交一条新评论，确认能够即时发表。
