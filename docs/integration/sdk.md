# JavaScript SDK

在 Vue、React、VitePress 这类前端应用里，切换文章时页面不会刷新，评论区要跟着换。这种情况用 npm 包 `ecoku` 自己创建和销毁评论区。普通静态网站用 [HTML 接入](./html) 更简单。

SDK 只负责在浏览器里显示评论区，你仍然需要一个部署好的 Ecoku 服务。

## 安装 {#install}

```bash
pnpm add --save-exact ecoku@0.6.2
```

包里有 ESM、CommonJS 和 TypeScript 类型声明。升级 Ecoku 服务端时，把这个依赖也更新到同一版本。

不用 npm 的话，也可以加载实例提供的 `https://ecoku.example.com/client/ecoku.umd.js`，然后使用全局的 `Ecoku`。

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
| `container` | `string \| HTMLElement` | 是 | — | 挂载位置，CSS 选择器或元素。原有内容会被替换。 |
| `serverURL` | `string` | 是 | — | Ecoku 的地址，`http://` 或 `https://` 开头，可以带路径，不能带查询参数或 `#`。 |
| `siteId` | `string` | 是 | — | 站点 ID |
| `pageKey` | `string` | 是 | — | 页面 key，1～512 个字符的站内路径，不带 `?` 或 `#`。SDK 不会从网址推断，必须传入。 |
| `pageTitle` | `string` | 否 | `''` | 文章标题，用于通知，超过 200 个字符会截断 |
| `pageSize` | `number` | 否 | `10` | 每页根评论数，1～100 |
| `theme` | `'auto' \| 'light' \| 'dark'` | 否 | `'auto'` | 配色，见 [明暗模式](./custom-css#theme) |
| `i18n` | `'zh-CN' \| 'zh-Hant' \| 'en'` | 否 | 站点设置 | 评论区语言，优先于后台的站点设置 |
| `cssURL` | `string` | 否 | `''` | 样式，见下文 |

`init()` 会检查配置，有问题时返回被拒绝的 Promise。页面 key 的完整规则由服务端检查，所以 `init()` 成功不代表评论一定能提交。

旧配置项 `apiBaseUrl` 是 `serverURL` 的别名，仍然可用，但已弃用。

### 样式 {#styles}

| `cssURL` | 结果 |
| --- | --- |
| 留空 | SDK 注入默认样式，不需要另外引入 CSS |
| 样式表地址 | SDK 不注入，也不会替你加载这个地址。你要自己在页面里加 `<link rel="stylesheet">`。 |
| `'none'` | 不注入任何样式，外观完全由你的 CSS 决定 |

实例提供 `/client/ecoku.css`（默认样式）和 `/client/ecoku.unstyled.css`（只有布局）。见 [自定义样式](./custom-css)。

## 实例方法

| 方法 | 说明 |
| --- | --- |
| `init(options?)` | 挂载评论区并加载第一页。传入 `options` 会替换构造时的配置。已初始化时再次调用不做任何事。 |
| `setPageKey(pageKey, pageTitle?)` | 切换到另一篇文章的评论区。必须在 `init()` 之后调用。 |
| `reload()` | 重新加载当前页的评论 |
| `destroy()` | 卸载评论区，取消请求，清空容器。组件卸载时调用。 |
| `isInitialized()` | 是否已初始化 |

使用时注意：

- 同一个容器同时只能有一个实例。换新实例前，先对旧实例调用 `destroy()`。
- `setPageKey()` 的第二个参数请传新文章的标题。省略时标题会被清空，新评论的通知里就没有文章名。在路由和标题都更新之后再调用。
- 页面 key 不变时调用 `setPageKey()`，会重新加载评论但保留正在写的草稿；页面 key 变了，评论框和回复框会被清空。
- 评论接口出错时，由评论区自己显示错误和重试按钮，`init()`、`reload()`、`setPageKey()` 的 Promise 仍可能正常完成。不要拿它们来判断服务是否健康。

## 在框架中使用 {#frameworks}

下面的示例里，服务地址和站点 ID 都是占位符，换成你自己的，并把网站来源加进站点的允许来源。

### VitePress {#vitepress}

本站就是这样接入的。用 VitePress 自带的 `useRoute`（不要从 `vue-router` 导入），以路由路径作页面 key，再把组件放进默认布局的 `doc-after` 插槽。样式部分把评论区颜色映射到 VitePress 的变量上，切换明暗时评论区跟着变。

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

SDK 写在组件模板里普通的 `<script>` 中，由 Astro 打包后在浏览器运行。不要放进顶部的 `---` 区域，也不要加 `is:inline`、`define:vars` 或 `type="module"`。

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

`Astro.url.pathname` 只有路径，注意结尾斜杠前后一致。启用了 [ClientRouter](https://docs.astro.build/en/guides/view-transitions/) 也能用，但不要给组件加 `transition:persist`。

### Vue 3 与 React {#vue-react}

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

- Vue 示例里，`document.title` 要在路由切换后已经变成新标题；标题是异步设置的话，改为从文章数据取。
- React 示例在文章变化时销毁旧实例、再建新实例。也可以只建一次，在 `pageKey` 变化时调用 `setPageKey(pageKey, pageTitle)`。
