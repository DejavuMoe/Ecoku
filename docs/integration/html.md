# HTML 接入

在文章模板中放一段 HTML 和一个脚本，就能在任意静态网站上显示评论区。脚本 `ecoku-loader.js` 由你的 Ecoku 实例提供，读取 HTML 上的属性后自动加载评论组件。

开始前，请确认已在后台[注册站点](../self-hosting/admin#sites)，并把博客的来源加入了该站点的允许来源。

## 接入代码

把下面的代码放在文章模板中评论区的位置，替换三处值：

- `data-server-url`：你的 Ecoku 地址；
- `data-site-id`：后台注册的站点 ID；
- `data-page-key`、`data-page-title`：用模板变量输出当前文章的路径和标题。

```html
<section
  id="ecoku-comments"
  class="ecoku-shell"
  data-ecoku-comments
  data-server-url="https://ecoku.example.com"
  data-site-id="blog"
  data-page-key="/posts/hello-world/"
  data-page-title="你好，世界"
  data-page-size="10"
  data-theme="auto"
>
  <div class="ecoku-loader" data-ecoku-loader hidden>
    <p class="ecoku-loader-status" data-ecoku-status></p>
    <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>重新加载评论</button>
  </div>
  <div id="ecoku-mount" data-ecoku-mount></div>
</section>
<script src="https://ecoku.example.com/client/ecoku-loader.js" defer></script>
```

外壳里的四个带 `data-ecoku-*` 的元素都要保留：`data-ecoku-mount` 是评论区挂载的位置，另外三个用来在加载失败时显示错误信息和重试按钮。按钮文字可以自己改。

## 属性

| 属性 | 必填 | 说明 |
| --- | :---: | --- |
| `data-server-url` | 是 | Ecoku 的地址，如 `https://ecoku.example.com`，必须是 `http://` 或 `https://` 开头的完整地址。 |
| `data-site-id` | 是 | 后台注册的站点 ID。 |
| `data-page-key` | 是 | 当前文章的页面 key，站内相对路径，最多 512 个字符，不能带 `?` 或 `#`。见下文。 |
| `data-page-title` | 否 | 文章标题，显示在通知邮件中。超过 200 个字符的部分会被截掉。 |
| `data-page-size` | 否 | 每页显示多少条根评论，1～100，默认 10。填写无效值时按 10 处理。 |
| `data-theme` | 否 | `auto`（默认）、`light` 或 `dark`。`auto` 跟随页面的明暗设置。 |
| `data-css-url` | 否 | 替换默认样式，见[自定义样式](./custom-css)。 |

## 选择页面 key

页面 key 决定评论属于哪篇文章，[一旦使用就不要再改](../guide/concepts#page-key)。通常用文章的站内路径。常见生成器的写法：

::: v-pre
| 生成器 | `data-page-key` 的值 |
| --- | --- |
| Hugo | `{{ .RelPermalink }}` |
| Hexo | `<%- url_for(page.path) %>` |
| Jekyll | `{{ page.url }}` |
| Astro | `{Astro.url.pathname}` |
| VitePress | 在自定义主题中读取 `useRoute().path`，并使用 [SDK](./sdk) 接入 |
:::

以上仅供参考，请在浏览器中查看生成的 HTML，确认输出的是稳定的路径，例如 `/posts/hello-world/`，而不是完整 URL。

## 加载过程

1. 页面解析完成后，加载器读取外壳上的属性。缺少 `data-server-url`、`data-site-id`、`data-page-key`，或缺少四个 `data-ecoku-*` 子元素中的任何一个时，它会**静默跳过**，页面上不出现任何内容。
2. 加载器从自己所在的目录加载 `ecoku.umd.js`，并初始化评论区。加载期间不显示“正在加载”之类的文字。
3. 脚本加载或初始化任一阶段超过 12 秒、或者失败时，显示错误信息和「重新加载评论」按钮，访客可以点击重试。

一个页面上可以有多个外壳，每个都会独立初始化。

## 使用自己托管的加载器

可以把 `ecoku-loader.js` 放到自己的 CDN 上，只改 `<script src>`。加载器会从**同一目录**加载 `ecoku.umd.js`，所以两个文件要放在一起，并且在升级 Ecoku 时同步更新。

## 博客页面的 CSP

如果博客设置了内容安全策略（CSP），需要放行：

- `script-src` 和 `connect-src`：Ecoku 的来源，如 `https://ecoku.example.com`；
- 默认样式以 `<style>` 元素注入。CSP 不允许内联样式时，把 `data-css-url` 设为 `https://ecoku.example.com/client/ecoku.css`，改用外链样式表，并在 `style-src` 中放行该来源；
- 启用了人机验证时，还要放行验证服务，见[人机验证 · 内容安全策略](../self-hosting/captcha#csp)；
- 启用了 [Smoji 表情](./smoji)时，在 `connect-src` 中放行清单来源，在 `img-src` 中放行图片来源。二者分开托管时需要分别填写，见[清单与图片的托管](./smoji#hosting)。

## 不用加载器

也可以直接引入 UMD 文件，自己控制初始化时机：

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

UMD 文件注册全局变量 `Ecoku`。上例用 `<link>` 引入样式，并通过 `cssURL` 告诉 SDK 不要再注入默认样式；如果去掉这两处，SDK 会自己注入。配置项和方法见 [JavaScript SDK](./sdk)。
