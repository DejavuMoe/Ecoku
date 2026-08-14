# 一般静态网站接入 Ecoku

本指南适用于 Hugo、Hexo、Astro、Eleventy、手写 HTML 和其他能够输出静态 HTML 的站点。
浏览器只需要公开的服务地址、站点 ID 和页面信息，不需要也不得接收 management key。

## 1. 服务端先创建站点

在 Ecoku 管理端「站点管理」中新建站点，并记录：

- 稳定的站点 ID，例如 `blog`；
- 规范站点 URL，例如 `https://blog.example.com`；
- 站点名称；
- 浏览器实际 Origin，每行一个，例如 `https://blog.example.com` 和本地开发用的
  `http://127.0.0.1:1313`。

Origin 只有协议、主机和可选端口，不能包含文章路径或尾部斜杠。保存后，浏览器 SDK 中的
`siteId` 必须与这里完全一致。

## 2. 构建并自托管浏览器 SDK

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --dir packages/client build
```

把 `packages/client/dist/ecoku.umd.js` 复制到静态站点自己的资源目录，例如
`/assets/ecoku/ecoku.umd.js`。不要从第三方 CDN 加载，也不要把 Ecoku 服务端私有配置复制到站点。

每次升级 Ecoku 后重新构建并覆盖该文件；可用 SHA-256 对比部署文件与当前构建产物是否一致。

## 3. 在页面中提供稳定信息

静态生成器应明确输出容器、服务地址、站点 ID、稳定页面 key 和文章标题：

```html
<section
  id="ecoku-comments"
  aria-label="评论区"
  data-server-url="https://comments.example.com"
  data-site-id="blog"
  data-page-key="/posts/example/"
  data-page-title="示例文章"
></section>
<script src="/assets/ecoku/ecoku.umd.js" defer></script>
<script src="/assets/ecoku/init-comments.js" defer></script>
```

`pageKey` 是评论线程的永久标识。推荐使用站点生成器的规范相对永久链接；不能使用随机 ID、临时
预览 URL、带追踪参数的地址，也不能依赖 SDK 自动猜测。文章改名但线程不应变化时，保持 page key
不变。`pageTitle` 仅用于管理端和通知中的文章标题。

把下面内容保存为同源的 `/assets/ecoku/init-comments.js`：

```js
document.addEventListener('DOMContentLoaded', () => {
  const container = document.querySelector('#ecoku-comments')
  if (!container || typeof window.Ecoku !== 'function') return

  const comments = new window.Ecoku({
    container,
    serverURL: container.dataset.serverUrl,
    siteId: container.dataset.siteId,
    pageKey: container.dataset.pageKey,
    pageTitle: container.dataset.pageTitle,
    pageSize: 10,
    theme: 'auto'
  })

  comments.init().catch(() => {
    container.textContent = '评论服务暂时不可用，请稍后重试。'
  })
})
```

这里使用外部初始化脚本，便于站点维持 `script-src 'self'` 的 CSP。所有 `data-*` 值都必须由可信的
构建模板正确转义，不能把访客输入拼进脚本或 HTML 属性。

## 4. Hugo 示例

仓库的 `examples/hugo-papermod` 提供从真实主题集成中提取的最小 PaperMod 示例：

- `hugo.yaml.example` 中设置 `params.ecoku.server_url` 和 `params.ecoku.site_id`；
- `layouts/_partials/comments.html` 传入 `.RelPermalink` 和 `.Title`；
- `static/js/ecoku-comments.js` 负责延迟加载、超时和重试；
- `assets/css/extended/ecoku.css` 让评论区继承主题字体和配色；
- 构建后的 `ecoku.umd.js` 由站点部署者复制到 `static/vendor/`，示例不提交构建产物。

示例带滚动到附近后加载、超时和重试处理。复制到其他主题时，应合并到该主题实际使用的评论
partial，不要假设 PaperMod 的文件路径适用于所有主题。

## 5. 本地与生产验收

1. 在站点允许来源中同时登记实际本地 Origin 和生产 Origin。
2. 构建并启动静态站点，打开有评论和无评论的页面。
3. 核对请求只发往配置的 Ecoku 地址，没有第三方 IP、头像、遥测或 management key。
4. 提交根评论和至少三级回复，刷新后确认线程、换行和纯文本转义保持正确。
5. 检查浏览器控制台没有 CORS、CSP、重复初始化或资源 404；测试 429 和服务器不可用时的反馈。
6. 在窄屏和键盘操作下检查表单、回复、折叠、根线程分页和焦点恢复。
7. 若站点有严格 CSP，至少允许 SDK 和初始化脚本的同源路径，以及 `connect-src` 到 Ecoku 的
   HTTPS Origin；不要为接入评论区直接开启 `unsafe-inline` 脚本。

生产环境若与本地结果不同，先对比 SDK 文件 SHA-256、页面输出的四个 `data-*` 值、站点允许来源
和网络响应，再排查主题 CSS。
