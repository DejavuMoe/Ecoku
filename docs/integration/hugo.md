# Hugo PaperMod

[PaperMod](https://github.com/adityatelange/hugo-PaperMod) 主题给评论区留了一个 partial 模板，覆盖它就能接入 Ecoku。完整示例在仓库的 `examples/hugo-papermod/` 目录。

<div class="steps">

### 添加评论模板

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

页面 key 用 `.RelPermalink`（如 `/posts/my-first-post/`），标题用 `.Title`。忘了配置 `server_url` 或 `site_id` 时，页面上会显示「评论服务尚未配置。」。

### 添加站点配置

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

`params.comments: true` 给所有文章开启评论区。个别文章不要评论时，在它的 front matter 里写 `comments: false`：

```yaml
---
title: "关于本站"
comments: false
---
```

### 登记来源

在 Ecoku 后台给这个站点加上允许来源，如 `https://blog.example.com`。本地用 `hugo server` 预览时，把 `http://localhost:1313` 也加上。

`.RelPermalink` 包含 `baseURL` 里的子目录。例如 `baseURL: https://example.com/blog/` 会生成 `/blog/posts/…`，这时 Ecoku 的站点 URL 填 `https://example.com`，见 [站点 URL 与页面路径](../admin/sites#site-url)。

</div>

## 外观

Ecoku 的默认样式直接读取 PaperMod 的颜色变量（`--theme`、`--entry`、`--primary`、`--secondary`、`--content`、`--border`），明暗切换也会跟着变，一般不用另外设置。

想调整圆角、字号或强调色，在 `assets/css/extended/` 下新建一个 CSS 文件，PaperMod 会自动打包它：

```css
.ecoku-comments {
  --ecoku-radius: 8px;
  --ecoku-font-size: 16px;
  --ecoku-accent: #b4532a;
}
```

所有可用变量见 [自定义样式](./custom-css#variables)。

示例目录里的 `assets/css/extended/ecoku.css` 只给外壳、加载失败提示和重试按钮加了样式，可以按需复制。
