# Docker 部署

本页适用于 v0.5.4 及后续公开版本，镜像使用 GHCR。已有实例请先阅读 [升级说明](./upgrade)。

本页从一台空的 Linux 主机开始，用 Docker Compose 部署 Ecoku。新部署只需准备：`compose.yaml`、`app/config.yaml` 与 `data/` 目录。首次启动会创建管理员账户并生成持久密钥；登录用的临时密码由下面的重置命令输出，不需要写进配置文件。

## 开始之前

你需要：

- 一台装有 Docker Engine 与 Compose 的 Linux 主机，以及 `sudo` 权限；Compose 须支持 `up --wait --wait-timeout`（可用 `docker compose up --help` 检查）；
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
    image: "ghcr.io/dejavumoe/ecoku:v0.5.4"
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

端口只绑定 `127.0.0.1`。如果需要更换宿主机端口，只改冒号前面的部分，例如 `"127.0.0.1:8080:12123"`，不用改容器内端口。确实要改容器监听端口时，按 [配置模板](#config) 的说明同时修改 `site.port`、Compose 的容器端口和健康检查。日志写到标准输出，用 `docker compose logs` 查看，Docker 负责日志保留和轮转。

## 3. 创建 app/config.yaml {#config}

下面的模板列出全部配置项及其默认值、可选值和示例。把 `instance_public_url` 改成 Ecoku 自己的 HTTPS 地址，其他未注释的值保持默认即可。注释中的赋值是可选覆盖项，需要时再取消注释，并按注释同步挂载或端口。

<div class="config-template">

<<< ../../deploy/config.yaml.example{yaml}

</div>

让容器中的非 root 用户可以读取配置：

```bash
chmod 644 ~/Ecoku/app/config.yaml
```

## 4. 启动并等待初始化完成 {#start}

```bash
(
set -eu
cd ~/Ecoku
sudo docker compose config --quiet
sudo docker compose pull
sudo docker compose up -d --wait --wait-timeout 120
sudo docker compose ps
)
```

命令成功后，容器状态应为 `healthy`。`--wait` 会等待健康检查通过，最多等待 120 秒；退出报错或容器未健康时，先运行 `sudo docker compose logs --tail=100 ecoku` 排查，修正后重试，不要继续重置密码。

首次启动会初始化 SQLite、创建管理员 `admin`，并把会话签名密钥和通知加密主密钥保存到 `data/ecoku-secrets.json`。重启不会重置管理员密码，也不会覆盖持久密钥。

## 5. 取得管理员临时密码 {#temporary-password}

**新部署必须完成这一步。自 v0.5.2 起，启动日志不提供初始密码，也没有固定默认密码。** 先完成 [启动与健康检查](#start)，再在部署主机终端执行：

```bash
(
set -eu
cd ~/Ecoku
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku admin reset-password
sudo docker compose up -d --wait --wait-timeout 120
)
```

在这次命令的终端输出中找到 `管理员临时密码：…`，保存冒号后的临时密码。密码由 `docker compose run` 的一次性容器输出；`docker compose logs ecoku` 查看的是服务容器日志，无法找回它。丢失时重新执行本步，会生成新密码并使旧密码与全部管理员会话失效。不要把终端输出转发到共享日志或工单。

如果没有看到这行输出，先处理命令报错，再重试；上面的命令组遇错会停止。提示 `管理员账户尚未初始化` 时，检查是否使用了正确的部署目录、配置和数据挂载；全新实例须先完成 [第 4 步](#start)。不能通过删除数据库或持久密钥来解决。

已有正式账户的实例升级时不需要执行本步。旧实例若仍未完成首次改密，则应执行本步：仅升级不会使旧日志中的临时密码失效。

## 6. 首次登录 {#first-sign-in}

先完成 [取得管理员临时密码](#temporary-password)，再按 [为 Ecoku 域名配置 HTTPS 反向代理](./reverse-proxy) 完成 Caddy 或 Nginx 配置，并确认公网健康接口可以访问。容器默认只监听宿主机回环端口，不能直接从外网打开。`notifications.instance_public_url` 必须与实际后台地址的来源一致；不要保留示例域名。

打开 `https://ecoku.example.com/admin/`，用户名填写 `admin`，密码填写刚才命令输出的临时密码。登录后会进入「设置你的密码」页面，必须先完成设置：

- 用户名可以保留 `admin`，也可以改成自己的用户名；
- 新密码至少 12 个字符，最多 72 个 UTF-8 字节；
- 新密码不能继续使用临时密码；
- 完成前不能进入站点、评论、通知或安全页面。

保存后，Ecoku 会撤销临时会话，并直接打开「站点」页面的「新增站点」表单。

忘记临时密码或正式密码时，使用同样的 [管理员密码重置步骤](../reference/cli#admin-reset-password)。用户名保持当前值；用它和新的临时密码登录后，同样需要重新设置密码。

## 时区与后台语言 {#timezone}

上面的 Compose 已设置 `TZ: Asia/Shanghai` 和 `ECOKU_ADMIN_LOCALE: zh-CN`：

- `TZ` 决定评论区和通知中的时间显示，填写 IANA 时区名，例如 `Asia/Shanghai`、`Europe/Berlin`。
- `ECOKU_ADMIN_LOCALE` 决定管理后台语言，可选 `zh-CN`、`zh-Hant` 或 `en`。无法识别的值会在启动日志中提示，并改用 `zh-CN`。

修改后执行 `sudo docker compose up -d` 重建容器，不需要另建 `ecoku.env`。评论区语言不在这里设置：它取自后台站点设置的「评论区语言」，接入代码中加载器的 `data-i18n` 或 SDK 的 `i18n` 参数可以覆盖。

旧实例可以继续使用原来的 `ecoku.env`。如需删除旧管理员凭据和密钥变量，请按 [导入持久状态、停服备份并移除旧变量](./upgrade#legacy-config) 操作。如果时区仍写在旧环境文件里，先把 `TZ` 移到 Compose，再删除该文件。

## 下一步

1. 在后台 [创建第一个站点](./admin#sites)，取得接入所需的站点 ID；
2. 按 [HTML 接入步骤](../integration/html) 把评论区嵌入博客页面；
3. 按 [备份与恢复](./backup) 备份配置、数据库和持久密钥。

如果需要迁移 Twikoo 历史评论，请先创建站点，再按 [从 Twikoo 迁移](./twikoo) 操作。
