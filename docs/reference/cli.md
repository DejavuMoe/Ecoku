# 命令行

镜像里的程序是 `/app/ecoku-server`。不带参数时启动服务，带子命令时执行一次性任务后退出。

在部署目录里用 `docker compose run`，子命令会使用和服务相同的配置和挂载：

```bash
cd ~/Ecoku
sudo docker compose run --rm --no-deps ecoku <子命令> [参数]
```

::: warning
子命令名写错时不会报错，而是照常启动服务。运行前核对拼写。
:::

会写数据库的子命令（`admin reset-password`、`captcha disable`、`import-twikoo`），先用 `sudo docker compose stop ecoku` 停掉服务再运行。

除 `healthcheck` 和 `hash-password` 外，子命令都会打开数据库。打开时如果数据库版本较旧，会先执行迁移，也会做和服务启动时相同的 [来源检查](./configuration#reload)。所以刚换了新镜像、还没升级数据库时，先停服冷备份再运行任何子命令。

## healthcheck {#healthcheck}

检查正在运行的服务是否响应，Compose 的健康检查用的就是它。v0.6.0 起提供。手动执行：

```bash
sudo docker compose exec -T ecoku /app/ecoku-server healthcheck
```

它请求 `http://127.0.0.1:12123/api/health`，2 秒超时，返回 200 时退出码为 0，否则为 1，成功时没有输出。容器内端口不是 12123 时加 `--port=端口`。

要用 `exec` 在正在运行的容器里执行。用 `run` 新开的容器里没有运行中的服务，检查必然失败。

## admin reset-password {#admin-reset-password}

给管理员账户生成一个新的临时密码，用于第一次登录或忘记密码。新实例要先启动过一次，账户才存在。

```bash
(
set -eu
cd ~/Ecoku
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku admin reset-password
sudo docker compose up -d --wait --wait-timeout 120
)
```

命令输出 `管理员临时密码：…`，同时让所有已登录的会话失效。用户名不变。用临时密码登录后，需要重新设置正式密码，也可以顺便改用户名。

临时密码只出现在这次命令的终端输出里，`docker compose logs` 里没有。提示 `管理员账户尚未初始化` 时，见 [Docker 部署](../self-hosting/docker#temporary-password)。

## captcha status

显示当前的人机验证设置，服务运行时也可以执行：

```bash
sudo docker compose run --rm --no-deps ecoku captcha status
```

输出一行，例如：

```text
provider=turnstile turnstile_secret_set=true cap_secret_set=false
```

## captcha disable {#captcha-disable}

关闭人机验证。验证服务出问题、你登不进后台时用它。

```bash
(
set -eu
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku captcha disable
sudo docker compose up -d --wait --wait-timeout 120 ecoku
)
```

已保存的 Turnstile 和 Cap 配置都会保留，登录后在「安全」页修好再启用。已经是关闭状态时输出 `CAPTCHA 已处于关闭状态`。

## import-twikoo

把 Twikoo 的 JSON 导出导入到一个还没有评论的站点。完整步骤见 [从 Twikoo 迁移](../self-hosting/twikoo)。

先加 `--dry-run` 预检：

```bash
(
set -eu
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku \
  import-twikoo --site=blog --file=/data/twikoo.json --dry-run
)
```

确认结果后，去掉 `--dry-run` 正式导入：

```bash
(
set -eu
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku \
  import-twikoo --site=blog --file=/data/twikoo.json
sudo docker compose up -d --wait --wait-timeout 120 ecoku
)
```

| 参数 | 说明 |
| --- | --- |
| `--site` | 目标站点 ID，必须已在后台注册且没有任何评论（包括已删除的）。 |
| `--file` | 容器内的文件路径。把文件放进 `data/` 目录，容器里的路径就是 `/data/...`。 |
| `--dry-run` | 完整执行一遍后回滚，只输出统计，不保存。 |

成功时最后一行是统计结果：

```text
Twikoo 导入预检通过：评论=128 根评论=90 回复=38 页面=24 邮箱=110 网站=45 缺失父记录=0
Twikoo 导入完成：评论=128 根评论=90 回复=38 页面=24 邮箱=110 网站=45 缺失父记录=0
```

::: details 内测配置：密码哈希

## hash-password {#hash-password}

从标准输入读一行密码，输出 bcrypt 哈希（cost 10），只用于仍通过 `ECOKU_ADMIN_PASSWORD_HASH` 注入管理员的旧实例。新实例用不到它。

```bash
read -rsp '管理员密码: ' P; echo
printf '%s\n' "$P" | sudo docker run --rm -i ghcr.io/dejavumoe/ecoku:v0.6.3 hash-password
unset P
```

密码不能为空，UTF-8 编码不能超过 72 字节（bcrypt 的上限），超过时命令报错退出。

把输出写进 `ecoku.env` 时请加单引号：

```bash
ECOKU_ADMIN_PASSWORD_HASH='$2a$10$...'
```

然后重建容器使其生效。

:::
