# Ecoku

Ecoku 是面向自托管场景的多站点纯文本评论系统。当前实现提供访客评论、无限语义层级回复、
隐私墓碑、独立实例管理员、站点配置、SMTP/Telegram 通知、浏览器 SDK、Twikoo 首次导入和
SQLite3 持久化。

- 评论提交后立即公开，不存在待审核、批准或拒绝状态；
- 公共 DTO 永不返回邮箱、管理字段、IP、UA 或地区；
- 每站点可配置允许来源、默认排序、字段要求、占位文案、Unicode 字符上限、空状态文案和博主身份；
- 回复在被回复评论处完成；访客身份可在浏览器 IndexedDB 中加密保留 7 天；
- 管理端入口为 `/admin/`，管理员 token 只保存在当前页面内存；
- 只支持 SQLite3，schema 通过显式、事务化迁移原位升级。

部署、首次初始化、反向代理、备份升级、Twikoo 导入、通用静态站点与 Hugo PaperMod 接入均见
[Docker Compose 自托管指南](docs/operations/self-hosting.md)。产品与隐私边界见
[产品约束](docs/product/constraints.md)。

## 最小 Hugo 接入

镜像同源提供 `/client/ecoku-loader.js` 与 `/client/ecoku.umd.js`，内容站点不需要复制 SDK。

```yaml
params:
  comments: true
  ecoku:
    server_url: "https://comments.example.com"
    site_id: "blog"
```

```html
<section
  id="ecoku-comment-shell"
  data-ecoku-comments
  data-server-url="{{ site.Params.ecoku.server_url }}"
  data-site-id="{{ site.Params.ecoku.site_id }}"
  data-page-key="{{ .RelPermalink }}"
  data-page-title="{{ .Title }}"
>
  <div data-ecoku-mount></div>
</section>
<script src="{{ site.Params.ecoku.server_url }}/client/ecoku-loader.js" defer></script>
```

调用方必须明确提供稳定的页面 key；SDK 不从浏览器 URL 猜测。完整示例位于
[`examples/hugo-papermod`](examples/hugo-papermod)。

## 仓库结构

- `server/`：Go API、SQLite3、迁移、Twikoo 导入与通知投递；
- `packages/client/`：浏览器 SDK、UMD 与静态站点加载器；
- `packages/admin/`：服务端同源托管的管理端；
- `designs/`：已批准设计基线和历史原型，不进入运行时镜像；
- `examples/`：不含私有数据的接入示例；
- `deploy/`、`compose.yaml`：Docker Compose 部署模板；
- `.woodpecker/`：测试、双架构镜像构建和 manifest 发布；
- `VERSION`：不带前导 `v` 的容器版本；发布 tag 必须与其一致；
- `CHANGELOG.md`：候选版本变更和升级边界。

详细所有权见[仓库目录约定](docs/architecture/repository-layout.md)。

## 开发验证

```powershell
cd server
go test -count=1 ./...
go vet ./...

pnpm --dir packages/client test
pnpm --dir packages/client type-check
pnpm --dir packages/client build

pnpm --dir packages/admin test
pnpm --dir packages/admin type-check
pnpm --dir packages/admin build
```

`docs/progress/` 中的 P0～P4 与专项验收记录只描述当时版本。提交、推送、tag、发布、生产迁移
和清理真实数据仍需单独授权。
