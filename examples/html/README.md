# 通用静态网站接入

默认把这段 HTML 放到文章模板里，把 `server_url`、`site_id` 和稳定的 `data-page-key`
换成自己的值。加载器脚本默认来自 Ecoku 容器，样式由 SDK 注入，站点不必再复制 JS。

见 [`comments.html`](comments.html)。Hexo、Jekyll、Astro 等生成器使用同一段标记，
只换各自的页面 key / 标题插值。Hugo PaperMod 见 [`../hugo-papermod`](../hugo-papermod)。

加载失败时外壳会显示错误和「重新加载评论」。未填写 `server_url` 或 `site_id` 时应渲染
「评论服务尚未配置。」，不要放加载中文案。

## 指定 JS / CSS URL

- JS：把 `<script src>` 换成自己的加载器地址，仍须能解析到同目录的 `ecoku.umd.js`。
- CSS：给外壳加上 `data-css-url`。设置后 SDK 不再注入默认样式，加载器会插入对应
  `<link>`。可用：
  - `https://comments.example.com/client/ecoku.css`（与默认注入相同）
  - `https://comments.example.com/client/ecoku.unstyled.css`（只保留结构，自己写外观）
  - 自己的样式表 URL
  - `none`：不注入也不加载文件，完全自写 CSS

自定义样式只作用于评论区前端，与管理端无关。

## 机器人验证与 CSP

验证方式由 Ecoku 管理端统一选择，HTML 接入片段不放 Sitekey 或 Secret。Turnstile 模式需要宿主 CSP 允许 `https://challenges.cloudflare.com`；自托管 Cap 模式需要把实际 Cap HTTPS Origin（文档占位 `https://cap.example.com`）加入 `script-src` 和 `connect-src`，允许 `worker-src blob:`、`frame-src 'self'` 与 WebAssembly。若使用 nonce CSP，在加载器之前用同一 nonce 设置 `window.CAP_CSS_NONCE` 和 `window.CAP_SCRIPT_NONCE`。同时在 Cap Key 的 CORS 中登记本页面实际 Origin。
