# JavaScript SDK

[HTML 接入](./html)適合每篇文章都是獨立頁面的靜態網站。在 Vue、React 這類單頁應用程式中，切換文章時頁面不會重新整理，評論區需要跟著切換，這時請直接使用 SDK。

## 取得 SDK {#install}

[ecoku](https://www.npmjs.com/package/ecoku) 的 `0.3.3` 版本已發布到 npm，提供 ESM、CommonJS 和 TypeScript 型別宣告。SDK 在瀏覽器中掛載評論區，需要連接你部署的 Ecoku 服務；安裝 npm 套件不會替你部署伺服器。

```bash
pnpm add --save-exact ecoku@0.3.3
```

不使用 npm 時，可透過 `<script src="https://ecoku.example.com/client/ecoku.umd.js"></script>` 載入實例提供的 UMD 檔案，再使用全域 `Ecoku` 建構函式。靜態文章頁優先使用 [HTML 載入器](./html)。

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

### 設定項目

| 設定項目 | 型別 | 必填 | 預設值 | 說明 |
| --- | --- | :---: | --- | --- |
| `container` | `string \| HTMLElement` | 是 | — | 掛載位置，為 CSS 選擇器或 DOM 元素。容器原有的內容會被取代。 |
| `serverURL` | `string` | 是 | — | Ecoku 的網址，以 `http://` 或 `https://` 開頭，可以帶路徑，不能帶使用者名稱密碼、查詢參數或 `#`。 |
| `siteId` | `string` | 是 | — | 後台建立的站點 ID。 |
| `pageKey` | `string` | 是 | — | 目前文章的頁面 key，1～512 個字元。SDK 不會自動從網址推斷，必須明確傳入。 |
| `pageTitle` | `string` | 否 | `''` | 文章標題，顯示在通知中，最多 200 個字元。 |
| `pageSize` | `number` | 否 | `10` | 每頁根評論數，1～100 的整數。 |
| `theme` | `'auto' \| 'light' \| 'dark'` | 否 | `'auto'` | 配色。`auto` 優先讀取宿主顏色變數，未提供時跟隨系統偏好；手動主題開關需對應顏色變數，見下方 VitePress 範例。 |
| `i18n` | `'zh-CN' \| 'zh-Hant' \| 'en'` | 否 | 站點預設值 | 評論區語言。優先順序為 SDK 參數 → 站點設定 → `zh-CN`；預設的佔位文案、無評論文案和博主標誌隨語言切換，站點自訂的文案保持原文。 |
| `cssURL` | `string` | 否 | `''` | 留空時注入預設樣式。填寫有效值（樣式表網址或 `'none'`）都會停止注入，見下文。 |

建構函式不驗證參數；參數不合法時，`init()` 會擲出 `TypeError`。

- 建構設定中的 `pageTitle` 會截取前 200 個 UTF-16 碼元；`setPageKey()` 傳入的標題不截斷，由伺服器依 200 個 Unicode 字元驗證。
- `cssURL` 只接受 HTTP(S) 絕對位址、以 `/` 開頭的路徑、`none` 或相容值 `-`。
- 舊的設定項目 `apiBaseUrl` 是 `serverURL` 的別名，仍可使用，但已棄用。兩者同時填寫且指向不同位址時，`init()` 會擲出 `TypeError`。

### 樣式 {#styles}

- `cssURL` 留空：SDK 在評論區內注入預設樣式，不需要另外引入 CSS。
- `cssURL` 填入樣式表網址：SDK 不再注入，也**不會**替你載入這個網址，需要自己在頁面中加上 `<link rel="stylesheet">`。（HTML 載入器會自動加上，SDK 不會。）
- `cssURL` 為 `'none'`：不注入任何樣式，外觀完全由你的 CSS 決定。

可以使用實例提供的 `/client/ecoku.css`（與預設樣式相同）或 `/client/ecoku.unstyled.css`（只有版面配置）。詳見[自訂樣式](./custom-css)。

## 實例方法

### `init(options?)`

掛載評論區，並行恢復瀏覽器保存的訪客身分和載入第一頁評論。回傳的 Promise 等待評論載入流程結束，不等待可選的身分恢復；較晚取得的身分不會覆蓋已經編輯的輸入。

- 傳入 `options` 時會取代建構時的設定。
- 已經初始化的實例再次呼叫會直接返回，不會重複掛載，傳入的 `options` 也不會生效。
- 同一個容器同時只能由一個實例使用，否則會擲出錯誤。請先對舊實例呼叫 `destroy()`。
- 掛載失敗時實例會自動銷毀，修正問題後可以再次呼叫 `init()`。

### `setPageKey(pageKey, pageTitle?)`

切換到另一篇文章的評論區，適合在單頁應用程式的路由變化後呼叫。必須在 `init()` 之後呼叫，否則會擲出錯誤。

- 頁面 key 與目前相同時，只重新載入評論。
- 不同時，會取消進行中的請求、關閉已開啟的回覆框、清空評論框，並載入新頁面的第一頁。
- **第二個參數請傳入新文章的標題**。省略時標題會被清空，而不是沿用上一篇的標題，否則新評論的通知會顯示錯誤的文章名稱。請在路由和標題都更新之後再呼叫。
- 這裡傳入的標題不會被截斷，超過 200 個字元時伺服器端會拒絕提交評論。

### `reload()`

重新載入目前頁面的評論，排序不變。必須在 `init()` 之後呼叫，否則會擲出錯誤。

### `destroy()`

卸載評論區：取消所有請求，移除驗證元件和事件監聽器，清空容器。請在元件卸載時呼叫。

### `isInitialized()`

回傳實例目前是否已初始化。

## VitePress {#vitepress}

本文件網站頁面底部的評論區就是用 SDK 接入的：使用 `ecoku@0.3.3`，服務位址為 `https://ecoku-dev.zsh.moe/`，站點 ID 為 `ecoku-docs`。接入自己的網站時替換這兩個值，並在 Ecoku 後台把網站來源加入該站點的允許來源。

在 `.vitepress/theme/EcokuComments.vue` 中使用 VitePress 自帶的 `useRoute`，不要從 `vue-router` 匯入。路由路徑作為穩定的頁面 key，頁面資料提供標題。只在瀏覽器掛載時建立實例，切換文章時更新，卸載時銷毀。

VitePress 的手動主題開關不會改變系統配色偏好。以下將評論區顏色對應到 VitePress 變數，淺色、暗色和手動切換都會同步，且不會重建實例或清空草稿。

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

在既有 `.vitepress/theme/index.ts` 中將元件放入預設版面的 `doc-after` 插槽，保留已有主題設定和 CSS 匯入。以下是最小寫法。首頁使用 home 版面時不會顯示此插槽。

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

`document.title` 需要在路由切換後已經更新為新文章的標題。如果標題由其他邏輯非同步設定，請改為傳入文章資料中的標題。

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

這個元件在文章變化時銷毀舊實例、建立新實例，寫法最簡單。也可以只建立一次實例，在 `pageKey` 變化時呼叫 `setPageKey(pageKey, pageTitle)`，省去重新掛載。
