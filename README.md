# Ecoku

自托管的多站点纯文本评论系统。提交即发布；公共接口不返回邮箱、IP 或管理字段。

生产使用仓库根 `compose.yaml`：端口绑在 `127.0.0.1:12123`，前面用本机 Caddy 或 Nginx 做 HTTPS。公开配置模板在 `deploy/`。

```bash
pnpm docs:dev
```

文档站点（简体中文 / 繁體中文 / English / 日本語）覆盖介绍、特性、Docker 部署、反向代理、后台配置、备份、按版本升级说明与常见问题。源文在 [`docs/`](docs/)。

## 最小 HTML 接入

镜像同源提供 `/client/ecoku-loader.js`。每个页面必须给出容器、`serverURL`、`siteId` 和站内相对路径 `pageKey`。

```html
<section
  id="ecoku-comments"
  class="ecoku-shell"
  data-ecoku-comments
  data-server-url="https://comments.example.com"
  data-site-id="blog"
  data-page-key="/posts/example/"
  data-page-title="示例文章"
>
  <div class="ecoku-loader" data-ecoku-loader hidden>
    <p class="ecoku-loader-status" data-ecoku-status></p>
    <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>重新加载评论</button>
  </div>
  <div id="ecoku-mount" data-ecoku-mount></div>
</section>
<script src="https://comments.example.com/client/ecoku-loader.js" defer></script>
```

Hugo PaperMod 片段见 [`examples/hugo-papermod`](examples/hugo-papermod)，通用 HTML 见 [`examples/html`](examples/html)。完整接入与宿主 CSP 见文档 [通用 HTML](docs/integration/html.md) 与 [后台配置](docs/self-hosting/admin.md)。

## 仓库结构

- `server/`：Go API、SQLite3、迁移、Twikoo 导入与通知
- `packages/client/`：浏览器 SDK、UMD 与加载器
- `packages/admin/`：同源托管的管理端
- `docs/`：VitePress 文档站点
- `designs/`：已批准设计基线，不进入运行时镜像
- `examples/`、`deploy/`、`compose.yaml`：接入示例与部署模板
- `VERSION`：不带 `v` 的容器版本；发布 tag 必须与其一致
- `CHANGELOG.md`：变更与升级边界

## 开发

本地联调见 [本地开发](docs/contribute/local-dev.md)。提交前由 Woodpecker 跑完整门禁（含 `pnpm docs:build`）。
