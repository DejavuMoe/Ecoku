# 通用 HTML

每个页面提供专用容器和稳定的页面 key。`pageKey` 必须是站内相对路径，不能是绝对 URL，不能带 query。

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

加载器以 `data-ecoku-*` 为准：外壳、挂载点、加载态、状态文案和重试按钮缺一则不会初始化。规范 id 为 `ecoku-comments` 与 `ecoku-mount`。当前仍兼容旧的 `#tcomment` 与 `.comment-loader` 等类名，新站点不要再用。

加载过程不显示「正在加载评论…」；失败时才展示状态和「重新加载评论」。未配置站点渲染「评论服务尚未配置。」

不要放入管理员 token 或 management key。验证由公共 `formConfig` 下发。

## 样式

默认 SDK 注入评论区样式。可选 `data-css-url` 后不再注入：

- `/client/ecoku.css`：与默认注入相同
- `/client/ecoku.unstyled.css`：只保留结构
- `none`：完全自写 CSS

可选 `data-js-url` 替换默认加载器。自定义样式只作用于评论区。

上面的代码即为完整示例，可直接复制后替换站点参数。

严格 CSP 见 [常见问题 · 宿主 CSP](/self-hosting/faq#宿主-csp)。
