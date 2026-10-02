# Docker 部署

::: info 升级与配置迁移
本页描述 v0.2.9 的部署方式。v0.2.8 用户升级前请先阅读[升级与旧配置迁移](./upgrade#legacy-config)。升级后可以继续保留旧的 `ecoku.env` 和旧 Compose；迁移完成并确认服务正常后，再删除旧环境变量。
:::

本页从一台空的 Linux 主机开始，用 Docker Compose 跑起 Ecoku。新部署只需要三个部分：`compose.yaml`、`app/config.yaml` 和 `data/`。管理员密码、会话签名密钥和通知加密主密钥都在首次启动时自动生成，不需要手工写进配置文件。

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

`data/` 中的文件由 Ecoku 自动创建。数据库和持久密钥必须一起备份。

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
    image: "git.via.moe/dejavu/ecoku:v0.2.9"
    init: true
    restart: unless-stopped
    container_name: ecoku
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

```yaml
notifications:
  instance_public_url: "https://ecoku.example.com"
```

```bash
chmod 644 ~/Ecoku/app/config.yaml
```

配置反向代理后，如果需要按真实访客地址限流，再加上 `site.trusted_proxies`，见[反向代理](./reverse-proxy#trusted-proxies)。其他配置都有默认值。

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

临时密码只在首次创建账户时生成。重启不会生成新密码，也不会再次覆盖持久密钥。临时密码会出现在 Docker 日志中，能读取 Docker 日志的操作者也能看到它；登录后改密即可使它失效。

确认健康接口：

```bash
curl --fail --silent --show-error http://127.0.0.1:12123/api/health
```

## 5. 首次登录

打开 `https://ecoku.example.com/admin/`，用户名填写 `admin`，密码填写首次启动日志中的临时密码。登录后必须完成首次设置：

- 用户名可以保留 `admin`，也可以改成自己的用户名；
- 新密码至少 12 个字符，最多 72 个 UTF-8 字节；
- 新密码不能继续使用临时密码；
- 完成前不能进入站点、评论、通知或安全页面。

保存成功后，Ecoku 会撤销临时会话并进入「站点」页面，直接打开「新增站点」。

忘记临时密码时，先停服，再运行本机重置命令：

```bash
sudo docker compose down
sudo docker compose run --rm --no-deps ecoku admin reset-password
sudo docker compose up -d
```

命令会打印新的临时密码；已有管理员会话全部失效。

## 时区

新部署不需要 `ecoku.env`。如果需要指定评论和通知的显示时区，可在 Compose 的服务中增加：

```yaml
    environment:
      TZ: Asia/Shanghai
```

旧实例可以继续使用原来的 `ecoku.env`。其中的管理员凭据和密钥会在升级时导入持久状态，迁移步骤见[升级](./upgrade#legacy-config)。

## 下一步

1. [配置反向代理](./reverse-proxy)，让 `https://ecoku.example.com` 可以从公网访问；
2. 在「站点」页面创建第一个站点；
3. 把评论区[嵌入博客页面](../integration/html)。

如果要迁移 Twikoo 历史评论，请先创建站点，再按[从 Twikoo 迁移](./twikoo)操作。
