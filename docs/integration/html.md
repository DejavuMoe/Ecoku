# 通用 HTML

每个页面放一个评论容器。`data-page-key` 是当前页的稳定站内相对路径：

- 静态站在模板里插入当前页的 path / permalink。
- 手写 HTML 时为每页提供唯一且稳定的相对路径。

示例中的 `/posts/example/` 是渲染后的 key，不是所有页面都要照抄。不要用完整 URL 或带 query / fragment 的地址。

## 属性

| 属性 | 必填 | 说明 |
| --- | --- | --- |
| `data-server-url` | 是 | 评论服务的绝对 `http(s)` 地址 |
| `data-site-id` | 是 | 管理端创建的站点 ID |
| `data-page-key` | 是 | 站内相对路径，1–512 字符 |
| `data-page-title` | 否 | ≤200 字符 |
| `data-page-size` | 否 | 根评论每页条数，1–100，默认 10 |
| `data-theme` | 否 | `auto` / `light` / `dark` |
| `data-css-url` | 否 | 见 [自定义 CSS](/integration/custom-css) |

## Loader 示例

```html
<section
  id="ecoku-comments"
  class="ecoku-shell"
  data-ecoku-comments
  data-server-url="https://comments.example.com"
  data-site-id="blog"
  data-page-key="/posts/example/"
  data-page-title="示例文章"
  data-page-size="10"
  data-theme="auto"
>
  <div class="ecoku-loader" data-ecoku-loader hidden>
    <p class="ecoku-loader-status" data-ecoku-status></p>
    <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>重新加载评论</button>
  </div>
  <div id="ecoku-mount" data-ecoku-mount></div>
</section>
<script src="https://comments.example.com/client/ecoku-loader.js" defer></script>
```

加载器读取上述属性，加载 SDK 并初始化；失败时显示状态与重试。加载过程中不额外提示文案。未配置必要属性时加载器会跳过。不要在页面放入管理员 token 或 management key。

未设置 `data-css-url` 时，SDK **内联**默认评论区样式（不会自动请求 `/client/ecoku.css`）。自定义样式见 [自定义 CSS](/integration/custom-css)。

## 不使用 loader

自行加载 UMD 与 CSS 时传入 `cssURL: 'none'`，避免 SDK 再注入默认样式：

```html
<link rel="stylesheet" href="https://comments.example.com/client/ecoku.css">
<div id="ecoku-mount"></div>

<script src="https://comments.example.com/client/ecoku.umd.js"></script>
<script>
  const comments = new Ecoku({
    container: '#ecoku-mount',
    serverURL: 'https://comments.example.com',
    siteId: 'blog',
    pageKey: '/posts/example/',
    pageTitle: '示例文章',
    pageSize: 10,
    theme: 'auto',
    cssURL: 'none'
  })

  comments.init().catch(console.error)
</script>
```

`ecoku.umd.js` 提供全局 `Ecoku`。这种方式没有 loader 的失败重试 UI。Hugo 接入见 [Hugo PaperMod](/integration/hugo)。
