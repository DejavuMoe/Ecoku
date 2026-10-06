# 命令行

镜像的入口程序是 `/app/ecoku-server`。不带参数时启动服务；带下面的子命令时执行一次性任务后退出。子命令名写错时不会报错，而是照常启动服务，运行前请核对拼写。

在部署目录中，用 `docker compose run` 以相同的配置和挂载运行子命令：

```bash
cd ~/Ecoku
sudo docker compose run --rm --no-deps ecoku <子命令> [参数]
```

除 `hash-password` 外，子命令都会读取 `app/config.yaml` 并打开数据库；如果数据库版本低于当前镜像，还会先执行迁移。请先用 `sudo docker compose stop ecoku` 停止服务再运行，避免和正在运行的实例同时写库。

## admin reset-password {#admin-reset-password}

为持久化管理员账户生成新的临时密码。先停止正在运行的服务：

```bash
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku admin reset-password
sudo docker compose up -d
```

命令输出 `管理员临时密码：…`，并撤销所有管理员会话。用户名保持不变；用它和临时密码登录后，设置页会预填当前用户名，可以保留或修改，再设置正式密码。

## captcha status

显示当前的人机验证设置：

```bash
sudo docker compose run --rm --no-deps ecoku captcha status
```

输出一行，例如：

```text
provider=turnstile turnstile_secret_set=true cap_secret_set=false
```

## captcha disable {#captcha-disable}

关闭人机验证。用于验证服务配置错误、导致管理员无法登录后台的情况。

```bash
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku captcha disable
sudo docker compose up -d
```

已保存的 Turnstile 与 Cap 配置和密钥都会保留，登录后台后可以直接在「安全」页修正并重新启用。已经是关闭状态时输出 `CAPTCHA 已处于关闭状态`，不做任何修改。

## import-twikoo

把 Twikoo 的 JSON 导出导入到一个没有任何评论的站点。

先加 `--dry-run` 预检：

```bash
sudo docker compose run --rm --no-deps ecoku \
  import-twikoo --site=blog --file=/data/twikoo.json --dry-run
```

确认结果后去掉 `--dry-run` 正式导入：

```bash
sudo docker compose run --rm --no-deps ecoku \
  import-twikoo --site=blog --file=/data/twikoo.json
```

| 参数 | 说明 |
| --- | --- |
| `--site` | 目标站点 ID，必须已在后台注册且没有任何评论（包括已删除的）。 |
| `--file` | 容器内的导出文件路径。文件需要先放进 `data/` 目录（方法见[从 Twikoo 迁移](../self-hosting/twikoo)），容器内路径为 `/data/...`。 |
| `--dry-run` | 完整执行一遍导入后回滚，只输出统计，不保存评论。 |

成功时最后一行输出统计（行首带日期时间）。预检显示「预检通过」，正式导入显示「完成」，例如：

```text
Twikoo 导入预检通过：评论=128 根评论=90 回复=38 页面=24 邮箱=110 网站=45 缺失父记录=0
Twikoo 导入完成：评论=128 根评论=90 回复=38 页面=24 邮箱=110 网站=45 缺失父记录=0
```

完整步骤、字段映射和注意事项见[从 Twikoo 迁移](../self-hosting/twikoo)。

::: details 内测配置：密码哈希

## hash-password {#hash-password}

从标准输入读取一行密码，输出 bcrypt 哈希（cost 10），用于旧实例的 `ECOKU_ADMIN_PASSWORD_HASH`。新实例首次启动会自动生成管理员，不需要执行此命令。不读取配置，也不访问数据库，服务运行中也可以执行。

```bash
read -rsp '管理员密码: ' P; echo
printf '%s\n' "$P" | sudo docker run --rm -i ghcr.io/dejavumoe/ecoku:v0.3.6 hash-password
unset P
```

密码不能为空，UTF-8 编码不能超过 72 字节（bcrypt 的上限），超过时命令报错退出。

把输出写进 `ecoku.env` 时请加单引号：

```bash
ECOKU_ADMIN_PASSWORD_HASH='$2a$10$...'
```

然后重建容器使其生效。

:::
