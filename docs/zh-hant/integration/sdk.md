# JavaScript SDK

[HTML 接入](./html)適合每篇文章都是獨立頁面的靜態網站。在 Vue、React 這類單頁應用程式中，切換文章時頁面不會重新整理，評論區需要跟著切換，這時請直接使用 SDK。

## 取得 SDK

每個 Ecoku 實例都在 `/client/ecoku.umd.js` 提供 SDK，載入後會註冊全域變數 `Ecoku`。

SDK 的 npm 套件名稱為 `ecoku`，版本跟隨專案 tag。在對應 npm 發布任務成功後，可在網站專案中安裝精確版本：

```bash
pnpm add --save-exact ecoku@0.3.0
```

```ts
import Ecoku from 'ecoku'
```

VitePress 的自訂主題也使用這個入口；只在瀏覽器掛載後建立實例，並在路由切換時更新頁面 key。發布尚未完成時，可先使用下方實例託管的 UMD 檔案，或在原始碼儲存庫的 `packages/client` 執行 `pnpm build`，從 `dist/` 取得產物。

在單頁應用程式中，可以用一個函式依需要載入 UMD 檔案，確保只載入一次：

```js
const ECOKU_URL = 'https://ecoku.example.com'
let ecokuPromise

export function loadEcoku() {
  if (window.Ecoku) return Promise.resolve(window.Ecoku)
  ecokuPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `${ECOKU_URL}/client/ecoku.umd.js`
    script.async = true
    script.onload = () => (window.Ecoku ? resolve(window.Ecoku) : reject(new Error('Ecoku 未加载')))
    script.onerror = () => {
      ecokuPromise = undefined
      script.remove()
      reject(new Error('无法加载 Ecoku'))
    }
    document.head.append(script)
  })
  return ecokuPromise
}
```

## 建立評論區

```js
const Ecoku = await loadEcoku()
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
| `serverURL` | `string` | 是 | — | Ecoku 的網址，以 `http://` 或 `https://` 開頭，不能帶查詢參數或 `#`。 |
| `siteId` | `string` | 是 | — | 後台註冊的站點 ID。 |
| `pageKey` | `string` | 是 | — | 目前文章的頁面 key，1～512 個字元。SDK 不會自動從網址推斷，必須明確傳入。 |
| `pageTitle` | `string` | 否 | `''` | 文章標題，顯示在通知中，最多 200 個字元。 |
| `pageSize` | `number` | 否 | `10` | 每頁根評論數，1～100 的整數。 |
| `theme` | `'auto' \| 'light' \| 'dark'` | 否 | `'auto'` | 配色。`auto` 跟隨頁面的明暗設定。 |
| `cssURL` | `string` | 否 | `''` | 留空時注入預設樣式。填寫任何值（樣式表網址或 `'none'`）都會停止注入，見下文。 |

建構函式不驗證參數；參數不合法時，`init()` 會擲出 `TypeError`。

舊的設定項目 `apiBaseUrl` 是 `serverURL` 的別名，仍可使用，但已棄用。

### 樣式 {#styles}

- `cssURL` 留空：SDK 在評論區內注入預設樣式，不需要另外引入 CSS。
- `cssURL` 填入樣式表網址：SDK 不再注入，也**不會**替你載入這個網址，需要自己在頁面中加上 `<link rel="stylesheet">`。（HTML 載入器會自動加上，SDK 不會。）
- `cssURL` 為 `'none'`：不注入任何樣式，外觀完全由你的 CSS 決定。

可以使用實例提供的 `/client/ecoku.css`（與預設樣式相同）或 `/client/ecoku.unstyled.css`（只有版面配置）。詳見[自訂樣式](./custom-css)。

## 實例方法

### `init(options?)`

掛載評論區，恢復瀏覽器保存的訪客身分，並載入第一頁評論。回傳 Promise。

- 傳入 `options` 時會取代建構時的設定。
- 已經初始化過的實例再次呼叫不會重複掛載。
- 同一個容器同時只能由一個實例使用，否則會擲出錯誤。請先對舊實例呼叫 `destroy()`。

### `setPageKey(pageKey, pageTitle?)`

切換到另一篇文章的評論區，適合在單頁應用程式的路由變化後呼叫。

- 頁面 key 與目前相同時，只重新載入評論。
- 不同時，會取消進行中的請求、關閉已開啟的回覆框、清空評論框，並載入新頁面的第一頁。
- **第二個參數請傳入新文章的標題**。省略時標題會被清空，而不是沿用上一篇的標題，否則新評論的通知會顯示錯誤的文章名稱。請在路由和標題都更新之後再呼叫。
- 這裡傳入的標題不會被截斷，超過 200 個字元時伺服器端會拒絕提交評論。

### `reload()`

重新載入目前頁面的評論，排序不變。

### `destroy()`

卸載評論區：取消所有請求，移除驗證元件和事件監聽器，清空容器。請在元件卸載時呼叫。

### `isInitialized()`

回傳實例目前是否已初始化。

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

`document.title` 需要在路由切換後已經更新為新文章的標題。如果標題由其他邏輯非同步設定，請改為傳入文章資料中的標題。

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

這個元件在文章變化時銷毀舊實例、建立新實例，寫法最簡單。也可以只建立一次實例，在 `pageKey` 變化時呼叫 `setPageKey(pageKey, pageTitle)`，省去重新掛載。
