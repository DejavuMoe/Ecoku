# HTML integration

Put a snippet of HTML and one script in your post template, and any static website can show a comment section. The script `ecoku-loader.js` is served by your Ecoku instance. It reads the attributes on the HTML and loads the comment component automatically.

Before you start, make sure you have [registered the site](../self-hosting/admin#sites) in the admin console and added your blog's origin to the site's allowed origins.

## Embed code

Put the code below where the comment section should go in your post template, and replace three values:

- `data-server-url`: your Ecoku address;
- `data-site-id`: the site ID registered in the admin console;
- `data-page-key`, `data-page-title`: output the current post's path and title with template variables.

```html
<section
  id="ecoku-comments"
  class="ecoku-shell"
  data-ecoku-comments
  data-server-url="https://ecoku.example.com"
  data-site-id="blog"
  data-page-key="/posts/hello-world/"
  data-page-title="Hello, world"
  data-page-size="10"
  data-theme="auto"
>
  <div class="ecoku-loader" data-ecoku-loader hidden>
    <p class="ecoku-loader-status" data-ecoku-status></p>
    <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>Reload comments</button>
  </div>
  <div id="ecoku-mount" data-ecoku-mount></div>
</section>
<script src="https://ecoku.example.com/client/ecoku-loader.js" defer></script>
```

Keep all four elements with `data-ecoku-*` inside the wrapper: `data-ecoku-mount` is where the comment section is mounted, and the other three show an error message and a retry button if loading fails. You can change the button text.

## Attributes

| Attribute | Required | Description |
| --- | :---: | --- |
| `data-server-url` | Yes | The Ecoku address, such as `https://ecoku.example.com`. It must be a full URL starting with `http://` or `https://`. |
| `data-site-id` | Yes | The site ID registered in the admin console. |
| `data-page-key` | Yes | The current post's page key: a relative path on the site, at most 512 characters, without `?` or `#`. See below. |
| `data-page-title` | No | The post title, shown in notification emails. Anything beyond 200 characters is cut off. |
| `data-page-size` | No | How many root comments to show per page, 1 to 100, default 10. Invalid values are treated as 10. |
| `data-theme` | No | `auto` (default), `light`, or `dark`. `auto` follows the page's light/dark setting. |
| `data-css-url` | No | Replaces the default styles. See [Custom styles](./custom-css). |

## Choose a page key

The page key decides which post a comment belongs to. [Do not change it once it is in use](../guide/concepts#page-key). It is usually the post's path on the site. Here is how common generators write it:

::: v-pre
| Generator | Value of `data-page-key` |
| --- | --- |
| Hugo | `{{ .RelPermalink }}` |
| Hexo | `<%- url_for(page.path) %>` |
| Jekyll | `{{ page.url }}` |
| Astro | `{Astro.url.pathname}` |
| VitePress | Read `useRoute().path` in a custom theme and integrate with the [SDK](./sdk) |
:::

These are for reference only. Look at the generated HTML in your browser and confirm that it outputs a stable path, such as `/posts/hello-world/`, rather than a full URL.

## Loading process

1. After the page is parsed, the loader reads the attributes on the wrapper. If `data-server-url`, `data-site-id`, or `data-page-key` is missing, or any of the four `data-ecoku-*` child elements is missing, it **skips silently**, and nothing appears on the page.
2. The loader loads `ecoku.umd.js` from its own directory and initializes the comment section. No "Loading" text is shown while it loads.
3. If loading or initializing the script takes longer than 12 seconds or fails, an error message and the **Reload comments** button are shown, and the visitor can click to retry.

A page can have more than one wrapper. Each one is initialized independently.

## Host the loader yourself

You can put `ecoku-loader.js` on your own CDN and change only `<script src>`. The loader loads `ecoku.umd.js` from the **same directory**, so keep the two files together and update both when you upgrade Ecoku.

## CSP on blog pages

If your blog sets a Content Security Policy (CSP), you need to allow:

- `script-src` and `connect-src`: the Ecoku origin, such as `https://ecoku.example.com`;
- The default styles are injected as a `<style>` element. If your CSP does not allow inline styles, set `data-css-url` to `https://ecoku.example.com/client/ecoku.css` to use an external stylesheet instead, and allow that origin in `style-src`;
- When CAPTCHA is enabled, you also need to allow the verification service. See [CAPTCHA · Content Security Policy](../self-hosting/captcha#csp).

## Without the loader

You can also include the UMD file directly and control when initialization happens:

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

The UMD file registers the global variable `Ecoku`. The example above includes the styles with `<link>` and uses `cssURL` to tell the SDK not to inject the default styles again. If you remove both, the SDK injects the styles itself. See [JavaScript SDK](./sdk) for the options and methods.
