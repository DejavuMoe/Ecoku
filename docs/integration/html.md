# 通用 HTML 与 Loader 接入

Ecoku 提供了异步加载器 `ecoku-loader.js`。通过在 HTML 中声明 `data-*` 属性，加载器会自动异步拉取核心 SDK 与样式并完成挂载。

---

## 快速接入示例

在页面的评论区挂载位置插入以下 HTML 结构：

```html
<!-- 评论区容器外壳 -->
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
  <!-- 错误状态与重试按钮容器 (默认隐藏) -->
  <div class="ecoku-loader" data-ecoku-loader hidden>
    <p class="ecoku-loader-status" data-ecoku-status></p>
    <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>重新加载评论</button>
  </div>
  <!-- 实际挂载 DOM -->
  <div id="ecoku-mount" data-ecoku-mount></div>
</section>

<!-- 异步引入加载器脚本 -->
<script src="https://ecoku.example.com/client/ecoku-loader.js" defer></script>
```

---

## HTML `data-*` 属性规范

| 属性名 | 必填 | 类型 | 规范与说明 |
| :--- | :---: | :--- | :--- |
| `data-server-url` | **是** | String | Ecoku 后端服务的绝对 HTTPS 地址（如 `https://ecoku.example.com`）。 |
| `data-site-id` | **是** | String | 在管理后台创建的站点唯一标识符。 |
| `data-page-key` | **是** | String | 当前页面的**稳定站内相对路径**（1～512 字符，如 `/posts/hello-world/`）。严禁使用完整 URL 或带 query/fragment 的参数。 |
| `data-page-title` | 否 | String | 当前页面的文章标题（最多 200 字符），用于在邮件通知中清晰展示来源。 |
| `data-page-size` | 否 | Number | 根评论每页条数（1～100 整数，默认 `10`）。 |
| `data-theme` | 否 | String | 主题模式：`auto`（跟随系统，默认）、`light`（浅色）、`dark`（深色）。 |
| `data-css-url` | 否 | String | 自定义 CSS 地址。可填绝对 URL、站内相对路径，或填 `none` 完全禁用内置样式注入。详见 [自定义 CSS](/integration/custom-css)。 |

---

## 运行机制与优势

1. **延迟执行**：示例中的 `defer` 让加载器在 HTML 解析完成后执行，再异步加载 SDK。
2. **静默加载**：加载过程中不显示任何侵入性的“正在加载…”骨架提示，保持页面清爽。
3. **网络容错与重试**：若因网络波动导致核心 SDK 加载超时（默认 12 秒）或失败，容器会自动激活 `.ecoku-loader` 并展示“重新加载”交互按钮。
4. **自动样式注入**：未指定 `data-css-url` 时，SDK 初始化后会自动注入经过优化的内联完整样式，无需额外引入外部 `<link rel="stylesheet">`。

---

## 手动引入 UMD（不使用 Loader）

如果您希望通过标准的 `<script>` 标签手动控制初始化生命周期，可以直接使用 UMD 产物：

```html
<!-- 1. 引入样式表 -->
<link rel="stylesheet" href="https://ecoku.example.com/client/ecoku.css">

<!-- 2. 挂载容器 -->
<div id="ecoku-mount"></div>

<!-- 3. 引入 UMD 核心脚本 -->
<script src="https://ecoku.example.com/client/ecoku.umd.js"></script>

<!-- 4. 初始化实例 -->
<script>
  const comments = new Ecoku({
    container: '#ecoku-mount',
    serverURL: 'https://ecoku.example.com',
    siteId: 'blog',
    pageKey: window.location.pathname,
    pageTitle: document.title,
    pageSize: 10,
    theme: 'auto',
    cssURL: 'none' // 告知 SDK 样式已由外部 link 引入，避免重复注入
  })

  comments.init().catch(console.error)
</script>
```
