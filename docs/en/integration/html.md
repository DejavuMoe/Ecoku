# HTML embed

Add an HTML snippet and a script to your post template, and any static website can show a comment section. The script `ecoku-loader.js` is served by your Ecoku instance. It reads the attributes on the HTML and then loads the comment component.

Before you start, [register the site](../admin/sites) in the admin console and add your blog's origin to its allowed origins.

## Embed code

Put the code below where the comment section should appear in your post template:

```html
<section
  id="ecoku-comments"
  class="ecoku-shell"
  data-ecoku-comments
  data-server-url="https://ecoku.example.com"
  data-site-id="blog"
  data-page-key="/posts/hello-world/"
  data-page-title="Hello, world"
>
  <div class="ecoku-loader" data-ecoku-loader hidden>
    <p class="ecoku-loader-status" data-ecoku-status></p>
    <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>Reload comments</button>
  </div>
  <div id="ecoku-mount" data-ecoku-mount></div>
</section>
<script src="https://ecoku.example.com/client/ecoku-loader.js" defer></script>
```

Replace:

- The URL in `data-server-url` and `<script src>`: your Ecoku URL;
- `data-site-id`: the site ID registered in the admin console;
- `data-page-key` and `data-page-title`: output the current post's path and title with template variables; see [below](#page-key).

Keep all four child elements with `data-ecoku-*`. `data-ecoku-mount` is where the comment section appears; the other three show an error and the **Reload comments** button when loading fails. You can change the button text.

## Attributes

| Attribute | Required | Description |
| --- | :---: | --- |
| `data-server-url` | Yes | The Ecoku URL, starting with `http://` or `https://` |
| `data-site-id` | Yes | Site ID |
| `data-page-key` | Yes | Page key: a path on the site, at most 512 characters, without `?` or `#` |
| `data-page-title` | No | Post title, used in notifications, at most 200 characters |
| `data-page-size` | No | Root comments per page, 1 to 100, default 10 |
| `data-theme` | No | `auto` (default), `light` or `dark`; see [Light and dark mode](./custom-css#theme) |
| `data-css-url` | No | Replaces the default styles; see [Custom styles](./custom-css) |
| `data-i18n` | No | Comment section language: `zh-CN`, `zh-Hant` or `en`. Overrides the admin site setting |

## Choosing a page key {#page-key}

The page key decides which post a comment belongs to. [Don't change it once it's set](../reference/concepts#page-key). It's usually the post's path on the site:

::: v-pre
| Generator | `data-page-key` |
| --- | --- |
| Hugo | `{{ .RelPermalink }}` |
| Hexo | `<%- url_for(page.path) %>` |
| Jekyll | `{{ page.url }}` |
| Astro | `{Astro.url.pathname}` |
| VitePress | Embed with the [SDK](./sdk#vitepress) and pass `useRoute().path` |
:::

After writing it, view the generated HTML in your browser and confirm that it outputs a stable path such as `/posts/hello-world/`, not a full URL.

The Hugo PaperMod theme has a ready-made template; see [Hugo PaperMod](./hugo).

## How loading works

1. After the page is parsed, the loader reads the attributes on the wrapper. If a required attribute or a `data-ecoku-*` child element is missing, it does nothing and nothing appears on the page.
2. The loader loads `ecoku.umd.js` from its own directory and requests the first page of comments at the same time.
3. If the script fails to load, initialization fails, or it takes longer than 12 seconds, an error and the **Reload comments** button are shown.
4. Once the comment section appears, errors from the comment API (an unregistered origin, rate limiting, a network outage) are shown by the comment section itself as 「评论暂时不可用」 (Comments are temporarily unavailable) with a retry button.

The loader only handles wrappers already on the page when it starts. When a single-page app switches posts, manage the comment section with the [SDK](./sdk).

A page can have several wrappers, each with a different `id` and mount element; `data-css-url` must be the same for all of them.

## CSP for blog pages

If your blog sets a Content Security Policy (CSP), allow:

- `script-src` and `connect-src`: the Ecoku origin, such as `https://ecoku.example.com`;
- The default styles are injected as a `<style>` element. If inline styles aren't allowed, set `data-css-url` to `https://ecoku.example.com/client/ecoku.css` and allow that origin in `style-src`;
- With CAPTCHA enabled: see [CSP for blog pages](../admin/captcha#csp);
- With Smoji enabled: allow the manifest origin in `connect-src` and the image origin in `img-src`.

## Host the loader yourself

You can put `ecoku-loader.js` on your own CDN and change only `<script src>`. The loader loads `ecoku.umd.js` from the same directory, so keep the two files together and update both when you upgrade Ecoku.

## Without the loader

To control when initialization happens yourself, include the UMD file directly:

```html
<link rel="stylesheet" href="https://ecoku.example.com/client/ecoku.css">
<div id="ecoku-mount"></div>
<script src="https://ecoku.example.com/client/ecoku.umd.js"></script>
<script>
  const comments = new Ecoku({
    container: '#ecoku-mount',
    serverURL: 'https://ecoku.example.com',
    siteId: 'blog',
    pageKey: '/posts/hello-world/',
    pageTitle: 'Hello, world',
    cssURL: 'https://ecoku.example.com/client/ecoku.css',
  })
  comments.init().catch(console.error)
</script>
```

The UMD file registers the global variable `Ecoku`. Here the styles are included with `<link>`, and `cssURL` tells the SDK it doesn't need to inject them; remove both and the SDK injects the default styles itself. For options, see [JavaScript SDK](./sdk).
