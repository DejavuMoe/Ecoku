# Hugo PaperMod 接入

在基于 Hugo 与知名主题 **PaperMod** 的静态博客中，集成 Ecoku 评论区仅需修改一个 partial 模板文件。

---

## 1. 覆盖评论模板

PaperMod 支持在站点根目录下通过 `layouts/_partials/comments.html` 覆盖默认评论部分。

在您的 Hugo 站点根目录下创建 `layouts/_partials/comments.html`：

```html
{{- $ecoku := site.Params.ecoku -}}
{{- if and $ecoku $ecoku.server_url $ecoku.site_id -}}
{{- $js := $ecoku.js_url | default (printf "%s/client/ecoku-loader.js" $ecoku.server_url) -}}
<div class="ecoku-container" style="margin-top: 2rem;">
  <section
    id="ecoku-comments"
    class="ecoku-shell"
    data-ecoku-comments
    aria-label="评论区"
    data-server-url="{{ $ecoku.server_url }}"
    data-site-id="{{ $ecoku.site_id }}"
    data-page-key="{{ .RelPermalink }}"
    data-page-title="{{ .Title }}"
    data-page-size="10"
    data-theme="auto"
    {{- with $ecoku.css_url }} data-css-url="{{ . }}"{{ end }}
  >
    <div class="ecoku-loader" data-ecoku-loader hidden>
      <p class="ecoku-loader-status" data-ecoku-status></p>
      <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>重新加载评论</button>
    </div>
    <div id="ecoku-mount" data-ecoku-mount></div>
  </section>
  <script src="{{ $js }}" defer></script>
</div>
{{- end }}
```

并在 Hugo 站点配置文件（如 `hugo.yaml`）的 `params` 中加入配置：

```yaml
params:
  comments: true
  ecoku:
    server_url: "https://ecoku.example.com"
    site_id: "blog"
    # 可选：自定义加载器或样式 CDN 地址
    # js_url: "https://ecoku.example.com/client/ecoku-loader.js"
    # css_url: "https://ecoku.example.com/client/ecoku.css"
```

---

## 2. 核心变量解析

- **`data-page-key`**：页面 key 使用 Hugo 的 `.RelPermalink` 输出站内相对路径（例如 `/posts/my-first-post/`），具备极高的唯一性与稳定性。
- **`data-page-title`**：页面标题使用 `.Title` 输出当前文章标题，供邮件和 Telegram 通知精准标识讨论来源。
- **`data-theme="auto"`**：评论区读取 PaperMod 的 `--theme`、`--primary`、`--border` 等颜色变量，并继承页面的 `color-scheme`，因此会跟随主题的日间/夜间切换，包括用 `light-dark()` 定义颜色的主题。

---

## 3. 文章级开关控制

在具体文章的 Markdown Front Matter 中，可通过 `comments` 字段按需开启或关闭该篇的评论区：

```markdown
---
title: "深入理解 Go 语言内存模型"
date: 2026-08-20
comments: true
---
```

---

## 4. 对齐主题样式（可选）

默认样式已经读取 PaperMod 的颜色变量。如果主题还定义了强调色、圆角或字号变量，可以在站点 CSS（例如 `assets/css/extended/comments.css`）中映射到 Ecoku，评论区会随主题一起变化：

```css
.ecoku-comments {
  --ecoku-accent: var(--accent);
  --ecoku-radius: var(--radius);
  --ecoku-font-size: 15px;
  --ecoku-font-size-small: 13px;
}
```

变量名以主题实际定义为准，完整列表见[自定义 CSS](./custom-css.md)。
