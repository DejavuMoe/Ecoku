# Hugo PaperMod

[PaperMod](https://github.com/adityatelange/hugo-PaperMod) 主题预留了评论区模板，覆盖一个 partial 文件就能接入 Ecoku。仓库的 `examples/hugo-papermod/` 目录中有完整示例。

## 1. 添加评论模板

在 Hugo 站点中创建 `layouts/_partials/comments.html`（Hugo 0.146 之前的版本使用 `layouts/partials/comments.html`）：

```html
{{- $ecoku := site.Params.ecoku -}}
{{- if and $ecoku $ecoku.server_url $ecoku.site_id -}}
{{- $js := $ecoku.js_url | default (printf "%s/client/ecoku-loader.js" $ecoku.server_url) -}}
<section
    id="ecoku-comments"
    class="ecoku-shell"
    data-ecoku-comments
    aria-label="评论区"
    aria-busy="false"
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
{{- else -}}
<section class="ecoku-shell" aria-label="评论区">
    <p class="ecoku-loader-status" role="status">评论服务尚未配置。</p>
</section>
{{- end -}}
```

模板用 `.RelPermalink` 作为页面 key（如 `/posts/my-first-post/`），用 `.Title` 作为文章标题。没有填写 `server_url` 或 `site_id` 时，显示「评论服务尚未配置。」，方便发现配置遗漏。

## 2. 添加站点配置

在 `hugo.yaml` 中加入：

```yaml
params:
  comments: true
  ecoku:
    # 结尾不要加 /
    server_url: "https://ecoku.example.com"
    site_id: "blog"
    # 可选：使用自己托管的加载器，默认 {server_url}/client/ecoku-loader.js
    # js_url: "https://cdn.example.com/ecoku-loader.js"
    # 可选：替换默认样式，见「自定义样式」
    # css_url: "https://ecoku.example.com/client/ecoku.unstyled.css"
```

`params.comments: true` 为所有文章开启评论区。某篇文章不需要评论时，在它的 front matter 中写 `comments: false`：

```yaml
---
title: "关于本站"
comments: false
---
```

## 3. 登记来源

在 Ecoku 后台为这个站点添加允许来源，如 `https://blog.example.com`。本地运行 `hugo server` 预览时，把 `http://localhost:1313` 也加进去。

## 外观

默认样式会读取 PaperMod 的颜色变量（`--theme`、`--entry`、`--primary`、`--secondary`、`--content`、`--border`），并跟随主题的明暗切换，通常不需要额外设置。

想进一步统一圆角、字号或强调色，可以在 `assets/css/extended/` 下新建一个 CSS 文件，PaperMod 会自动把它打包进站点样式：

```css
.ecoku-comments {
  --ecoku-radius: 8px;
  --ecoku-font-size: 16px;
  --ecoku-accent: #b4532a;
}
```

所有可用变量见[自定义样式](./custom-css#variables)。

示例目录中的 `assets/css/extended/ecoku.css` 只为外壳、加载失败提示和重试按钮设置样式，不影响评论区本身，可以按需复制。
