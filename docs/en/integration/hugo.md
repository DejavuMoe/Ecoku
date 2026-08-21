# Hugo PaperMod

```yaml
params:
  comments: true
  ecoku:
    server_url: "https://comments.example.com"
    site_id: "blog"
    # js_url: "https://cdn.example.com/ecoku-loader.js"
    # css_url: "https://comments.example.com/client/ecoku.unstyled.css"
```

Merge `examples/hugo-papermod/layouts/_partials/comments.html` into the theme partial you actually use. Production should keep `.RelPermalink` as the page key and `.Title` as the title, with Hugo’s contextual escaping.

Optional shell CSS: `examples/hugo-papermod/assets/css/extended/ecoku.css`.

Before go-live: a normal post, a page with no comments, deep replies, root pagination, mobile, reply mail, CORS rejection of unknown Origins, and 7-day identity restore after refresh. Clearing site data drops identity; there is no extra wipe button.

The image-hosted loader tracks the current protocol (including Cap). Pinned old SDKs must be updated before you select Cap.
