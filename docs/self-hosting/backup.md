# 备份与恢复

Ecoku 的全部状态都在部署目录里：

| 路径 | 内容 |
| --- | --- |
| `data/` | SQLite 数据库（含 `-wal`、`-shm` 文件）和密钥文件 `ecoku-secrets.json`。站点、评论、通知和验证设置、管理员账户都在这里。 |
| `app/config.yaml` | 实例配置 |
| `compose.yaml` | 镜像版本和挂载方式 |

数据库和 `ecoku-secrets.json` 必须来自同一时刻。SMTP 密码等凭据是用这个密钥加密的，两者对不上，Ecoku 就无法启动。

## 停服冷备份 {#cold-backup}

先停服再打包，这样不会漏掉还在写入的数据：

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

看到 `Verified backup` 说明归档已写好、能读出文件列表。旧实例如果还有 `ecoku.env`，脚本会一并打包。

脚本结束后服务仍是停止状态，方便你接着升级或导入。只做日常备份的话，确认成功后启动：

```bash
cd ~/Ecoku
sudo docker compose up -d --wait --wait-timeout 120 ecoku
```

把归档复制到别的机器上保存。它和数据库一样敏感：不要提交到 Git，不要放在公开目录。

自定义了数据库路径的话，备份实际数据库所在的整个目录（密钥文件在同一目录）。

## 从备份恢复 {#restore}

恢复会丢掉备份之后的所有评论和设置修改。

在新主机上恢复时，先装好 Docker 和 Compose，创建 `~/Ecoku/backups/`，把归档复制进去，不需要先启动一个空实例。

把下面的 `REPLACE-WITH-YOUR-BACKUP.tar.gz` 换成你的归档文件名。脚本会先检查归档、停服，把现有文件移到 `before-restore.*` 目录里留着，再解压归档并启动。归档里的 `compose.yaml` 会把镜像也恢复到备份时的版本。

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

恢复后登录后台，确认站点、历史评论、通知和验证设置都在。健康接口只说明进程在运行，不检查数据。

任何一步出错就停下，查看容器日志和 `before-restore.*` 里的原文件，不要删掉原数据重试。

两个常见的启动错误：

- `通知凭据校验失败`：`ecoku-secrets.json` 和数据库不是同一份备份。
- `持久密钥文件权限过宽；请设为 600`：`ecoku-secrets.json` 的权限需要是 `600`。

## 回滚与 schema

回滚到旧版本前，先读目标版本的升级说明。两个版本的 schema 不同时，只能用升级前的冷备份恢复，见 [升级 · 回滚](./upgrade#rollback)。
