# JavaScript SDK

[HTML 接入](./html)适合每篇文章都是独立页面的静态网站。在 Vue、React 这类单页应用中，切换文章时页面不刷新，评论区需要跟着切换，这时直接使用 SDK。

## 获取 SDK {#install}

[ecoku](https://www.npmjs.com/package/ecoku) 已发布到 npm，当前版本为 `0.3.0`，提供 ESM、CommonJS 和 TypeScript 类型声明。SDK 在浏览器中挂载评论区，需要连接你部署的 Ecoku 服务；安装 npm 包不会替你部署服务端。

```bash
pnpm add --save-exact ecoku@0.3.0
```

不使用 npm 时，可通过 `<script src="https://ecoku.example.com/client/ecoku.umd.js"></script>` 加载实例提供的 UMD 文件，再使用全局 `Ecoku` 构造函数。静态文章页优先使用 [HTML 加载器](./html)。

## 创建评论区

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
| `cssURL` | `string` | 否 | `''` | 留空时注入默认样式。填写有效值（样式表地址或 `'none'`）都会停止注入，见下文。 |

构造函数不校验参数；参数不合法时，`init()` 抛出 `TypeError`。

旧配置项 `apiBaseUrl` 是 `serverURL` 的别名，仍可使用，但已弃用。


构造配置中的 `pageTitle` 会按 JavaScript 字符串的前 200 个 UTF-16 代码单元截断；`setPageKey()` 的标题不截断，服务端按 Unicode 字符校验 200 字符上限。`cssURL` 只接受 HTTP(S) 绝对地址、以 `/` 开头的路径、`none` 或兼容值 `-`，不是任意字符串。

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

## VitePress {#vitepress}

在 `.vitepress/theme/EcokuComments.vue` 中使用 VitePress 自带的 `useRoute`，不要从 `vue-router` 导入。当前文档站已经使用 `ecoku@0.3.0` 接入演示评论区，服务地址为 `https://ecoku-dev.zsh.moe/`，站点 ID 为 `ecoku-docs`；生产接入时替换这两个值，并在 Ecoku 后台将网站来源加入站点允许来源。路由路径作为稳定的页面 key，页面数据提供标题。仅在浏览器挂载时创建实例，切换文章时更新，卸载时销毁。

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
  ([path, title]) => { comments?.setPageKey(path, title).catch(console.error) },
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

在现有 `.vitepress/theme/index.ts` 中将组件放入默认布局的 `doc-after` 插槽，保留已有主题设置和 CSS 导入。下面展示最小接入；修改为你的服务地址和站点 ID，并在后台登记文档网站的来源。首页使用 home 布局时不会显示这个插槽。

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

`document.title` 需要在路由切换后已经更新为新文章标题。如果标题由其他逻辑异步设置，请改为传入文章数据中的标题。

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

这个组件在文章变化时销毁旧实例、创建新实例，写法最简单。也可以只创建一次实例，在 `pageKey` 变化时调用 `setPageKey(pageKey, pageTitle)`，省去重新挂载。
