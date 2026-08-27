# Hugo PaperMod

サイト設定でコメントを有効にし、サービス URL とサイト ID を入れます。

```yaml
params:
  comments: true
  ecoku:
    server_url: "https://comments.example.com"
    site_id: "blog"
    # js_url: "https://comments.example.com/client/ecoku-loader.js"
    # css_url: "https://comments.example.com/client/ecoku.unstyled.css"
```

属性の意味と詳細は [汎用 HTML](/ja/integration/html)。page key は `.RelPermalink`、タイトルは `.Title`。完全 URL に変えないでください。

テーマが実際に使う `comments` partial で：

```html
{{- $ecoku := site.Params.ecoku -}}
{{- if and $ecoku $ecoku.server_url $ecoku.site_id -}}
{{- $js := $ecoku.js_url | default (printf "%s/client/ecoku-loader.js" $ecoku.server_url) -}}
<section
    id="ecoku-comments"
    class="ecoku-shell"
    data-ecoku-comments
    aria-label="コメント欄"
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
        <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>コメントを再読み込み</button>
    </div>
    <div id="ecoku-mount" data-ecoku-mount></div>
</section>
<script src="{{ $js }}" defer></script>
{{- else -}}
<section class="ecoku-shell" aria-label="コメント欄">
    <p class="ecoku-loader-status" role="status">コメントサービスはまだ設定されていません。</p>
</section>
{{- end -}}
```

`css_url` 未設定時は SDK の既定インラインスタイルを使います。カスタムは [カスタム CSS](/ja/integration/custom-css)。
