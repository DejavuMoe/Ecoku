# JavaScript SDK 参考

`ecoku` 提供了适用于现代化前端工程（Vite / Webpack / React / Vue / Astro / Svelte）的 TypeScript / JavaScript SDK。

---

## 1. 安装

```bash
# 使用 npm
npm install ecoku

# 使用 pnpm
pnpm add ecoku

# 使用 yarn
yarn add ecoku
```

---

## 2. 构造器与配置参数

```typescript
import Ecoku, { type EcokuConfig } from 'ecoku'

const ecoku = new Ecoku(options: EcokuConfig)
```

### `EcokuConfig` 完整属性列表

| 属性名 | 类型 | 必填 | 默认值 | 约束与说明 |
| :--- | :--- | :---: | :---: | :--- |
| `container` | `string \| HTMLElement` | **是** | — | 挂载目标容器的选择器字符串（如 `#comments`）或 DOM 元素实例。 |
| `serverURL` | `string` | **是** | — | Ecoku 服务端绝对地址（如 `https://ecoku.example.com`）。 |
| `siteId` | `string` | **是** | — | 站点唯一标识符（匹配正则 `/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/`）。 |
| `pageKey` | `string` | **是** | — | 站内相对路径（1～512 字符，如 `/posts/my-first-post/`）。 |
| `pageTitle` | `string` | 否 | `""` | 文章标题（最多 200 字符），用于邮件和 TG 消息展示。 |
| `pageSize` | `number` | 否 | `10` | 根评论每页展示条数（1～100 整数）。 |
| `theme` | `'auto' \| 'light' \| 'dark'` | 否 | `'auto'` | 主题模式。`'auto'` 将自动响应 `prefers-color-scheme`。 |
| `cssURL` | `string` | 否 | `""` | 自定义 CSS URL。若传入 `'none'`，则完全禁用 SDK 内联样式注入。 |

---

## 3. 实例方法清单

### `init(options?: EcokuConfig): Promise<void>`
初始化并挂载评论区。
- 会校验配置合法性，并通过 `WeakMap` 确保同一 DOM 容器在同一时刻仅被单个 Ecoku 实例挂载。
- 自动解密恢复本地 IndexedDB 中存储的 7 天访客身份。
- 拉取第 1 页根评论与服务端配置并渲染。

### `reload(): Promise<void>`
重新拉取当前页码的最新评论数据并重新渲染，保持现有排序不变。

### `setPageKey(newPageKey: string): Promise<void>`
在单页应用（SPA）无刷新路由切换时，无缝切换评论区绑定的页面。
- 若传入的 `newPageKey` 与当前相同，静默触发 `reload()`。
- 若为全新页面，自动中止前一页面所有在途网络请求、关闭活动回复框、重置分页与表单，并重新载入新页面的第 1 页评论。

### `destroy(): void`
完全销毁实例。
- 解除 DOM 容器与实例的绑定关系。
- 中止所有进行中的 Fetch 请求控制器（AbortController）。
- 注销人机验证控件及全局事件监听器。
- 清空评论区生成的 DOM 结构。

### `isInitialized(): boolean`
返回布尔值，指示当前实例是否处于已挂载且未销毁的就绪状态。

---

## 4. 框架集成实战

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

// 监听 SPA 路由变化无刷新切换
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
