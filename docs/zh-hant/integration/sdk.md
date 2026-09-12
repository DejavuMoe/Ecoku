# JavaScript SDK 參考

`ecoku` 提供了適用於現代化前端工程（Vite / Webpack / React / Vue / Astro / Svelte）的 TypeScript / JavaScript SDK。

---

## 1. 安裝

```bash
# 使用 npm
npm install ecoku

# 使用 pnpm
pnpm add ecoku

# 使用 yarn
yarn add ecoku
```

---

## 2. 建構函式與配置參數

```typescript
import Ecoku, { type EcokuConfig } from 'ecoku'

const ecoku = new Ecoku(options: EcokuConfig)
```

### `EcokuConfig` 完整屬性列表

| 屬性名 | 類型 | 必填 | 預設值 | 約束與說明 |
| :--- | :--- | :---: | :---: | :--- |
| `container` | `string \| HTMLElement` | **是** | — | 掛載目標容器的選取器字串（如 `#comments`）或 DOM 元素實例。 |
| `serverURL` | `string` | **是** | — | Ecoku 伺服端絕對位址（如 `https://ecoku.example.com`）。 |
| `siteId` | `string` | **是** | — | 站點唯一識別碼（匹配正規表示式 `/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/`）。 |
| `pageKey` | `string` | **是** | — | 站內相對路徑（1～512 字元，如 `/posts/my-first-post/`）。 |
| `pageTitle` | `string` | 否 | `""` | 文章標題（最多 200 字元），用於郵件和 TG 訊息展示。 |
| `pageSize` | `number` | 否 | `10` | 根評論每頁展示筆數（1～100 整數）。 |
| `theme` | `'auto' \| 'light' \| 'dark'` | 否 | `'auto'` | 主題模式。`'auto'` 將自動響應 `prefers-color-scheme`。 |
| `cssURL` | `string` | 否 | `""` | 自訂 CSS URL。若傳入 `'none'`，則完全停用 SDK 內嵌樣式注入。 |

---

## 3. 實例方法清單

### `init(options?: EcokuConfig): Promise<void>`
初始化並掛載評論區。
- 會校驗配置合法性，並透過 `WeakMap` 確保同一 DOM 容器在同一時刻僅被單個 Ecoku 實例掛载。
- 自動解密復原本地 IndexedDB 中儲存的 7 天訪客身分。
- 拉取第 1 頁根評論與伺服端配置並渲染。

### `reload(): Promise<void>`
重新拉取目前頁碼的最新評論資料並重新渲染，保持現有排序不變。

### `setPageKey(newPageKey: string): Promise<void>`
在單頁應用（SPA）無重新整理路由切換時，無縫切換評論區綁定的頁面。
- 若傳入的 `newPageKey` 與目前相同，靜默觸發 `reload()`。
- 若為全新頁面，自動中止前一頁面所有在途中網路請求、關閉活動回覆框、重設分頁與表單，並重新載入新頁面的第 1 頁評論。

### `destroy(): void`
完全銷毀實例。
- 解除 DOM 容器與實例的綁定關係。
- 中止所有進行中的 Fetch 請求控制器（AbortController）。
- 註銷人機驗證控制項及全域事件監聽器。
- 清空評論區產生的 DOM 結構。

### `isInitialized(): boolean`
回傳布林值，指示目前實例是否處於已掛載且未銷毀的就緒狀態。

---

## 4. 框架整合實戰

### 在 Vue 3 中使用

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

// 監聽 SPA 路由變化無刷新切換
watch(() => route.path, (newPath) => {
  ecokuInstance?.setPageKey(newPath)
})

onUnmounted(() => {
  ecokuInstance?.destroy()
  ecokuInstance = null
})
</script>

<template>
  <div ref="mountEl" class="comments-wrapper"></div>
</template>
```

### 在 React 中使用

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
