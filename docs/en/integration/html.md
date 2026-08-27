# Plain HTML

Put one comment container on each page. `data-page-key` is a stable site-relative path for the current page:

- On a static site, insert the current page’s path / permalink in the template.
- For hand-written HTML, give each page a unique, stable relative path.

`/posts/example/` in the sample is a rendered key—not a value every page must copy. Do not use a full URL or an address with query / fragment.

## Attributes

| Attribute | Required | Notes |
| --- | --- | --- |
| `data-server-url` | Yes | Absolute `http(s)` URL of the comment service |
| `data-site-id` | Yes | Site ID created in the admin UI |
| `data-page-key` | Yes | Site-relative path, 1–512 characters |
| `data-page-title` | No | ≤200 characters |
| `data-page-size` | No | Root comments per page, 1–100, default 10 |
| `data-theme` | No | `auto` / `light` / `dark` |
| `data-css-url` | No | See [Custom CSS](/en/integration/custom-css) |

## Loader example

```html
<section
  id="ecoku-comments"
  class="ecoku-shell"
  data-ecoku-comments
  data-server-url="https://comments.example.com"
  data-site-id="blog"
  data-page-key="/posts/example/"
  data-page-title="Example post"
  data-page-size="10"
  data-theme="auto"
>
  <div class="ecoku-loader" data-ecoku-loader hidden>
    <p class="ecoku-loader-status" data-ecoku-status></p>
    <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>Reload comments</button>
  </div>
  <div id="ecoku-mount" data-ecoku-mount></div>
</section>
<script src="https://comments.example.com/client/ecoku-loader.js" defer></script>
```

The loader reads these attributes, loads the SDK, and initializes; on failure it shows status and retry. It does not show extra copy while loading. If required attributes are missing, the loader skips. Never put an admin token or management key on the page.

Without `data-css-url`, the SDK **inlines** the default comment styles (it does not automatically request `/client/ecoku.css`). For custom styling see [Custom CSS](/en/integration/custom-css).

## Without the loader

When you load UMD and CSS yourself, pass `cssURL: 'none'` so the SDK does not inject default styles again:

```html
<link rel="stylesheet" href="https://comments.example.com/client/ecoku.css">
<div id="ecoku-mount"></div>

<script src="https://comments.example.com/client/ecoku.umd.js"></script>
<script>
  const comments = new Ecoku({
    container: '#ecoku-mount',
    serverURL: 'https://comments.example.com',
    siteId: 'blog',
    pageKey: '/posts/example/',
    pageTitle: 'Example post',
    pageSize: 10,
    theme: 'auto',
    cssURL: 'none'
  })

  comments.init().catch(console.error)
</script>
```

`ecoku.umd.js` exposes global `Ecoku`. This path has no loader failure-retry UI. For Hugo see [Hugo PaperMod](/en/integration/hugo).
