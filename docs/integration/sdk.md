# JavaScript SDK

[HTML 接入](./html)适合每篇文章都是独立页面的静态网站。在 Vue、React 这类单页应用中，切换文章时页面不刷新，评论区需要跟着切换，这时直接使用 SDK。

## 获取 SDK

每个 Ecoku 实例都在 `/client/ecoku.umd.js` 提供 SDK，加载后注册全局变量 `Ecoku`。

::: info npm 包尚未发布
SDK 的包名为 `ecoku`，但目前还没有发布到 npm，`npm install ecoku` 无法使用。需要 ES 模块或 TypeScript 类型时，可以从源码仓库的 `packages/client` 目录自行构建（`pnpm build`），产物位于 `dist/`。
:::

在单页应用中，可以用一个函数按需加载 UMD 文件，保证只加载一次：

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

## 创建评论区

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

### 配置项

| 配置项 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | :---: | --- | --- |
| `container` | `string \| HTMLElement` | 是 | — | 挂载位置，CSS 选择器或 DOM 元素。容器原有内容会被替换。 |
| `serverURL` | `string` | 是 | — | Ecoku 的地址，`http://` 或 `https://` 开头，不能带查询参数或 `#`。 |
| `siteId` | `string` | 是 | — | 后台注册的站点 ID。 |
| `pageKey` | `string` | 是 | — | 当前文章的页面 key，1～512 个字符。SDK 不会自动从网址推断，必须显式传入。 |
| `pageTitle` | `string` | 否 | `''` | 文章标题，显示在通知中，最多 200 个字符。 |
| `pageSize` | `number` | 否 | `10` | 每页根评论数，1～100 的整数。 |
| `theme` | `'auto' \| 'light' \| 'dark'` | 否 | `'auto'` | 配色。`auto` 跟随页面的明暗设置。 |
| `cssURL` | `string` | 否 | `''` | 留空时注入默认样式。填写任何值（样式表地址或 `'none'`）都会停止注入，见下文。 |

构造函数不校验参数；参数不合法时，`init()` 抛出 `TypeError`。

旧配置项 `apiBaseUrl` 是 `serverURL` 的别名，仍可使用，但已弃用。

### 样式 {#styles}

- `cssURL` 留空：SDK 在评论区内注入默认样式，不需要额外引入 CSS。
- `cssURL` 填样式表地址：SDK 不再注入，也**不会**替你加载这个地址，需要自己在页面中加 `<link rel="stylesheet">`。（HTML 加载器会自动添加，SDK 不会。）
- `cssURL` 为 `'none'`：不注入任何样式，完全由你的 CSS 决定外观。

可以使用实例提供的 `/client/ecoku.css`（与默认样式相同）或 `/client/ecoku.unstyled.css`（只有布局）。详见[自定义样式](./custom-css)。

## 实例方法

### `init(options?)`

挂载评论区，恢复浏览器保存的访客身份，加载第一页评论。返回 Promise。

- 传入 `options` 时替换构造时的配置。
- 已经初始化过的实例再次调用不会重复挂载。
- 同一个容器同时只能被一个实例使用，否则抛错。先对旧实例调用 `destroy()`。

### `setPageKey(pageKey, pageTitle?)`

切换到另一篇文章的评论区，适合在单页应用的路由变化后调用。

- 页面 key 与当前相同时，只重新加载评论。
- 不同时，取消进行中的请求，关闭打开的回复框，清空评论框，加载新页面的第一页。
- **第二个参数请传入新文章的标题**。省略时标题被清空，而不是沿用上一篇的标题，否则新评论的通知会显示错误的文章名。请在路由和标题都更新之后再调用。
- 这里传入的标题不会被截断，超过 200 个字符时服务端会拒绝提交评论。

### `reload()`

重新加载当前页的评论，排序不变。

### `destroy()`

卸载评论区：取消所有请求，移除验证组件和事件监听，清空容器。组件卸载时调用。

### `isInitialized()`

返回实例当前是否已初始化。

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

`document.title` 需要在路由切换后已经更新为新文章标题。如果标题由其他逻辑异步设置，请改为传入文章数据中的标题。

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

这个组件在文章变化时销毁旧实例、创建新实例，写法最简单。也可以只创建一次实例，在 `pageKey` 变化时调用 `setPageKey(pageKey, pageTitle)`，省去重新挂载。
