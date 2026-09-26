# Hugo PaperMod Integration

Integrating Ecoku into a static blog powered by Hugo and the popular **PaperMod** theme requires overriding just a single partial template.

---

## 1. Override Comments Partial

PaperMod allows overriding its default comment partial by placing a template at `layouts/partials/comments.html` (or `layouts/_partials/comments.html`) in your Hugo site root.

Create `layouts/partials/comments.html` in your site repository:

```html
{{- $ecoku := site.Params.ecoku -}}
{{- if and $ecoku $ecoku.server_url $ecoku.site_id -}}
{{- $js := $ecoku.js_url | default (printf "%s/client/ecoku-loader.js" $ecoku.server_url) -}}
<div class="ecoku-container" style="margin-top: 2rem;">
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
      <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>Reload Comments</button>
    </div>
    <div id="ecoku-mount" data-ecoku-mount></div>
  </section>
  <script src="{{ $js }}" defer></script>
</div>
{{- end }}
```

Then add the configuration block under `params` in your Hugo site config (e.g. `hugo.yaml`):

```yaml
params:
  comments: true
  ecoku:
    server_url: "https://ecoku.example.com"
    site_id: "blog"
    # Optional: Custom loader or stylesheet CDN URLs
    # js_url: "https://ecoku.example.com/client/ecoku-loader.js"
    # css_url: "https://ecoku.example.com/client/ecoku.css"
```

---

## 2. Core Template Variables

- **`data-page-key`**: Uses Hugo's `.RelPermalink` to output a canonical site-relative path (e.g. `/posts/my-first-post/`), ensuring stability and immutability across protocol or domain migrations.
- **`data-page-title`**: Uses `.Title` to output the article title for clear attribution in notification emails and Telegram alerts.
- **`data-theme="auto"`**: The comment area reads PaperMod colour variables such as `--theme`, `--primary` and `--border`, and inherits the page's `color-scheme`, so it follows the theme's light/dark toggle, including themes that define colours with `light-dark()`.

---

## 3. Post-Level Toggle

In individual post Markdown Front Matter, use the `comments` property to enable or disable discussions for that specific article:

```markdown
---
title: "Understanding Go Concurrency Internals"
date: 2026-08-20
comments: true
---
```

---

## 4. Matching Theme Styles (Optional)

The default stylesheet already reads PaperMod colour variables. If your theme also defines accent, radius or type-size variables, map them to Ecoku in your site CSS (for example `assets/css/extended/comments.css`) so the comment area follows the theme:

```css
.ecoku-comments {
  --ecoku-accent: var(--accent);
  --ecoku-radius: var(--radius);
  --ecoku-font-size: 15px;
  --ecoku-font-size-small: 13px;
}
```

Use the variable names your theme actually defines. See [Custom CSS](./custom-css.md) for the full list.
