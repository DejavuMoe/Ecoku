# JavaScript SDK

在 Vue、React、VitePress 這類前端應用程式裡，切換文章時頁面不會重新載入，評論區要跟著換。這種情況用 npm 套件 `ecoku` 自己建立和銷毀評論區。一般靜態網站用 [HTML 接入](./html) 更簡單。

SDK 只負責在瀏覽器裡顯示評論區，你仍然需要一個部署好的 Ecoku 服務。

## 安裝 {#install}

```bash
pnpm add --save-exact ecoku@0.6.3
```

套件裡有 ESM、CommonJS 和 TypeScript 型別宣告。升級 Ecoku 伺服器端時，把這個相依套件也更新到同一版本。

不用 npm 的話，也可以載入實例提供的 `https://ecoku.example.com/client/ecoku.umd.js`，然後使用全域的 `Ecoku`。

## 建立評論區

```js
import Ecoku from 'ecoku'

const comments = new Ecoku({
  container: '#comments',
  serverURL: 'https://ecoku.example.com',
  siteId: 'blog',
  pageKey: '/posts/hello-world/',
  pageTitle: '你好，世界',
})
await comments.init()
```

### 設定項

| 設定項 | 型別 | 必填 | 預設值 | 說明 |
| --- | --- | :---: | --- | --- |
| `container` | `string \| HTMLElement` | 是 | — | 掛載位置，CSS 選擇器或元素。原有內容會被替換。 |
| `serverURL` | `string` | 是 | — | Ecoku 的位址，`http://` 或 `https://` 開頭，可以帶路徑，不能帶查詢參數或 `#`。 |
| `siteId` | `string` | 是 | — | 站點 ID |
| `pageKey` | `string` | 是 | — | 頁面 key，1～512 個字元的站內路徑，不帶 `?` 或 `#`。SDK 不會從網址推斷，必須傳入。 |
| `pageTitle` | `string` | 否 | `''` | 文章標題，用於通知，超過 200 個字元會截斷 |
| `pageSize` | `number` | 否 | `10` | 每頁根評論數，1～100 |
| `theme` | `'auto' \| 'light' \| 'dark'` | 否 | `'auto'` | 配色，見 [明暗模式](./custom-css#theme) |
| `i18n` | `'zh-CN' \| 'zh-Hant' \| 'en'` | 否 | 站點設定 | 評論區語言，優先於後台的站點設定 |
| `cssURL` | `string` | 否 | `''` | 樣式，見下文 |

`init()` 會檢查設定，有問題時回傳被拒絕的 Promise。頁面 key 的完整規則由伺服器端檢查，所以 `init()` 成功不代表評論一定能提交。

舊設定項 `apiBaseUrl` 是 `serverURL` 的別名，仍然可用，但已棄用。

### 樣式 {#styles}

| `cssURL` | 結果 |
| --- | --- |
| 留空 | SDK 注入預設樣式，不需要另外引入 CSS |
| 樣式表位址 | SDK 不注入，也不會替你載入這個位址。你要自己在頁面裡加 `<link rel="stylesheet">`。 |
| `'none'` | 不注入任何樣式，外觀完全由你的 CSS 決定 |

實例提供 `/client/ecoku.css`（預設樣式）和 `/client/ecoku.unstyled.css`（只有版面配置）。見 [自訂樣式](./custom-css)。

## 實例方法

| 方法 | 說明 |
| --- | --- |
| `init(options?)` | 掛載評論區並載入第一頁。傳入 `options` 會替換建構時的設定。已初始化時再次呼叫不做任何事。 |
| `setPageKey(pageKey, pageTitle?)` | 切換到另一篇文章的評論區。必須在 `init()` 之後呼叫。 |
| `reload()` | 重新載入目前頁的評論 |
| `destroy()` | 卸載評論區，取消請求，清空容器。元件卸載時呼叫。 |
| `isInitialized()` | 是否已初始化 |

使用時注意：

- 同一個容器同時只能有一個實例。換新實例前，先對舊實例呼叫 `destroy()`。
- `setPageKey()` 的第二個參數請傳新文章的標題。省略時標題會被清空，新評論的通知裡就沒有文章名稱。在路由和標題都更新之後再呼叫。
- 頁面 key 不變時呼叫 `setPageKey()`，會重新載入評論但保留正在寫的草稿；頁面 key 變了，評論框和回覆框會被清空。
- 評論介面出錯時，由評論區自己顯示錯誤和重試按鈕，`init()`、`reload()`、`setPageKey()` 的 Promise 仍可能正常完成。不要拿它們來判斷服務是否健康。

## 在框架中使用 {#frameworks}

下面的範例裡，服務位址和站點 ID 都是預留位置，換成你自己的，並把網站來源加進站點的允許來源。

### VitePress {#vitepress}

本站就是這樣接入的。用 VitePress 內建的 `useRoute`（不要從 `vue-router` 匯入），以路由路徑作為頁面 key，再把元件放進預設版面配置的 `doc-after` 插槽。樣式部分把評論區顏色對應到 VitePress 的變數上，切換明暗時評論區跟著變。

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

SDK 寫在元件範本裡一般的 `<script>` 中，由 Astro 打包後在瀏覽器執行。不要放進頂部的 `---` 區域，也不要加 `is:inline`、`define:vars` 或 `type="module"`。

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

`Astro.url.pathname` 只有路徑，注意結尾斜線前後一致。啟用了 [ClientRouter](https://docs.astro.build/en/guides/view-transitions/) 也能用，但不要給元件加 `transition:persist`。

### Vue 3 與 React {#vue-react}

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

- Vue 範例裡，`document.title` 要在路由切換後已經變成新標題；標題是非同步設定的話，改為從文章資料取得。
- React 範例在文章變化時銷毀舊實例、再建立新實例。也可以只建立一次，在 `pageKey` 變化時呼叫 `setPageKey(pageKey, pageTitle)`。
