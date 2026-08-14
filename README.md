# Ecoku

Ecoku 是面向自托管场景的多站点纯文本评论系统。当前版本提供访客评论、无限语义层级回复、
隐私墓碑、独立实例管理员、站点配置、SMTP/Telegram 通知、浏览器 SDK 与 SQLite3 持久化。

- 评论提交后立即公开，不存在待审核、批准或拒绝状态；
- 公共 DTO 永不返回邮箱、管理字段、IP、UA 或地区；
- 每站点可配置允许来源、默认排序、字段必填性、占位文案、Unicode 字符上限和空状态文案；
- 管理端入口为 `/admin/`，管理员 token 只保存在当前页面内存；
- 只支持 SQLite3。当前 schema 不迁移旧数据库，升级到不兼容版本时须先备份再重建。

运维文档：

- [首次 RC 推送与 CI/CD 验收](docs/operations/first-release.md)
- [自托管指南](docs/operations/self-hosting.md)
- [Caddy / Nginx 反向代理](docs/operations/reverse-proxy.md)
- [SQLite 备份、重建与恢复](docs/operations/backup-and-upgrade.md)
- [Forgejo + Woodpecker CI 与多架构镜像发布](docs/operations/woodpecker-ci.md)
- [试用前就绪检查、性能与资源复用](docs/operations/pretrial-readiness.md)
- [一般静态网站接入](docs/integrations/static-site.md)

## 首次部署顺序

无论选择本机二进制还是 Docker Compose，首次部署都遵循同一顺序：

1. 准备只含公开配置的 `config.yaml`，把管理员哈希、token key 和通知加密密钥放进受保护的环境文件；
2. 按[一般二进制部署](docs/operations/self-hosting.md#3-一般二进制部署)或
   [Docker Compose 部署](docs/operations/self-hosting.md#4-docker-compose-部署)启动空数据库；
3. 按[Caddy / Nginx 反向代理](docs/operations/reverse-proxy.md)配置 TLS，检查 `/api/health`，
   登录 `/admin/`，在「站点管理」中添加站点并填写精确允许来源；
4. 若从 Twikoo 迁移，在该站点仍为空时停服、备份、预检并执行一次导入；
5. 由内容站点直接引用 Ecoku 容器提供的 `/client/ecoku-loader.js`，再按
   [一般静态网站接入指南](docs/integrations/static-site.md)传入相同的站点 ID 和稳定页面 key。

完整的文件权限、systemd、Compose、首次初始化和 Twikoo 导入命令均在
[自托管指南](docs/operations/self-hosting.md)中，不能用此摘要替代备份与权限步骤。

## Hugo 站点接入示例

下面以仓库中可跟踪的 `examples/hugo-papermod` 最小示例为例。生产镜像同源提供加载器与 UMD，
Hugo 不需要保存或同步 SDK 副本。

1. 在 Hugo 配置中声明服务端和站点 ID：

   ```yaml
   params:
     comments: true
     ecoku:
       server_url: "https://ecoku.via.moe"
       site_id: "blog"
   ```

2. 把 [`comments.html`](examples/hugo-papermod/layouts/_partials/comments.html) 合并到主题实际使用的
   评论 partial。页面 key 与文章标题必须由 Hugo 明确传入：

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

   生产模板必须使用 Hugo 的上下文转义能力，不要把访客输入拼进属性或脚本。加载器会从相同
   Ecoku Origin 获取 UMD，并负责滚动到附近后加载、失败提示和重试；页面不需要行内初始化脚本。

3. 在管理端创建站点，填写相同的站点 ID、规范站点 URL 和浏览器实际 Origin。站点名称可留空；
   留空时通知与管理端自动使用 URL 的域名。浏览器不能接收 management key。

非 Hugo 网站、多个页面 key 的生成规则、SDK 升级和 CORS 验证见
[一般静态网站接入](docs/integrations/static-site.md)。

## 仓库结构

- `server/`：Go API、SQLite3、导入器与通知投递；
- `packages/client/`：可独立分发的浏览器 SDK；
- `packages/admin/`：由服务端同源托管的管理端；
- `designs/`：已批准设计基线及 `archive/` 历史原型，不进入运行时镜像；
- `examples/`：可复制的最小站点接入示例；
- `deploy/`、`docs/operations/`：自托管配置与运维说明；
- `.woodpecker/`：测试、双架构镜像构建和 manifest 发布工作流；
- `VERSION`、`CHANGELOG.md`：服务端容器发布版本与候选版本变更记录；

更完整的所有权和发布边界见[仓库目录约定](docs/architecture/repository-layout.md)。

## Twikoo 首次导入

Twikoo 导入只适用于已经创建、但还没有任何评论的 Ecoku 站点。它保留时间、昵称、私有邮箱、
访客网站、页面 key、回复层级和转换后的纯文本正文；不导入 IP、UA、地区、头像、赞踩或外部用户 ID，
也不会发送历史通知。

先停服并备份 SQLite，然后使用同一份私有配置执行预检。下面是 Compose 场景；二进制部署的
等价命令与完整恢复步骤见[自托管指南](docs/operations/self-hosting.md#6-添加站点后首次导入-twikoo)：

```bash
docker compose run --rm --no-deps \
  --volume /absolute/path/twikoo-comment.json:/tmp/twikoo-comment.json:ro \
  ecoku import-twikoo --site blog --file /tmp/twikoo-comment.json --dry-run
```

确认摘要中的评论数、页面数、回复数和缺失父记录数后，去掉 `--dry-run` 执行一次正式导入。
目标站点一旦已有评论，命令会拒绝运行；整批导入使用单个事务，失败不会留下部分数据。原始导出
含私有邮箱，不得放入 Git、构建上下文、日志、截图或工单。

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

仓库中的历史 P0～P4 验收记录只描述当时版本，不约束当前直接发布模型。是否提交、推送、发布、
迁移或清理真实环境，仍以当前任务的明确授权为准。
