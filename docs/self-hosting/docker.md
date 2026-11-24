# Docker 安装

这是生产环境的完整安装步骤，比 [快速上手](../guide/quick-start) 多了资源限制、配置说明和排错方法。已经在运行的实例请看 [升级](./upgrade)。

<div class="page-meta">
<div>

**你会完成**

- 用 Docker Compose 运行 Ecoku
- 取得管理员临时密码并首次登录

</div>
<div>

**开始之前**

- Linux 主机，Docker Engine 和 Compose v2.17+，`sudo` 权限
- 一个给 Ecoku 单独用的域名，不和博客共用
- 同一台主机上的 Caddy 或 Nginx

</div>
</div>

完成后，部署目录是这样的：

```text
~/Ecoku/
├── compose.yaml
├── app/
│   └── config.yaml
└── data/                  # 由 Ecoku 创建和写入
    ├── ecoku.sqlite3
    ├── ecoku.sqlite3-wal
    ├── ecoku.sqlite3-shm
    └── ecoku-secrets.json
```

<div class="steps">

### 创建目录

容器以 UID/GID `10001:10001` 运行，只有 `data/` 需要可写：

```bash
mkdir -p ~/Ecoku/app ~/Ecoku/data
cd ~/Ecoku
sudo chown -R 10001:10001 data
sudo chmod 750 data
```

### 写 compose.yaml

```yaml
services:
  ecoku:
    image: "ghcr.io/dejavumoe/ecoku:v0.6.3"
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
      test: ["CMD", "/app/ecoku-server", "healthcheck"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    stop_grace_period: 30s
```

- 镜像写精确版本号，不要用 `latest`。
- 端口只绑定 `127.0.0.1`，外网要经过反向代理。换宿主机端口只改冒号前的部分。
- `TZ` 和 `ECOKU_ADMIN_LOCALE` 见 [时区与后台语言](#timezone)。

### 写 app/config.yaml {#config}

新部署只需要一行：

```yaml
notifications:
  instance_public_url: "https://ecoku.example.com"
```

把地址换成 Ecoku 自己的 HTTPS 地址（不是博客地址），然后让容器能读取它：

```bash
chmod 644 ~/Ecoku/app/config.yaml
```

其他配置项都有默认值。想了解全部选项，看 [配置文件](../reference/configuration)。

### 启动 {#start}

```bash
cd ~/Ecoku
sudo docker compose pull
sudo docker compose up -d --wait --wait-timeout 120
sudo docker compose ps
```

最后一行应显示 `healthy`。第一次启动会创建数据库、管理员账户 `admin`，以及保存密钥的 `data/ecoku-secrets.json`。

没有变成 `healthy` 时，用 `sudo docker compose logs --tail=100 ecoku` 查看原因，常见情况见 [常见问题](../reference/faq#deploy)。

### 取得管理员临时密码 {#temporary-password}

Ecoku 没有默认密码，日志里也不会打印密码。停下服务，用一次性命令生成临时密码：

```bash
cd ~/Ecoku
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku admin reset-password
sudo docker compose up -d --wait --wait-timeout 120
```

在输出里找到 `管理员临时密码：…`，记下冒号后的内容。这行只出现在这次命令的终端里，`docker compose logs` 看不到。弄丢了就再运行一次。

::: details 提示「管理员账户尚未初始化」
命令打开的数据库里还没有账户。检查当前目录、`config.yaml` 和 `data/` 是否属于这个实例；全新实例要先完成上一步的启动。不要删除数据库或 `ecoku-secrets.json`。
:::

### 配置 HTTPS

按 [反向代理与 HTTPS](./reverse-proxy) 配好 Caddy 或 Nginx，确认 `https://ecoku.example.com/api/health` 能打开。

### 首次登录 {#first-sign-in}

打开 `https://ecoku.example.com/admin/`，用户名 `admin`，密码是上面的临时密码。

登录后先设置正式密码：至少 12 个字符，不超过 72 个 UTF-8 字节，不能与临时密码相同。用户名可以顺便改掉。保存后会打开「新增站点」表单，接着看 [站点设置](../admin/sites)。

</div>

## 时区与后台语言 {#timezone}

这两项写在 `compose.yaml` 的 `environment` 里，改完运行 `sudo docker compose up -d` 生效。

| 变量 | 作用 | 取值 |
| --- | --- | --- |
| `TZ` | 评论区、后台和通知里时间的显示时区 | IANA 时区名，如 `Asia/Shanghai`、`Europe/Berlin`。默认 `Asia/Shanghai`。 |
| `ECOKU_ADMIN_LOCALE` | 管理后台的界面语言 | `zh-CN`、`zh-Hant` 或 `en`。无法识别时使用 `zh-CN`。 |

评论区的语言在后台每个站点里单独设置，见 [站点设置](../admin/sites)。

## 下一步

<div class="cards">
<Card title="登记站点" link="/admin/sites" icon="globe">在后台添加你的博客，得到站点 ID。</Card>
<Card title="设置备份" link="/self-hosting/backup" icon="database">数据库和密钥文件要一起备份。</Card>
</div>
