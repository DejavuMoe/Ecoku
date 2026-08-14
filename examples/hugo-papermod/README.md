# Hugo PaperMod 接入示例

这是从真实测试站点提取的最小、可跟踪示例，不包含主题源码、文章、数据库、构建产物或私有配置。
示例适用于当前 PaperMod 布局；其他主题应将相同数据和初始化逻辑合并到自己的评论入口。

## 文件映射

```text
examples/hugo-papermod/
├── hugo.yaml.example
├── layouts/_partials/comments.html
├── static/js/ecoku-comments.js
└── assets/css/extended/ecoku.css
```

复制到 Hugo 站点根目录：

```powershell
Copy-Item examples/hugo-papermod/layouts/_partials/comments.html SITE/layouts/_partials/comments.html
Copy-Item examples/hugo-papermod/static/js/ecoku-comments.js SITE/static/js/ecoku-comments.js
Copy-Item examples/hugo-papermod/assets/css/extended/ecoku.css SITE/assets/css/extended/ecoku.css
```

将 `hugo.yaml.example` 中的 `params` 合并进站点配置。然后在 Ecoku 仓库构建 SDK，并把构建产物
复制到站点自己的静态目录：

```powershell
pnpm --dir packages/client build
New-Item -ItemType Directory -Force SITE/static/vendor | Out-Null
Copy-Item packages/client/dist/ecoku.umd.js SITE/static/vendor/ecoku.umd.js
```

PaperMod 的文章模板需要调用 `{{ partial "comments.html" . }}`。示例 partial 明确把
`.RelPermalink` 作为稳定页面 key、`.Title` 作为文章标题传给 SDK，并以外部同源脚本延迟加载，
无需给严格 CSP 增加 `unsafe-inline`。

最后在 Ecoku 管理端创建相同的 `site_id`，并把 Hugo 本地预览与正式站点的实际 Origin 逐行加入
允许来源。浏览器端不应包含 management key、管理员 token 或通知凭据。
