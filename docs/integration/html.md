# HTML 接入

在文章模板里加一段 HTML 和一个脚本，就能在任何静态网站上显示评论区。脚本 `ecoku-loader.js` 由你的 Ecoku 实例提供，它读取 HTML 上的属性，再加载评论组件。

开始前，先在后台 [登记站点](../admin/sites)，并把博客的来源加进允许来源。

## 接入代码

把下面的代码放在文章模板里评论区该出现的位置：

```html
<section
  id="ecoku-comments"
  class="ecoku-shell"
  data-ecoku-comments
  data-server-url="https://ecoku.example.com"
  data-site-id="blog"
  data-page-key="/posts/hello-world/"
  data-page-title="你好，世界"
>
  <div class="ecoku-loader" data-ecoku-loader hidden>
    <p class="ecoku-loader-status" data-ecoku-status></p>
    <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>重新加载评论</button>
  </div>
  <div id="ecoku-mount" data-ecoku-mount></div>
</section>
<script src="https://ecoku.example.com/client/ecoku-loader.js" defer></script>
```

需要替换的是：

- `data-server-url` 和 `<script src>` 里的地址：你的 Ecoku 地址；
- `data-site-id`：后台登记的站点 ID；
- `data-page-key` 和 `data-page-title`：用模板变量输出当前文章的路径和标题，写法见 [下文](#page-key)。

四个带 `data-ecoku-*` 的子元素都要保留。`data-ecoku-mount` 是评论区出现的位置，另外三个用来在加载失败时显示错误和「重新加载评论」按钮。按钮文字可以改。

## 属性

| 属性 | 必填 | 说明 |
| --- | :---: | --- |
| `data-server-url` | 是 | Ecoku 的地址，`http://` 或 `https://` 开头 |
| `data-site-id` | 是 | 站点 ID |
| `data-page-key` | 是 | 页面 key：站内路径，最长 512 个字符，不带 `?` 或 `#` |
| `data-page-title` | 否 | 文章标题，用于通知，最长 200 个字符 |
| `data-page-size` | 否 | 每页根评论数，1～100，默认 10 |
| `data-theme` | 否 | `auto`（默认）、`light` 或 `dark`，见 [明暗模式](./custom-css#theme) |
| `data-css-url` | 否 | 替换默认样式，见 [自定义样式](./custom-css) |
| `data-i18n` | 否 | 评论区语言：`zh-CN`、`zh-Hant` 或 `en`，覆盖后台站点设置 |

## 页面 key 怎么写 {#page-key}

页面 key 决定评论属于哪篇文章，[定下来就不要再改](../reference/concepts#page-key)。通常用文章的站内路径：

::: v-pre
| 生成器 | `data-page-key` |
| --- | --- |
| Hugo | `{{ .RelPermalink }}` |
| Hexo | `<%- url_for(page.path) %>` |
| Jekyll | `{{ page.url }}` |
| Astro | `{Astro.url.pathname}` |
| VitePress | 用 [SDK](./sdk#vitepress) 接入，传入 `useRoute().path` |
:::

写好后在浏览器里查看生成的 HTML，确认输出的是 `/posts/hello-world/` 这样稳定的路径，而不是完整 URL。

Hugo PaperMod 主题有现成的模板，见 [Hugo PaperMod](./hugo)。

## 加载过程

1. 页面解析完后，加载器读取外壳上的属性。缺少必填属性或 `data-ecoku-*` 子元素时，它什么也不做，页面上不出现任何内容。
2. 加载器从自己所在的目录加载 `ecoku.umd.js`，同时请求第一页评论。
3. 脚本加载失败、初始化失败或超过 12 秒时，显示错误信息和「重新加载评论」按钮。
4. 评论区出现后，如果评论接口出错（来源没登记、触发限流、网络中断），评论区自己显示「评论暂时不可用」和重试按钮。

加载器只处理启动时已经在页面上的外壳。单页应用切换文章时，用 [SDK](./sdk) 管理评论区。

一个页面上可以放多个外壳，每个用不同的 `id` 和挂载元素，`data-css-url` 要相同。

## 博客页面的 CSP

博客设置了内容安全策略（CSP）时，需要放行：

- `script-src` 和 `connect-src`：Ecoku 的来源，如 `https://ecoku.example.com`；
- 默认样式以 `<style>` 元素注入。不允许内联样式时，把 `data-css-url` 设为 `https://ecoku.example.com/client/ecoku.css`，并在 `style-src` 里放行这个来源；
- 启用了人机验证：见 [博客页面的 CSP](../admin/captcha#csp)；
- 启用了 Smoji：`connect-src` 放行清单来源，`img-src` 放行图片来源。

## 自己托管加载器

可以把 `ecoku-loader.js` 放到自己的 CDN 上，只改 `<script src>`。加载器从同一目录加载 `ecoku.umd.js`，所以两个文件要放在一起，升级 Ecoku 时一起更新。

## 不用加载器

想自己控制初始化时机的话，直接引入 UMD 文件：

```html
<link rel="stylesheet" href="https://ecoku.example.com/client/ecoku.css">
<div id="ecoku-mount"></div>
<script src="https://ecoku.example.com/client/ecoku.umd.js"></script>
<script>
  const comments = new Ecoku({
    container: '#ecoku-mount',
    serverURL: 'https://ecoku.example.com',
    siteId: 'blog',
    pageKey: '/posts/hello-world/',
    pageTitle: '你好，世界',
    cssURL: 'https://ecoku.example.com/client/ecoku.css',
  })
  comments.init().catch(console.error)
</script>
```

UMD 文件注册全局变量 `Ecoku`。这里用 `<link>` 引入样式，并通过 `cssURL` 告诉 SDK 不必再注入；去掉这两处，SDK 会自己注入默认样式。配置项见 [JavaScript SDK](./sdk)。
