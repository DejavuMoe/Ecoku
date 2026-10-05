# Docker 部署

本页适用于 v0.3.4 及后续公开版本，镜像使用 GHCR。已有实例请先阅读 [升级说明](./upgrade)。

本页从一台空的 Linux 主机开始，用 Docker Compose 部署 Ecoku。新部署只需要三样东西：`compose.yaml`、`app/config.yaml` 和 `data/`。管理员临时密码、会话签名密钥和通知加密主密钥都在首次启动时自动生成，不需要写进配置文件。

## 开始之前

你需要：

- 一台装有 Docker Engine 与 Compose v2 的 Linux 主机，以及 `sudo` 权限；
- 一个专门给 Ecoku 使用的域名，例如 `ecoku.example.com`；
- 一个反向代理，用来终止公网 HTTPS。

`instance_public_url` 必须手工填写。Ecoku 不会从不可信的 Host 或转发头推断管理后台来源。

部署目录如下：

```text
~/Ecoku/
├── compose.yaml
├── app/
│   └── config.yaml
└── data/
    ├── ecoku.sqlite3
    ├── ecoku.sqlite3-wal
    ├── ecoku.sqlite3-shm
    └── ecoku-secrets.json
```

`data/` 中的文件由 Ecoku 自动创建。数据库和持久密钥必须一起备份，见 [备份与恢复](./backup)。

## 1. 准备目录

容器以 UID/GID `10001:10001` 运行，只有挂载的 `data` 可写：

```bash
mkdir -p ~/Ecoku/app ~/Ecoku/data
cd ~/Ecoku
sudo chown -R 10001:10001 data
sudo chmod 750 data
```

## 2. 创建 compose.yaml

```yaml
services:
  ecoku:
    image: "ghcr.io/dejavumoe/ecoku:v0.3.4"
    init: true
    restart: unless-stopped
    container_name: ecoku
    environment:
      TZ: Asia/Shanghai
      ECOKU_ADMIN_LOCALE: zh-CN
    ports:
      - "127.0.0.1:12123:12123"
    volumes:
      - ./app/config.yaml:/app/config.yaml:ro
      - ./data:/data
    deploy:
      resources:
        limits:
          memory: 384M
    read_only: true
    tmpfs:
      - /tmp:rw,noexec,nosuid,nodev,size=16m
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--output-document=-", "http://127.0.0.1:12123/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    stop_grace_period: 30s
```

端口只绑定 `127.0.0.1`。如果需要更换宿主机端口，只改冒号前面的部分，例如 `"127.0.0.1:8080:12123"`；容器内端口始终是 `12123`。日志写到标准输出，用 `docker compose logs` 查看，Docker 负责日志保留和轮转。

## 3. 创建 app/config.yaml {#config}

下面的模板列出全部配置项及其默认值、可选值和示例。把 `instance_public_url` 改成 Ecoku 自己的 HTTPS 地址，其他未注释的值保持默认即可。注释中的赋值是可选覆盖项，需要时再取消注释，并按注释同步挂载或端口。

<div class="config-template">

<<< ../../deploy/config.yaml.example{yaml}

</div>

让容器中的非 root 用户可以读取配置：

```bash
chmod 644 ~/Ecoku/app/config.yaml
```

## 4. 启动

```bash
cd ~/Ecoku
sudo docker compose config --quiet
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail=100 ecoku
```

首次启动时，Ecoku 会：

1. 初始化 SQLite 数据库并执行迁移；
2. 生成管理员 `admin`；
3. 生成一次性随机临时密码并打印到日志；
4. 在 `data/ecoku-secrets.json` 保存会话签名密钥和通知加密主密钥。

日志中对应的一行是 `Ecoku 首次启动管理员账户：admin；临时密码：…；请登录后台后立即修改密码`。临时密码只在首次创建账户时生成，重启不会生成新密码，也不会覆盖持久密钥。能读取 Docker 日志的人都能看到临时密码，首次登录改密后它即失效。

确认健康接口：

```bash
curl --fail --silent --show-error http://127.0.0.1:12123/api/health
```

## 5. 首次登录

打开后台前，请先按[为 Ecoku 域名配置 HTTPS 反向代理](./reverse-proxy)完成 Caddy 或 Nginx 配置，并确认公网健康接口可以访问。容器默认只监听宿主机回环端口，不能直接从外网打开。

打开 `https://ecoku.example.com/admin/`，用户名填写 `admin`，密码填写首次启动日志中的临时密码。登录后会进入「设置你的密码」页面，必须先完成设置：

- 用户名可以保留 `admin`，也可以改成自己的用户名；
- 新密码至少 12 个字符，最多 72 个 UTF-8 字节；
- 新密码不能继续使用临时密码；
- 完成前不能进入站点、评论、通知或安全页面。

保存后，Ecoku 会撤销临时会话，并直接打开「站点」页面的「新增站点」表单。

忘记临时密码或正式密码时，先停服，再在主机上运行重置命令：

```bash
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku admin reset-password
sudo docker compose up -d
```

命令输出 `管理员临时密码：…`，并使已有管理员会话全部失效。用户名保持当前值；用它和新的临时密码登录后，同样需要重新设置密码。

## 时区与后台语言 {#timezone}

上面的 Compose 已设置 `TZ: Asia/Shanghai` 和 `ECOKU_ADMIN_LOCALE: zh-CN`：

- `TZ` 决定评论区和通知中的时间显示，填写 IANA 时区名，例如 `Asia/Shanghai`、`Europe/Berlin`。
- `ECOKU_ADMIN_LOCALE` 决定管理后台语言，可选 `zh-CN`、`zh-Hant` 或 `en`。无法识别的值会在启动日志中提示，并改用 `zh-CN`。

修改后执行 `sudo docker compose up -d` 重建容器，不需要另建 `ecoku.env`。评论区语言不在这里设置：它取自后台站点设置的「评论区语言」，接入代码中加载器的 `data-i18n` 或 SDK 的 `i18n` 参数可以覆盖。

旧实例可以继续使用原来的 `ecoku.env`。如需删除旧管理员凭据和密钥变量，请按[导入持久状态、停服备份并移除旧变量](./upgrade#legacy-config)操作。如果时区仍写在旧环境文件里，先把 `TZ` 移到 Compose，再删除该文件。

## 下一步

1. 在后台[创建第一个站点](./admin#sites)，取得接入所需的站点 ID；
2. 按 [HTML 接入步骤](../integration/html)把评论区嵌入博客页面；
3. 按[备份与恢复](./backup)备份配置、数据库和持久密钥。

如果要迁移 Twikoo 历史评论，请先创建站点，再按[从 Twikoo 迁移](./twikoo)操作。
