# Plain HTML & Loader

Ecoku includes a ~2KB standalone loader `ecoku-loader.js`.

---

## Loader Usage

```html
<section
  id="ecoku-comments"
  class="ecoku-shell"
  data-ecoku-comments
  data-server-url="https://comments.example.com"
  data-site-id="blog"
  data-page-key="/posts/hello-world/"
  data-page-title="Hello World"
  data-page-size="10"
  data-theme="auto"
>
  <div class="ecoku-loader" data-ecoku-loader hidden>
    <p class="ecoku-loader-status" data-ecoku-status></p>
    <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>Retry</button>
  </div>
  <div id="ecoku-mount" data-ecoku-mount></div>
</section>

<script src="https://comments.example.com/client/ecoku-loader.js" defer></script>
```

---

## Direct UMD Initialization

```html
<link rel="stylesheet" href="https://comments.example.com/client/ecoku.css">
<div id="ecoku-mount"></div>

<script src="https://comments.example.com/client/ecoku.umd.js"></script>
<script>
  const comments = new Ecoku({
    container: '#ecoku-mount',
    serverURL: 'https://comments.example.com',
    siteId: 'blog',
    pageKey: window.location.pathname,
    pageTitle: document.title,
    pageSize: 10,
    theme: 'auto',
    cssURL: 'none'
  })

  comments.init().catch(console.error)
</script>
```
