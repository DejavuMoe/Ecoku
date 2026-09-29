# JavaScript SDK

[HTML integration](./html) suits static websites where every post is a separate page. In single-page apps built with Vue, React, and similar frameworks, the page does not reload when the reader switches posts, so the comment section has to switch along with it. In that case, use the SDK directly.

## Get the SDK

Every Ecoku instance serves the SDK at `/client/ecoku.umd.js`. Once loaded, it registers the global variable `Ecoku`.

::: info The npm package is not published yet
The SDK's package name is `ecoku`, but it has not been published to npm yet, so `npm install ecoku` does not work. If you need ES modules or TypeScript types, build it yourself from the `packages/client` directory of the source repository (`pnpm build`). The output is in `dist/`.
:::

In a single-page app, you can use a function that loads the UMD file on demand and makes sure it is loaded only once:

```js
const ECOKU_URL = 'https://ecoku.example.com'
let ecokuPromise

export function loadEcoku() {
  if (window.Ecoku) return Promise.resolve(window.Ecoku)
  ecokuPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `${ECOKU_URL}/client/ecoku.umd.js`
    script.async = true
    script.onload = () => (window.Ecoku ? resolve(window.Ecoku) : reject(new Error('Ecoku did not load')))
    script.onerror = () => {
      ecokuPromise = undefined
      script.remove()
      reject(new Error('Failed to load Ecoku'))
    }
    document.head.append(script)
  })
  return ecokuPromise
}
```

## Create a comment section

```js
const Ecoku = await loadEcoku()
const comments = new Ecoku({
  container: '#comments',
  serverURL: 'https://ecoku.example.com',
  siteId: 'blog',
  pageKey: '/posts/hello-world/',
  pageTitle: 'Hello, world',
})
await comments.init()
```

### Options

| Option | Type | Required | Default | Description |
| --- | --- | :---: | --- | --- |
| `container` | `string \| HTMLElement` | Yes | — | Where to mount: a CSS selector or a DOM element. The container's existing content is replaced. |
| `serverURL` | `string` | Yes | — | The Ecoku address, starting with `http://` or `https://`, without a query string or `#`. |
| `siteId` | `string` | Yes | — | The site ID registered in the admin console. |
| `pageKey` | `string` | Yes | — | The current post's page key, 1 to 512 characters. The SDK does not infer it from the URL; you must pass it explicitly. |
| `pageTitle` | `string` | No | `''` | The post title, shown in notifications, at most 200 characters. |
| `pageSize` | `number` | No | `10` | Root comments per page, an integer from 1 to 100. |
| `theme` | `'auto' \| 'light' \| 'dark'` | No | `'auto'` | Color scheme. `auto` follows the page's light/dark setting. |
| `cssURL` | `string` | No | `''` | When empty, the default styles are injected. Any value (a stylesheet URL or `'none'`) stops the injection. See below. |

The constructor does not validate options; invalid options make `init()` throw a `TypeError`.

The old option `apiBaseUrl` is an alias of `serverURL`. It still works but is deprecated.

### Styles {#styles}

- `cssURL` empty: the SDK injects the default styles into the comment section. You do not need to include any CSS.
- `cssURL` set to a stylesheet URL: the SDK stops injecting styles and **does not** load that URL for you. Add a `<link rel="stylesheet">` to the page yourself. (The HTML loader adds it automatically; the SDK does not.)
- `cssURL` set to `'none'`: no styles are injected, and your CSS alone decides the appearance.

You can use the instance's `/client/ecoku.css` (the same as the default styles) or `/client/ecoku.unstyled.css` (layout only). See [Custom styles](./custom-css).

## Instance methods

### `init(options?)`

Mounts the comment section, restores the visitor identity saved in the browser, and loads the first page of comments. Returns a Promise.

- If you pass `options`, they replace the options given to the constructor.
- Calling it again on an instance that is already initialized does not mount it twice.
- A container can be used by only one instance at a time; otherwise it throws. Call `destroy()` on the old instance first.

### `setPageKey(pageKey, pageTitle?)`

Switches to another post's comment section. Call it after a route change in a single-page app.

- If the page key is the same as the current one, only the comments are reloaded.
- If it differs, in-flight requests are canceled, open reply boxes are closed, the comment box is cleared, and the first page of the new page is loaded.
- **Pass the new post's title as the second argument.** If you omit it, the title is cleared rather than kept from the previous post; otherwise notifications for new comments would show the wrong post name. Call it after both the route and the title have been updated.
- The title passed here is not truncated. If it is longer than 200 characters, the server rejects the comment submission.

### `reload()`

Reloads the comments on the current page, keeping the sort order.

### `destroy()`

Unmounts the comment section: cancels all requests, removes the verification widget and event listeners, and empties the container. Call it when your component unmounts.

### `isInitialized()`

Returns whether the instance is currently initialized.

## Vue 3

```vue
<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { loadEcoku } from './load-ecoku'

const route = useRoute()
const el = ref(null)
let comments = null

onMounted(async () => {
  const Ecoku = await loadEcoku()
  comments = new Ecoku({
    container: el.value,
    serverURL: 'https://ecoku.example.com',
    siteId: 'blog',
    pageKey: route.path,
    pageTitle: document.title,
  })
  await comments.init()
})

watch(
  () => route.path,
  (path) => comments?.setPageKey(path, document.title),
  { flush: 'post' },
)

onBeforeUnmount(() => {
  comments?.destroy()
  comments = null
})
</script>

<template>
  <div ref="el"></div>
</template>
```

`document.title` must already be updated to the new post's title after the route changes. If the title is set asynchronously by other code, pass the title from your post data instead.

## React

```jsx
import { useEffect, useRef } from 'react'
import { loadEcoku } from './load-ecoku'

export function Comments({ pageKey, pageTitle }) {
  const el = useRef(null)

  useEffect(() => {
    let comments
    let cancelled = false
    loadEcoku().then((Ecoku) => {
      if (cancelled) return
      comments = new Ecoku({
        container: el.current,
        serverURL: 'https://ecoku.example.com',
        siteId: 'blog',
        pageKey,
        pageTitle,
      })
      comments.init().catch(console.error)
    })
    return () => {
      cancelled = true
      comments?.destroy()
    }
  }, [pageKey, pageTitle])

  return <div ref={el} />
}
```

This component destroys the old instance and creates a new one whenever the post changes, which is the simplest approach. You can also create the instance only once and call `setPageKey(pageKey, pageTitle)` when `pageKey` changes, which avoids remounting.
