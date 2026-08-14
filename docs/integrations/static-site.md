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

## 2. 使用 Ecoku 容器自带的浏览器资源

生产镜像直接提供以下公开、无凭据资源：

- `https://ecoku.via.moe/client/ecoku-loader.js`：延迟加载、失败提示和重试；
- `https://ecoku.via.moe/client/ecoku.umd.js`：评论 SDK。

内容站点只引用加载器。UMD 由加载器从同一个 Ecoku Origin 获取，不需要复制到 Hugo 或依赖第三方
CDN。升级镜像后两个资源同步升级；稳定 URL 返回一小时缓存，因此切换版本后需要考虑浏览器短暂缓存。

## 3. 在页面中提供稳定信息

静态生成器应明确输出容器、服务地址、站点 ID、稳定页面 key 和文章标题：

```html
<section
  id="ecoku-comment-shell"
  data-ecoku-comments
  aria-label="评论区"
  aria-busy="false"
  data-server-url="https://ecoku.via.moe"
  data-site-id="blog"
  data-page-key="/posts/example/"
  data-page-title="示例文章"
  data-page-size="10"
  data-theme="auto"
>
  <div class="comment-loader" role="status" aria-live="polite">
    <p class="comment-status">评论区将在滚动到附近时加载。</p>
    <button class="comment-retry" type="button" hidden>重新加载评论</button>
  </div>
  <div data-ecoku-mount></div>
</section>
<script src="https://ecoku.via.moe/client/ecoku-loader.js" defer></script>
```

`pageKey` 是评论线程的永久标识。推荐使用站点生成器的规范相对永久链接；不能使用随机 ID、临时
预览 URL、带追踪参数的地址，也不能依赖 SDK 自动猜测。文章改名但线程不应变化时，保持 page key
不变。`pageTitle` 仅用于管理端和通知中的文章标题。

所有 `data-*` 值都必须由可信的构建模板正确转义，不能把访客输入拼进脚本或 HTML 属性。加载器
不包含管理员 token、management key、SMTP 密码或 Telegram Token。

## 4. Hugo 示例

仓库的 `examples/hugo-papermod` 提供从真实主题集成中提取的最小 PaperMod 示例：

- `hugo.yaml.example` 中设置 `params.ecoku.server_url` 和 `params.ecoku.site_id`；
- `layouts/_partials/comments.html` 传入 `.RelPermalink` 和 `.Title`；
- Ecoku 服务端的 `/client/ecoku-loader.js` 负责延迟加载、超时和重试；
- `assets/css/extended/ecoku.css` 让评论区继承主题字体和配色；
- `/client/ecoku.umd.js` 由同一 Ecoku 容器直接提供。

示例带滚动到附近后加载、超时和重试处理。复制到其他主题时，应合并到该主题实际使用的评论
partial，不要假设 PaperMod 的文件路径适用于所有主题。

## 5. 本地与生产验收

1. 在站点允许来源中同时登记实际本地 Origin 和生产 Origin。
2. 构建并启动静态站点，打开有评论和无评论的页面。
3. 核对请求只发往配置的 Ecoku 地址，没有第三方 IP、头像、遥测或 management key。
4. 提交根评论和至少三级回复，刷新后确认线程、换行和纯文本转义保持正确。
5. 检查浏览器控制台没有 CORS、CSP、重复初始化或资源 404；测试 429 和服务器不可用时的反馈。
6. 在窄屏和键盘操作下检查表单、回复、折叠、根线程分页和焦点恢复。
7. 若站点有严格 CSP，`script-src` 和 `connect-src` 必须精确允许 Ecoku 的 HTTPS Origin。当前
   SDK 还会注入组件 `<style>` 并写入线程深度的行内样式，因而不兼容 `style-src 'self'`；不要为
   接入评论区直接全局开启 `unsafe-inline`，应先采用[试用前就绪清单](../operations/pretrial-readiness.md)
   中的外置样式方案。

生产环境若与本地结果不同，先检查两个 `/client/` 资源的 HTTP 状态、页面输出的 `data-*` 值、站点允许来源
和网络响应，再排查主题 CSS。
