# Ecoku

自托管的多站点纯文本评论系统，专为静态博客（Hugo / Hexo / Astro / VitePress）与个人站点设计。评论提交后直接发布，无审核队列，极致轻量，数据全量持久化在本地单文件 SQLite3 中。

> **准备发布版本**：`v0.2.4`（等待 master CI 验收与 tag 发布）
> **目标镜像**：`git.via.moe/dejavu/ecoku:v0.2.4`，镜像发布成功后再使用以下部署示例。

---

## 核心设计与特性

- **极简单容器拓扑**：单个 Go 二进制同源提供后端 REST API、嵌入式管理控制台（`/admin/`）与浏览器 SDK / 极简加载器（`/client/`）。
- **提交即发布 · 讨论不中断**：评论无审核队列，提交后立即呈现在被回复评论下方；新回复保留树状语义，最多 16 层后代，视觉端呈现至多 3 级缩进。
- **严格隐私边界**：公共 DTO 绝不暴露访客邮箱、IP、User-Agent、地理位置或管理字段；访客身份在浏览器本地 IndexedDB 中通过 WebCrypto AES-GCM 加密保存 7 天。
- **可撤销管理会话**：HttpOnly Cookie 配合 SQLite 会话记录，登录后固定 8 小时；刷新或关闭重开保留登录，主动退出由服务端撤销。升级到 schema v8 前须停服冷备份，见 [v0.2.4 升级指南](docs/self-hosting/upgrades/v0.2.4.md)。
- **现代化人机验证**：实例级支持三态安全切换（关闭、Cloudflare Turnstile、开源自托管 Cap），全链路动态收敛 CSP 策略。
- **事务一致性异步通知**：基于 SQLite 事务的 Outbox 队列模式，支持 SMTP（TLS/STARTTLS）与 Telegram 机器人通知，按目标拆行重试。
- **极轻量接入**：仅 ~2KB 的无依赖异步加载器 `ecoku-loader.js`，支持原生 HTML、Hugo PaperMod 以及 React / Vue 3。

---

## 快速开始

### 1. Docker Compose 部署

在宿主机创建部署目录并配置运行权限（非 root 用户 `10001:10001`）：

```bash
mkdir -p ~/Ecoku && cd ~/Ecoku
sudo install -d -o 10001 -g 10001 -m 750 app/logs data
```

编写 `compose.yaml`：

```yaml
services:
  ecoku:
    image: "git.via.moe/dejavu/ecoku:v0.2.4"
    init: true
    restart: unless-stopped
    container_name: ecoku
    env_file:
      - ./ecoku.env
    ports:
      - "127.0.0.1:12123:12123"
    volumes:
      - ./app/config.yaml:/app/config.yaml:ro
      - ./app/logs:/var/log/ecoku
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
```

配置 `ecoku.env` 与 `app/config.yaml` 详细指引请参考 [Docker 部署文档](docs/self-hosting/docker.md)。

### 2. 前端嵌入接入 (~2KB Loader)

在您的静态博客或页面模板的评论区插入：

```html
<section
  id="ecoku-comments"
  class="ecoku-shell"
  data-ecoku-comments
  data-server-url="https://ecoku.example.com"
  data-site-id="blog"
  data-page-key="/posts/hello-world/"
  data-page-title="你好，世界"
  data-page-size="10"
  data-theme="auto"
>
  <div class="ecoku-loader" data-ecoku-loader hidden>
    <p class="ecoku-loader-status" data-ecoku-status></p>
    <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>重新加载评论</button>
  </div>
  <div id="ecoku-mount" data-ecoku-mount></div>
</section>

<script src="https://ecoku.example.com/client/ecoku-loader.js" defer></script>
```

---

## 文档索引

- **系统指南**：[系统介绍](docs/guide/introduction.md) · [核心特性](docs/guide/features.md) · [设计概念](docs/guide/concepts.md)
- **运维部署**：[Docker 部署](docs/self-hosting/docker.md) · [反向代理](docs/self-hosting/reverse-proxy.md) · [后台配置](docs/self-hosting/admin.md) · [备份恢复](docs/self-hosting/backup.md) · [升级指南](docs/self-hosting/upgrade.md) · [Twikoo 迁移](docs/self-hosting/twikoo.md) · [常见排错](docs/self-hosting/faq.md)
- **客户端接入**：[HTML / Loader](docs/integration/html.md) · [JavaScript SDK](docs/integration/sdk.md) · [Hugo PaperMod](docs/integration/hugo.md) · [自定义 CSS](docs/integration/custom-css.md) · [Smoji 表情](docs/integration/smoji.md)
- **接口参考**：[REST API 规范](docs/reference/api.md)

---

## 产品边界与约束

- **SQLite3-Only**：专注单机极致轻量与零维护，不引入 MySQL、PostgreSQL 或 Redis。
- **纯文本评论**：不引入富文本、Markdown 复杂渲染（除 Smoji 表情外）、点赞、排行榜或普通用户账户体系。
- **隐私优先**：严禁收集访客客户端 IP 服务信息；管理员凭证与加密主密钥永不外泄。
- **单向迁移**：SQLite schema 迁移原位、顺序、事务化；成功后向 `schema_migrations` 记录版本，不提供自动向下迁移。

SPA 使用 SDK 时调用 `await comments.setPageKey(newPageKey, newPageTitle)` 同步文章标题；省略标题会清空旧值。直接 SDK 的 `cssURL` 需宿主自行加载对应样式，详见 [SDK 接入](docs/integration/sdk.md)。
