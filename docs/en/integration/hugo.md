# Hugo PaperMod

The [PaperMod](https://github.com/adityatelange/hugo-PaperMod) theme has a placeholder for a comments template, so you can integrate Ecoku by overriding one partial. The repository's `examples/hugo-papermod/` directory has a complete example.

## 1. Add the comments template

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

The template uses `.RelPermalink` as the page key (such as `/posts/my-first-post/`) and `.Title` as the post title. If `server_url` or `site_id` is not set, it shows "Comments are not configured." so you notice the missing configuration.

## 2. Add the site config

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

`params.comments: true` turns on the comment section for all posts. For a post that should not have comments, write `comments: false` in its front matter:

```yaml
---
title: "About this site"
comments: false
---
```

## 3. Register the origin

In the Ecoku admin console, add an allowed origin for this site, such as `https://blog.example.com`. If you preview locally with `hugo server`, add `http://localhost:1313` as well.

## Appearance

The default styles read PaperMod's color variables (`--theme`, `--entry`, `--primary`, `--secondary`, `--content`, `--border`, `--code-bg`) and follow the theme's light/dark switch, so you usually do not need any extra setup.

To further match corner radius, font size, or accent color, create a CSS file under `assets/css/extended/`. PaperMod bundles it into the site styles automatically:

```css
.ecoku-comments {
  --ecoku-radius: 8px;
  --ecoku-font-size: 16px;
  --ecoku-accent: #b4532a;
}
```

See [Custom styles](./custom-css#variables) for all available variables.

The `assets/css/extended/ecoku.css` in the example directory only styles the loading failure message and the retry button. Copy it if you need it.
