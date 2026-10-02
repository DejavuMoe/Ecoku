# Ecoku

自托管的多站点纯文本评论系统，适合静态博客和个人网站。

- 一个 Docker 容器，所有数据在一个 SQLite 文件里；
- 评论只有纯文本，提交后直接公开，没有审核队列；
- 访客不用注册，身份只在浏览器中加密保存 7 天；
- 一个实例可以服务多个网站；
- 可选邮件 / Telegram 通知，以及 Cloudflare Turnstile 或自托管 Cap 人机验证。

当前版本：`v0.3.0`，镜像 `git.via.moe/dejavu/ecoku:v0.3.0`。

文档：<https://ecoku.zsh.moe>

## 快速开始

完整步骤见 [Docker 部署](docs/self-hosting/docker.md)。简要流程：

1. 在服务器上创建 `~/Ecoku`，准备 `compose.yaml`、`app/config.yaml` 和 `ecoku.env`。仓库根目录的 [`compose.yaml`](compose.yaml) 与 [`deploy/`](deploy/) 中的模板可以直接参考。
2. `sudo docker compose up -d` 启动，服务监听宿主机 `127.0.0.1:12123`。
3. 用 Caddy 或 Nginx 为它配置 HTTPS 域名，见[反向代理](docs/self-hosting/reverse-proxy.md)。
4. 打开 `https://你的域名/admin/`，注册站点，见[管理后台](docs/self-hosting/admin.md)。
5. 在文章模板中加入接入代码：

```html
<section
  id="ecoku-comments"
  class="ecoku-shell"
  data-ecoku-comments
  data-server-url="https://ecoku.example.com"
  data-site-id="blog"
  data-page-key="/posts/hello-world/"
  data-page-title="你好，世界"
>
  <div class="ecoku-loader" data-ecoku-loader hidden>
    <p class="ecoku-loader-status" data-ecoku-status></p>
    <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>重新加载评论</button>
  </div>
  <div id="ecoku-mount" data-ecoku-mount></div>
</section>
<script src="https://ecoku.example.com/client/ecoku-loader.js" defer></script>
```

## 文档

- 指南：[简介](docs/guide/introduction.md) · [功能](docs/guide/features.md) · [工作方式](docs/guide/concepts.md)
- 部署：[Docker 部署](docs/self-hosting/docker.md) · [反向代理](docs/self-hosting/reverse-proxy.md) · [管理后台](docs/self-hosting/admin.md) · [通知](docs/self-hosting/notifications.md) · [人机验证](docs/self-hosting/captcha.md) · [备份与恢复](docs/self-hosting/backup.md) · [升级](docs/self-hosting/upgrade.md) · [从 Twikoo 迁移](docs/self-hosting/twikoo.md) · [常见问题](docs/self-hosting/faq.md)
- 接入：[HTML 接入](docs/integration/html.md) · [JavaScript SDK](docs/integration/sdk.md) · [Hugo PaperMod](docs/integration/hugo.md) · [自定义样式](docs/integration/custom-css.md) · [Smoji 表情包](docs/integration/smoji.md)
- 参考：[配置参考](docs/reference/configuration.md) · [命令行](docs/reference/cli.md) · [REST API](docs/reference/api.md)

文档另有[繁體中文](docs/zh-hant/)、[English](docs/en/) 与[日本語](docs/ja/)版本。

## 不提供的功能

富文本与 Markdown、访客账号与头像、点赞与表情回应、审核队列、MySQL / PostgreSQL 都不在 Ecoku 的范围内。

## 开发

本地开发环境见 [docs/contribute/local-dev.md](docs/contribute/local-dev.md)，变更记录见 [CHANGELOG.md](CHANGELOG.md)。

## 许可证

[MIT](LICENSE)
