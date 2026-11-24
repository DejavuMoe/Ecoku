# 快速上手

从一台装好 Docker 的 Linux 主机开始，到博客文章下出现评论区。这里只放必需的命令，每一步的完整说明在对应页面。

<div class="page-meta">
<div>

**你会完成**

- 在主机上运行 Ecoku
- 通过 HTTPS 登录管理后台
- 在一篇文章下看到评论区

</div>
<div>

**开始之前**

- Linux 主机，已装 Docker 和 Compose v2.17+
- 一个给 Ecoku 用的域名，如 `ecoku.example.com`
- 主机上装有 Caddy（或 Nginx）

</div>
</div>

<div class="steps">

### 创建部署目录

```bash
mkdir -p ~/Ecoku/app ~/Ecoku/data && cd ~/Ecoku
sudo chown -R 10001:10001 data && sudo chmod 750 data
```

### 写 compose.yaml 和 config.yaml

`compose.yaml`：

```yaml
services:
  ecoku:
    image: "ghcr.io/dejavumoe/ecoku:v0.6.2"
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
```

`app/config.yaml`，把地址换成你给 Ecoku 准备的域名：

```yaml
notifications:
  instance_public_url: "https://ecoku.example.com"
```

```bash
chmod 644 app/config.yaml
```

### 启动并取得管理员密码

先启动一次，让 Ecoku 建好数据库和管理员账户；再停下来生成临时密码：

```bash
sudo docker compose up -d --wait
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku admin reset-password
sudo docker compose up -d --wait
```

记下输出里 `管理员临时密码：` 后面的内容。它不会出现在日志里，丢了就再运行一遍。

### 配置 HTTPS

在 Caddyfile 里加上：

```caddyfile
ecoku.example.com {
    reverse_proxy 127.0.0.1:12123 {
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

重载 Caddy 后，再让 Ecoku 信任来自 Docker 网关的转发头，否则所有访客会共用一个限流额度：

```bash
sudo docker inspect ecoku --format '{{range .NetworkSettings.Networks}}{{.Gateway}}{{end}}'
```

把输出的地址（例如 `172.18.0.1`）写进 `app/config.yaml`，然后重建容器：

```yaml
site:
  trusted_proxies: ["172.18.0.1/32"]
```

```bash
sudo docker compose up -d --force-recreate --wait
```

### 登录并登记博客

打开 `https://ecoku.example.com/admin/`，用 `admin` 和临时密码登录，按提示设置正式密码。

接着在「新增站点」里填：

- **站点 ID**：例如 `blog`，接入代码会用到
- **站点 URL**：`https://blog.example.com`
- **允许来源**：`https://blog.example.com`

### 嵌入评论区

把这段 HTML 放进文章模板里评论区的位置。`data-page-key` 用模板变量输出文章路径，例如 Hugo 的 <code v-pre>{{ .RelPermalink }}</code>。

```html
<section id="ecoku-comments" class="ecoku-shell" data-ecoku-comments
  data-server-url="https://ecoku.example.com"
  data-site-id="blog"
  data-page-key="/posts/hello-world/"
  data-page-title="你好，世界">
  <div class="ecoku-loader" data-ecoku-loader hidden>
    <p class="ecoku-loader-status" data-ecoku-status></p>
    <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>重新加载评论</button>
  </div>
  <div id="ecoku-mount" data-ecoku-mount></div>
</section>
<script src="https://ecoku.example.com/client/ecoku-loader.js" defer></script>
```

打开一篇文章，评论区就出现了。

</div>

## 接下来

<div class="cards">
<Card title="设置备份" link="/self-hosting/backup" icon="database">数据库和密钥文件要一起备份。</Card>
<Card title="开启通知" link="/admin/notifications" icon="bell">有新评论时收到邮件或 Telegram 消息。</Card>
<Card title="设置博主身份" link="/admin/blogger" icon="message">在自己的评论区以博主身份回复。</Card>
<Card title="调整外观" link="/integration/custom-css" icon="sliders">让评论区和博客的配色一致。</Card>
</div>

遇到问题先看 [常见问题](../reference/faq)。生产环境的完整部署说明见 [Docker 安装](../self-hosting/docker)。
