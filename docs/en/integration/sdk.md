# JavaScript SDK

In front-end apps built with Vue, React, VitePress and similar tools, the page doesn't reload when the reader switches posts, so the comment section has to switch along with it. In that case, create and destroy the comment section yourself with the npm package `ecoku`. For ordinary static websites, [HTML embed](./html) is simpler.

The SDK only displays the comment section in the browser; you still need a deployed Ecoku server.

## Install {#install}

```bash
pnpm add --save-exact ecoku@0.6.2
```

The package includes ESM, CommonJS and TypeScript declarations. When you upgrade the Ecoku server, update this dependency to the same version.

Without npm, you can also load `https://ecoku.example.com/client/ecoku.umd.js` from your instance and use the global `Ecoku`.

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
| `container` | `string \| HTMLElement` | Yes | — | Where to mount: a CSS selector or an element. Existing content is replaced. |
| `serverURL` | `string` | Yes | — | The Ecoku URL, starting with `http://` or `https://`. It may include a path, but not a query string or `#`. |
| `siteId` | `string` | Yes | — | Site ID |
| `pageKey` | `string` | Yes | — | Page key: a site path of 1 to 512 characters, without `?` or `#`. The SDK doesn't infer it from the URL; you must pass it. |
| `pageTitle` | `string` | No | `''` | Post title, used in notifications; truncated beyond 200 characters |
| `pageSize` | `number` | No | `10` | Root comments per page, 1 to 100 |
| `theme` | `'auto' \| 'light' \| 'dark'` | No | `'auto'` | Color scheme; see [Light and dark mode](./custom-css#theme) |
| `i18n` | `'zh-CN' \| 'zh-Hant' \| 'en'` | No | Site setting | Comment section language; takes precedence over the admin site setting |
| `cssURL` | `string` | No | `''` | Styles; see below |

`init()` checks the options and returns a rejected Promise if something is wrong. The server checks the full page key rules, so a successful `init()` doesn't guarantee that comments can be submitted.

The old option `apiBaseUrl` is an alias of `serverURL`. It still works but is deprecated.

### Styles {#styles}

| `cssURL` | Result |
| --- | --- |
| Empty | The SDK injects the default styles; no separate CSS is needed |
| A stylesheet URL | The SDK doesn't inject styles and doesn't load this URL for you. Add `<link rel="stylesheet">` to the page yourself. |
| `'none'` | No styles are injected; your CSS controls the look entirely |

The instance serves `/client/ecoku.css` (default styles) and `/client/ecoku.unstyled.css` (layout only). See [Custom styles](./custom-css).

## Instance methods

| Method | Description |
| --- | --- |
| `init(options?)` | Mounts the comment section and loads the first page. Passing `options` replaces the constructor options. Calling it again after initialization does nothing. |
| `setPageKey(pageKey, pageTitle?)` | Switches to another post's comment section. Must be called after `init()`. |
| `reload()` | Reloads the current page of comments |
| `destroy()` | Unmounts the comment section, cancels requests and empties the container. Call it when your component unmounts. |
| `isInitialized()` | Whether it has been initialized |

Keep in mind:

- A container can have only one instance at a time. Before creating a new one, call `destroy()` on the old one.
- Pass the new post's title as the second argument to `setPageKey()`. If you omit it, the title is cleared and notifications for new comments won't include the post name. Call it after both the route and the title have updated.
- Calling `setPageKey()` with an unchanged page key reloads comments but keeps the draft being written; if the page key changes, the comment and reply boxes are cleared.
- When the comment API returns an error, the comment section shows the error and a retry button itself, and the Promises from `init()`, `reload()` and `setPageKey()` may still resolve normally. Don't use them to judge whether the service is healthy.

## Using it with frameworks {#frameworks}

In the examples below, the server URL and site ID are placeholders. Replace them with your own, and add your site's origin to the site's allowed origins.

### VitePress {#vitepress}

This site embeds comments this way. Use VitePress's own `useRoute` (don't import it from `vue-router`), use the route path as the page key, and put the component in the default layout's `doc-after` slot. The styles map the comment section colors to VitePress variables, so the comment section follows light and dark mode switches.

::: code-group

```vue [.vitepress/theme/EcokuComments.vue]
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
    siteId: 'your-site-id',
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

```ts [.vitepress/theme/index.ts]
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

:::

### Astro {#astro}

Put the SDK in a plain `<script>` in the component template; Astro bundles it and runs it in the browser. Don't put it in the `---` block at the top, and don't add `is:inline`, `define:vars` or `type="module"`.

::: code-group

```astro [src/components/EcokuComments.astro]
---
interface Props {
  pageKey: string
  pageTitle: string
}

const { pageKey, pageTitle } = Astro.props
---

<ecoku-comments data-page-key={pageKey} data-page-title={pageTitle}></ecoku-comments>

<script>
  import Ecoku from 'ecoku'

  class EcokuComments extends HTMLElement {
    private comments: Ecoku | null = null

    connectedCallback() {
      if (this.comments) return
      this.comments = new Ecoku({
        container: this,
        serverURL: 'https://ecoku.example.com',
        siteId: 'your-site-id',
        pageKey: this.dataset.pageKey!,
        pageTitle: this.dataset.pageTitle,
      })
      this.comments.init().catch(console.error)
    }

    disconnectedCallback() {
      this.comments?.destroy()
      this.comments = null
    }
  }

  customElements.define('ecoku-comments', EcokuComments)
</script>

<style>
  ecoku-comments { display: block; }
</style>
```

```astro [src/pages/posts/hello-world.astro]
---
import EcokuComments from '../../components/EcokuComments.astro'

const title = 'Hello, world'
---

<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>{title}</title>
  </head>
  <body>
    <main>
      <h1>{title}</h1>
      <p>Article content.</p>
      <EcokuComments pageKey={Astro.url.pathname} pageTitle={title} />
    </main>
  </body>
</html>
```

:::

`Astro.url.pathname` contains only the path; keep trailing slashes consistent. It also works with [ClientRouter](https://docs.astro.build/en/guides/view-transitions/) enabled, but don't add `transition:persist` to the component.

### Vue 3 and React {#vue-react}

::: code-group

```vue [Comments.vue]
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

```jsx [Comments.jsx]
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

:::

- In the Vue example, `document.title` must already be the new title after the route changes. If the title is set asynchronously, take it from the post data instead.
- The React example destroys the old instance and creates a new one when the post changes. You can also create it once and call `setPageKey(pageKey, pageTitle)` when `pageKey` changes.
