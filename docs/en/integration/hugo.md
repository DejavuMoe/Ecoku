# Hugo PaperMod

The [PaperMod](https://github.com/adityatelange/hugo-PaperMod) theme leaves a partial template for comments; override it to embed Ecoku. A complete example is in the repository's `examples/hugo-papermod/` directory.

<div class="steps">

### Add the comments template

In your Hugo site, create `layouts/_partials/comments.html` (Hugo versions before 0.146 use `layouts/partials/comments.html`):

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
    <p class="ecoku-loader-status" role="status">Comments are not configured.</p>
</section>
{{- end -}}
```

The page key uses `.RelPermalink` (such as `/posts/my-first-post/`), and the title uses `.Title`. If you forget to set `server_url` or `site_id`, the page shows "Comments are not configured."

### Add the site configuration

Add this to `hugo.yaml`:

```yaml
params:
  comments: true
  ecoku:
    # No trailing /
    server_url: "https://ecoku.example.com"
    site_id: "blog"
    # Optional: use a self-hosted loader; defaults to {server_url}/client/ecoku-loader.js
    # js_url: "https://cdn.example.com/ecoku-loader.js"
    # Optional: replace the default styles; see "Custom styles"
    # css_url: "https://ecoku.example.com/client/ecoku.unstyled.css"
```

`params.comments: true` turns on the comment section for all posts. For a post that shouldn't have comments, write `comments: false` in its front matter:

```yaml
---
title: "About this site"
comments: false
---
```

### Register the origin

In the Ecoku admin console, add an allowed origin for this site, such as `https://blog.example.com`. If you preview locally with `hugo server`, add `http://localhost:1313` as well.

`.RelPermalink` includes the subdirectory in `baseURL`. For example, `baseURL: https://example.com/blog/` produces `/blog/posts/…`; in that case, set the Ecoku site URL to `https://example.com`. See [Site URL and page paths](../admin/sites#site-url).

</div>

## Appearance

Ecoku's default styles read PaperMod's color variables directly (`--theme`, `--entry`, `--primary`, `--secondary`, `--content`, `--border`) and follow light/dark switches too, so you usually don't need any extra setup.

To adjust corner radius, font size or accent color, create a CSS file under `assets/css/extended/`. PaperMod bundles it automatically:

```css
.ecoku-comments {
  --ecoku-radius: 8px;
  --ecoku-font-size: 16px;
  --ecoku-accent: #b4532a;
}
```

For all available variables, see [Custom styles](./custom-css#variables).

The `assets/css/extended/ecoku.css` in the example directory only styles the wrapper, the loading failure message and the retry button. Copy it if you need it.
