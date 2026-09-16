# Plain HTML & Loader Integration

Ecoku provides a lightweight asynchronous loader `ecoku-loader.js`. By declaring `data-*` attributes in your HTML, the loader automatically pulls the core SDK and stylesheet asynchronously before mounting the comment widget.

---

## Quick Start Example

Insert the following HTML structure at your comment mount point:

```html
<!-- Comment shell container -->
<section
  id="ecoku-comments"
  class="ecoku-shell"
  data-ecoku-comments
  data-server-url="https://ecoku.example.com"
  data-site-id="blog"
  data-page-key="/posts/hello-world/"
  data-page-title="Hello World"
  data-page-size="10"
  data-theme="auto"
>
  <!-- Error status and retry button container (hidden by default) -->
  <div class="ecoku-loader" data-ecoku-loader hidden>
    <p class="ecoku-loader-status" data-ecoku-status></p>
    <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>Reload Comments</button>
  </div>
  <!-- Actual DOM mount point -->
  <div id="ecoku-mount" data-ecoku-mount></div>
</section>

<!-- Asynchronously load loader script -->
<script src="https://ecoku.example.com/client/ecoku-loader.js" defer></script>
```

---

## HTML `data-*` Attributes Specification

| Attribute | Required | Type | Specification & Notes |
| :--- | :---: | :--- | :--- |
| `data-server-url` | **Yes** | String | Absolute HTTPS URL of the Ecoku backend service (e.g. `https://ecoku.example.com`). |
| `data-site-id` | **Yes** | String | Unique site ID configured in the admin console. |
| `data-page-key` | **Yes** | String | Stable site-relative path of the current page (1–512 chars, e.g. `/posts/hello-world/`). Never pass full URLs, query parameters, or hash anchors. |
| `data-page-title` | No | String | Current article title (up to 200 chars), displayed in notification emails. |
| `data-page-size` | No | Number | Root comments per page (integer 1–100, default: `10`). |
| `data-theme` | No | String | Theme mode: `auto` (system preference, default), `light`, or `dark`. |
| `data-css-url` | No | String | Custom CSS URL. Can be an absolute URL, relative path, or `none` to disable built-in stylesheet injection. See [Custom CSS](/en/integration/custom-css). |

---

## Architecture & Benefits

1. **Deferred Execution**: The example uses `defer` to execute the loader after HTML parsing, then load the SDK asynchronously.
2. **Silent Loading**: No intrusive "Loading..." spinners or skeleton flashes; the comment area mounts seamlessly once assets are ready.
3. **Fault Tolerance & Interactive Retry**: If network instability causes the SDK to fail or exceed the 12-second timeout, the `.ecoku-loader` activates automatically with an interactive retry button.
4. **Automatic Style Injection**: Unless `data-css-url="none"` is specified, the SDK automatically injects optimized inline styles on initialization, eliminating the need for an extra `<link rel="stylesheet">`.

---

## Manual UMD Integration (Without Loader)

If you prefer to manage the lifecycle manually via standard script tags, use the direct UMD build:

```html
<!-- 1. Include default stylesheet -->
<link rel="stylesheet" href="https://ecoku.example.com/client/ecoku.css">

<!-- 2. Mount point container -->
<div id="ecoku-mount"></div>

<!-- 3. Core UMD script -->
<script src="https://ecoku.example.com/client/ecoku.umd.js"></script>

<!-- 4. Initialize instance -->
<script>
  const comments = new Ecoku({
    container: '#ecoku-mount',
    serverURL: 'https://ecoku.example.com',
    siteId: 'blog',
    pageKey: window.location.pathname,
    pageTitle: document.title,
    pageSize: 10,
    theme: 'auto',
    cssURL: 'none' // Informs SDK styles are externally linked, preventing duplicate injection
  })

  comments.init().catch(console.error)
</script>
```
