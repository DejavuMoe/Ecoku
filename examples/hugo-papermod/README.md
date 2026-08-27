# Hugo PaperMod 接入示例

本示例包含 PaperMod 所需的评论 partial、配置片段和可选的加载前外壳 CSS。

## 使用

将以下文件复制到 Hugo 站点对应目录：

```powershell
Copy-Item examples/hugo-papermod/layouts/_partials/comments.html SITE/layouts/_partials/comments.html
Copy-Item examples/hugo-papermod/assets/css/extended/ecoku.css SITE/assets/css/extended/ecoku.css
```

`ecoku.css` 只负责加载前外壳、失败状态和重试按钮，可以不复制。评论内容的默认样式由 SDK 提供；需要完全自定义时，参见文档中的[自定义 CSS](../../docs/integration/custom-css.md)。

把 `hugo.yaml.example` 中的 `params` 合并进站点配置，替换服务地址和站点 ID。可选的 `js_url`、`css_url` 用于固定加载器或样式地址；不设置时使用服务端默认地址。

确保文章模板调用：

```go-html-template
{{ partial "comments.html" . }}
```

示例使用 `.RelPermalink` 作为稳定页面 key，使用 `.Title` 作为页面标题。浏览器端只放公开的服务地址和站点 ID，不要放管理员凭据、通知密钥或站点管理密钥。
