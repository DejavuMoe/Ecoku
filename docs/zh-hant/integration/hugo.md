# Hugo PaperMod

在站點設定中啟用評論並填寫服務位址與站點 ID：

```yaml
params:
  comments: true
  ecoku:
    server_url: "https://comments.example.com"
    site_id: "blog"
    # js_url: "https://comments.example.com/client/ecoku-loader.js"
    # css_url: "https://comments.example.com/client/ecoku.unstyled.css"
```

屬性含義與完整說明見 [通用 HTML](/zh-hant/integration/html)。頁面 key 使用 `.RelPermalink`，標題使用 `.Title`；不要改成完整 URL。

在主題實際使用的 `comments` partial 中：

```html
{{- $ecoku := site.Params.ecoku -}}
{{- if and $ecoku $ecoku.server_url $ecoku.site_id -}}
{{- $js := $ecoku.js_url | default (printf "%s/client/ecoku-loader.js" $ecoku.server_url) -}}
<section
    id="ecoku-comments"
    class="ecoku-shell"
    data-ecoku-comments
    aria-label="評論區"
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
        <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>重新載入評論</button>
    </div>
    <div id="ecoku-mount" data-ecoku-mount></div>
</section>
<script src="{{ $js }}" defer></script>
{{- else -}}
<section class="ecoku-shell" aria-label="評論區">
    <p class="ecoku-loader-status" role="status">評論服務尚未設定。</p>
</section>
{{- end -}}
```

未設定 `css_url` 時使用 SDK 預設內嵌樣式。自訂見 [自訂 CSS](/zh-hant/integration/custom-css)。
