# JavaScript SDK Reference

The `ecoku` package provides an official TypeScript / JavaScript SDK suitable for modern frontend tooling (Vite / Webpack / Next.js / Nuxt / Astro / SvelteKit / React / Vue 3).

---

## 1. Installation

```bash
# Using npm
npm install ecoku

# Using pnpm
pnpm add ecoku

# Using yarn
yarn add ecoku
```

---

## 2. Constructor & Configuration Options

```typescript
import Ecoku, { type EcokuConfig } from 'ecoku'

const ecoku = new Ecoku(options: EcokuConfig)
```

### Complete `EcokuConfig` Options

| Property | Type | Required | Default | Description & Constraints |
| :--- | :--- | :---: | :---: | :--- |
| `container` | `string \| HTMLElement` | **Yes** | — | Target container CSS selector (e.g. `#comments`) or DOM Element reference. |
| `serverURL` | `string` | **Yes** | — | Absolute HTTPS URL of the Ecoku backend (e.g. `https://ecoku.example.com`). |
| `siteId` | `string` | **Yes** | — | Unique site identifier (matches regex `/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/`). |
| `pageKey` | `string` | **Yes** | — | Site-relative path identifier (1–512 chars, e.g. `/posts/my-first-post/`). |
| `pageTitle` | `string` | No | `""` | Article title (up to 200 chars), displayed in email and Telegram notifications. |
| `pageSize` | `number` | No | `10` | Root comments per page (integer between 1 and 100). |
| `theme` | `'auto' \| 'light' \| 'dark'` | No | `'auto'` | Theme mode. `'auto'` dynamically follows `prefers-color-scheme`. |
| `cssURL` | `string` | No | `""` | Custom stylesheet URL. Passing `'none'` disables built-in inline style injection. |

---

## 3. Instance Methods

### `init(options?: EcokuConfig): Promise<void>`
Initializes and mounts the comment system.
- Validates configuration options and uses an internal `WeakMap` to enforce that a DOM container cannot be attached to multiple Ecoku instances simultaneously.
- Decrypts and restores saved 7-day visitor credentials from browser IndexedDB.
- Fetches initial comments and server site configuration to render the interface.

### `reload(): Promise<void>`
Refreshes the current page of comments, preserving active sort criteria.

### `setPageKey(newPageKey: string, pageTitle?: string): Promise<void>`
Smoothly switches comment discussions during Single-Page Application (SPA) client-side routing.
- If `newPageKey` matches the active key, triggers a silent `reload()`.
- For a new page, automatically aborts inflight network requests via `AbortController`, closes open reply boxes, resets pagination and form state, and loads page 1 of the new discussion.

### `destroy(): void`
Completely cleans up the instance.
- Detaches the instance from the DOM container.
- Aborts all pending Fetch network requests.
- Unmounts CAPTCHA widgets and removes global event listeners.
- Clears the generated comment DOM tree.

### `isInitialized(): boolean`
Returns a boolean indicating whether the instance is currently initialized and mounted.

---

## 4. Framework Integration Examples

### Vue 3 Composition API

```vue
<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import Ecoku from 'ecoku'

const route = useRoute()
const mountEl = ref<HTMLElement | null>(null)
let ecokuInstance: Ecoku | null = null

onMounted(async () => {
  if (!mountEl.value) return
  ecokuInstance = new Ecoku({
    container: mountEl.value,
    serverURL: 'https://ecoku.example.com',
    siteId: 'blog',
    pageKey: route.path,
    pageTitle: document.title,
    theme: 'auto',
  })
  await ecokuInstance.init()
})

// Listen to SPA route changes and switch page discussions dynamically
watch(() => route.path, (newPath) => {
  ecokuInstance?.setPageKey(newPath, document.title)
}, { flush: 'post' })

onUnmounted(() => {
  ecokuInstance?.destroy()
  ecokuInstance = null
})
</script>

<template>
  <div ref="mountEl" class="comments-wrapper"></div>
</template>
```

### React Hooks

```tsx
import React, { useEffect, useRef } from 'react'
import Ecoku from 'ecoku'

interface CommentProps {
  pageKey: string
  pageTitle?: string
}

export const CommentBox: React.FC<CommentProps> = ({ pageKey, pageTitle }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<Ecoku | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const ecoku = new Ecoku({
      container: containerRef.current,
      serverURL: 'https://ecoku.example.com',
      siteId: 'blog',
      pageKey,
      pageTitle,
      theme: 'auto',
    })

    ecoku.init().catch(console.error)
    instanceRef.current = ecoku

    return () => {
      ecoku.destroy()
      instanceRef.current = null
    }
  }, [pageKey])

  return <div ref={containerRef} />
}
```


Pass the new article title as the second argument; omitting it clears the old title. Call after the host updates the route and article title. In the direct SDK, a nonempty `cssURL` only disables inline CSS injection: add the matching `<link rel="stylesheet">` yourself. Only the hosted loader inserts that stylesheet link.
