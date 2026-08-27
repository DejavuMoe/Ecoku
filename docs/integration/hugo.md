# Hugo PaperMod

在站点配置中启用评论并填写服务地址与站点 ID：

```yaml
params:
  comments: true
  ecoku:
    server_url: "https://comments.example.com"
    site_id: "blog"
    # js_url: "https://comments.example.com/client/ecoku-loader.js"
    # css_url: "https://comments.example.com/client/ecoku.unstyled.css"
```

属性含义与完整说明见 [通用 HTML](/integration/html)。页面 key 使用 `.RelPermalink`，标题使用 `.Title`；不要改成完整 URL。

在主题实际使用的 `comments` partial 中：

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

未设置 `css_url` 时使用 SDK 默认内联样式。自定义见 [自定义 CSS](/integration/custom-css)。
