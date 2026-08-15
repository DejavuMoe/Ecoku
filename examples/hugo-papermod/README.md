# Hugo PaperMod 接入示例

这是从真实测试站点提取的最小、可跟踪示例，不包含主题源码、文章、数据库、构建产物或私有配置。
示例适用于当前 PaperMod 布局；其他主题应将相同数据和初始化逻辑合并到自己的评论入口。

## 文件映射

```text
examples/hugo-papermod/
├── hugo.yaml.example
├── layouts/_partials/comments.html
└── assets/css/extended/ecoku.css
```

复制到 Hugo 站点根目录：

```powershell
Copy-Item examples/hugo-papermod/layouts/_partials/comments.html SITE/layouts/_partials/comments.html
Copy-Item examples/hugo-papermod/assets/css/extended/ecoku.css SITE/assets/css/extended/ecoku.css
```

`ecoku.css` 只美化加载前外壳，可以不复制；评论区外观由 SDK 注入。将 `hugo.yaml.example` 中的
`params` 合并进站点配置。运行镜像会直接提供 `/client/ecoku-loader.js` 与 `/client/ecoku.umd.js`，
Hugo 站点不再保存或同步 SDK 副本。

PaperMod 的文章模板需要调用 `{{ partial "comments.html" . }}`。示例 partial 使用
`id="ecoku-comments"` / `id="ecoku-mount"` 和 `data-ecoku-*` 标记，把 `.RelPermalink` 作为稳定
页面 key、`.Title` 作为文章标题传给 SDK，并以外部脚本延迟加载。若站点设置 CSP，`script-src`
和 `connect-src` 必须精确允许 Ecoku 的 HTTPS Origin；当前 SDK 样式边界另见试用前就绪清单，
不能把“无行内初始化脚本”误写成完整严格 CSP 兼容。

最后在 Ecoku 管理端创建相同的 `site_id`，并把 Hugo 本地预览与正式站点的实际 Origin 逐行加入
允许来源。浏览器端不应包含 management key、管理员 token 或通知凭据。
