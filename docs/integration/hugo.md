# Hugo PaperMod

```yaml
params:
  comments: true
  ecoku:
    server_url: "https://comments.example.com"
    site_id: "blog"
    # js_url: "https://cdn.example.com/ecoku-loader.js"
    # css_url: "https://comments.example.com/client/ecoku.unstyled.css"
```

把仓库 `examples/hugo-papermod/layouts/_partials/comments.html` 合并到主题实际使用的 comments partial。生产使用 `.RelPermalink` 作为页面 key、`.Title` 作为标题，并保留 Hugo 的上下文转义。

加载前外壳样式可复制 `examples/hugo-papermod/assets/css/extended/ecoku.css`，只美化失败/未配置外壳。

## 上线前

至少检查：普通文章、无评论页、深层回复、根线程分页、移动端、回复通知、CORS 拒绝未登记 Origin，以及刷新后 7 天加密身份恢复。清除浏览器站点数据会删除身份，没有额外清除按钮。

使用镜像同源加载器会自动获得当前协议（含 Cap）。自行固定旧 SDK 的站点必须先更新再选择 Cap。
