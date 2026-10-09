# JavaScript SDK

[HTML integration](./html) suits static websites where every post is a separate page. In single-page apps built with Vue, React, and similar frameworks, the page does not reload when the reader switches posts, so the comment section has to switch along with it. In that case, use the SDK directly.

## Get the SDK {#install}

[ecoku](https://www.npmjs.com/package/ecoku) version `0.4.1` is available on npm, with ESM, CommonJS and TypeScript declarations. It mounts comments in the browser and connects to your Ecoku server; installing the package does not deploy a server.

```bash
pnpm add --save-exact ecoku@0.4.1
```

Without npm, load the instance UMD file with `<script src="https://ecoku.example.com/client/ecoku.umd.js"></script>` and use the global `Ecoku` constructor. For static article pages prefer the [HTML loader](./html).

## Create a comment section

```js
import Ecoku from 'ecoku'
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
| `serverURL` | `string` | Yes | — | The Ecoku address, starting with `http://` or `https://`. It may include a path, but not a username and password, a query string or `#`. |
| `siteId` | `string` | Yes | — | The site ID created in the admin console. |
| `pageKey` | `string` | Yes | — | The current post's page key: a site-relative path of 1 to 512 characters, without `?` or `#`. The SDK does not infer it from the URL; you must pass it explicitly. |
| `pageTitle` | `string` | No | `''` | The post title, shown in notifications, at most 200 characters. |
| `pageSize` | `number` | No | `10` | Root comments per page, an integer from 1 to 100. |
| `theme` | `'auto' \| 'light' \| 'dark'` | No | `'auto'` | `auto` reads host color variables, falling back to the system preference. Map variables for manual theme switches, as in the VitePress example below. |
| `i18n` | `'zh-CN' \| 'zh-Hant' \| 'en'` | No | Site default | Comment language: SDK option → site setting → `zh-CN`. The default placeholder, empty-state message and blogger badge follow the language; text the site customized is shown as written. |
| `cssURL` | `string` | No | `''` | When empty, the default styles are injected. A valid value (a stylesheet URL or `'none'`) stops the injection. See below. |

The constructor does not validate options; invalid options make `init()` throw a `TypeError`.

- `pageTitle` in the constructor options is cut to its first 200 UTF-16 code units. A title passed to `setPageKey()` is not truncated; the server checks it against a limit of 200 Unicode characters.
- `cssURL` accepts only an absolute HTTP(S) URL, a path starting with `/`, `none` or the legacy value `-`.
- The old option `apiBaseUrl` is an alias of `serverURL`. It still works but is deprecated. If both are set and point to different addresses, `init()` throws a `TypeError`.

### Styles {#styles}

- `cssURL` empty: the SDK injects the default styles into the comment section. You do not need to include any CSS.
- `cssURL` set to a stylesheet URL: the SDK stops injecting styles and **does not** load that URL for you. Add a `<link rel="stylesheet">` to the page yourself. (The HTML loader adds it automatically; the SDK does not.)
- `cssURL` set to `'none'`: no styles are injected, and your CSS alone decides the appearance.

You can use the instance's `/client/ecoku.css` (the same as the default styles) or `/client/ecoku.unstyled.css` (layout only). See [Custom styles](./custom-css).

## Instance methods

### `init(options?)`

Mounts the comment section, restores the saved visitor identity and loads the first page of comments concurrently. The returned Promise waits for comment loading to finish, without waiting for optional identity restoration; a late identity result does not overwrite edited inputs.

- If you pass `options`, they replace the options given to the constructor.
- On an instance that is already initialized, calling it again returns immediately: nothing is mounted twice, and any `options` you pass are ignored.
- A container can be used by only one instance at a time; otherwise it throws. Call `destroy()` on the old instance first.
- If mounting fails, the instance destroys itself, so you can fix the problem and call `init()` again.

### `setPageKey(pageKey, pageTitle?)`

Switches to another post's comment section. Call it after a route change in a single-page app. It must be called after `init()`; otherwise it throws.

- If the page key is the same as the current one, only the comments are reloaded.
- If it differs, in-flight requests are canceled, open reply boxes are closed, the comment box is cleared, and the first page of the new page is loaded.
- **Pass the new post's title as the second argument.** If you omit it, the title is cleared rather than kept from the previous post; otherwise notifications for new comments would show the wrong post name. Call it after both the route and the title have been updated.
- The title passed here is not truncated. If it is longer than 200 characters, the server rejects the comment submission.

### `reload()`

Reloads the comments on the current page, keeping the sort order. It must be called after `init()`; otherwise it throws.

### `destroy()`

Unmounts the comment section: cancels all requests, removes the verification widget and event listeners, and empties the container. Call it when your component unmounts.

### `isInitialized()`

Returns whether the instance is currently initialized.

## VitePress {#vitepress}

The comments at the bottom of this documentation site are embedded with the SDK: they use `ecoku@0.4.1`, the server address `https://ecoku-dev.zsh.moe/` and the site ID `ecoku-docs`. For your own website, replace those two values and add the website's origin to the site's allowed origins in the Ecoku admin console.

In `.vitepress/theme/EcokuComments.vue`, import `useRoute` from VitePress, not `vue-router`. Use the route path as the stable page key and page data for the title. Create the instance on browser mount, update it when navigating and destroy it on unmount.

The VitePress theme switch does not change the system color preference. Map comment colors to VitePress variables as shown below to follow light, dark and manual theme changes without recreating the instance or clearing drafts.

```vue
<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useData, useRoute } from 'vitepress'
import Ecoku from 'ecoku'

const route = useRoute()
const { page } = useData()
const el = ref(null)
let comments = null

onMounted(() => {
  comments = new Ecoku({
    container: el.value,
    serverURL: 'https://ecoku.example.com',
    siteId: 'docs',
    pageKey: route.path,
    pageTitle: page.value.title,
  })
  comments.init().catch(console.error)
})

watch(
  () => [route.path, page.value.title],
  ([path, title]) => {
    comments?.setPageKey(path, title).catch(console.error)
  },
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

<style scoped>
:deep(.ecoku-comments) {
  --ecoku-theme: var(--vp-c-bg);
  --ecoku-entry: var(--vp-c-bg-alt);
  --ecoku-primary: var(--vp-c-text-1);
  --ecoku-secondary: var(--vp-c-text-3);
  --ecoku-content: var(--vp-c-text-2);
  --ecoku-border: var(--vp-c-border);
  --ecoku-border-soft: var(--vp-c-divider);
  --ecoku-code-bg: var(--vp-code-block-bg);
  --ecoku-surface-muted: var(--vp-c-bg-soft);
  --ecoku-accent: var(--vp-c-brand-1);
}
</style>
```

Add the component to the default layout's `doc-after` slot in your existing `.vitepress/theme/index.ts`, keeping your theme options and CSS imports. The minimal version is below. Pages using the home layout do not show this slot.

```ts
import { h } from 'vue'
import DefaultTheme from 'vitepress/theme'
import EcokuComments from './EcokuComments.vue'

export default {
  extends: DefaultTheme,
  Layout: () => h(DefaultTheme.Layout, null, {
    'doc-after': () => h(EcokuComments),
  }),
}
```

## Vue 3

```vue
<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import Ecoku from 'ecoku'

const route = useRoute()
const el = ref(null)
let comments = null

onMounted(() => {
  comments = new Ecoku({
    container: el.value,
    serverURL: 'https://ecoku.example.com',
    siteId: 'blog',
    pageKey: route.path,
    pageTitle: document.title,
  })
  comments.init().catch(console.error)
})

watch(
  () => route.path,
  (path) => { comments?.setPageKey(path, document.title).catch(console.error) },
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
import Ecoku from 'ecoku'

export function Comments({ pageKey, pageTitle }) {
  const el = useRef(null)

  useEffect(() => {
    const comments = new Ecoku({
      container: el.current,
      serverURL: 'https://ecoku.example.com',
      siteId: 'blog',
      pageKey,
      pageTitle,
    })
    comments.init().catch(console.error)
    return () => comments.destroy()
  }, [pageKey, pageTitle])

  return <div ref={el} />
}
```

This component destroys the old instance and creates a new one whenever the post changes, which is the simplest approach. You can also create the instance only once and call `setPageKey(pageKey, pageTitle)` when `pageKey` changes, which avoids remounting.
