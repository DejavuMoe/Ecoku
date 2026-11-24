# 配置参考

Ecoku 读取一个 YAML 文件 `app/config.yaml`，再加上 Compose 里的两个环境变量。新部署只需要填 `instance_public_url`，其余保持默认即可。站点、通知、人机验证和表情包都在管理后台设置，不写在这里。

## 完整模板 {#template}

每一项的默认值、可选值和用途都写在注释里。注释掉的行是可选覆盖项，需要时取消注释。每个顶层段（`site:`、`admin:` 等）只能出现一次。

<div class="config-template">

<<< ../../deploy/config.yaml.example{yaml}

</div>

## 修改后生效 {#reload}

配置不会热加载。改完后重建容器，再看日志：

```bash
(
set -eu
sudo docker compose config --quiet
sudo docker compose up -d --force-recreate --wait --wait-timeout 120 ecoku
)
sudo docker compose logs --tail=100 ecoku
```

未知字段、无效值或重复字段都会让服务拒绝启动，日志会说明是哪一项。

启动时还会检查一件事：管理后台的来源（`instance_public_url` 或 `admin.allowed_origins`）不能和数据库里任何站点的允许来源重复。重复时日志报「管理端来源 … 与已存储的公开站点来源重叠」，服务不启动。解决办法是让管理后台和博客使用不同的域名：在后台改站点来源，或者调整管理域名和反向代理。打开数据库的命令行子命令也做同样的检查。

## 限流 {#rate-limit}

`rate_limit` 下各项按 IP 分别计数，超限时返回 `429` 和 `Retry-After` 头。计数保存在内存里，重启后清零。填 `0` 表示使用默认值，没有办法关闭限流。

Ecoku 在反向代理后面时，一定要配置 [`site.trusted_proxies`](../self-hosting/reverse-proxy#trusted-proxies)，否则所有访客共用一个额度。

## 日志 {#logs}

日志默认写到标准输出，用 `docker compose logs` 查看，保留和轮转交给 Docker。设置 `site.log_path` 为文件路径时，同时写标准输出和这个文件，你需要挂载一个容器可写的目录。

## 环境变量 {#env}

这两项写在 `compose.yaml` 的 `environment` 里：

| 变量 | 说明 |
| --- | --- |
| `TZ` | 评论区、后台和通知的显示时区，IANA 时区名，例如 `Asia/Shanghai`。 |
| `ECOKU_ADMIN_LOCALE` | 后台语言：`zh-CN`、`zh-Hant` 或 `en`，不区分大小写，也接受 `zh-TW`、`en-US` 这样的写法。无法识别时使用 `zh-CN`。 |

评论区的语言不受它们影响，在后台每个站点的「评论区语言」里设置。

模板里以 `_env` 结尾的字段填的是环境变量的名字，不是值。新部署会自动创建管理员和密钥，不需要注入这些变量。镜像已经设置了 `GIN_MODE=release` 和 `ECOKU_RUNTIME=container`，不要覆盖。

## 站点种子与数据库 {#legacy}

`sites` 段只在创建全新数据库时导入一次，之后修改它不会影响已有站点。新部署直接在后台创建站点即可。

数据库和同目录的 `ecoku-secrets.json` 必须一起备份、一起搬迁。修改数据库路径不会搬迁数据，新路径上会创建一个空数据库。
