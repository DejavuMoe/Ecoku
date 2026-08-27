# Hugo PaperMod

Enable comments in the site config and set the service URL and site ID:

```yaml
params:
  comments: true
  ecoku:
    server_url: "https://comments.example.com"
    site_id: "blog"
    # js_url: "https://comments.example.com/client/ecoku-loader.js"
    # css_url: "https://comments.example.com/client/ecoku.unstyled.css"
```

Attribute meanings and full notes are in [Plain HTML](/en/integration/html). Page key uses `.RelPermalink`; title uses `.Title`. Do not switch them to full URLs.

In the theme’s actual `comments` partial:

```html
{{- $ecoku := site.Params.ecoku -}}
{{- if and $ecoku $ecoku.server_url $ecoku.site_id -}}
{{- $js := $ecoku.js_url | default (printf "%s/client/ecoku-loader.js" $ecoku.server_url) -}}
<section
    id="ecoku-comments"
    class="ecoku-shell"
    data-ecoku-comments
    aria-label="Comments"
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
        <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>Reload comments</button>
    </div>
    <div id="ecoku-mount" data-ecoku-mount></div>
</section>
<script src="{{ $js }}" defer></script>
{{- else -}}
<section class="ecoku-shell" aria-label="Comments">
    <p class="ecoku-loader-status" role="status">Comment service is not configured.</p>
</section>
{{- end -}}
```

Without `css_url`, the SDK default inline styles are used. Custom styling: [Custom CSS](/en/integration/custom-css).
