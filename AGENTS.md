# Ecoku Agent 工作约定

## 当前事实来源

- 以当前源码、`docs/product/constraints.md` 和 `docs/operations/self-hosting.md` 为准。
- `docs/progress/` 只保存历史验收证据；早期阶段、旧 schema 和旧 UI 描述不约束当前实现。
- 评论区当前批准基线为 `designs/plain-thread-comments/index-v9.html`；管理端当前批准基线为
  `designs/admin-moderation/index-v7.html`，但生产管理端不得展示“通知判定预览”。
- 若产品、安全、隐私、数据库、部署或发布边界不明确，先调查，再集中向用户确认。

## 产品与数据边界

- Ecoku 是 SQLite3-only 的多站点、自托管、纯文本评论系统；评论提交后直接发布。
- 公共 DTO 不得包含邮箱、管理字段、IP、UA、地区、密钥或完整数据库模型。
- 访客身份仅包含昵称、私有邮箱和可选网站。SDK 可在 IndexedDB 中加密保存 7 天；不得写入
  localStorage、cookie 或 URL，也不提供多余的主动清除界面。
- 回复必须在被回复评论处直接完成；缺少身份时在该回复框内采集身份，不能跳回根评论表单后误发为根评论。
- 站点的博主身份由昵称与邮箱共同精确匹配，用于通知去重；这套默认判定不在管理端展示说明表。
- SQLite 迁移原位、顺序、事务化执行。迁移成功只增加 schema 版本记录，不自动删除数据库、评论、
  配置、WAL 文件或管理员备份，也不提供向下迁移。

## 仓库与发布边界

- `server/`、`packages/client/`、`packages/admin/` 是运行时代码；`designs/`、`examples/` 和
  `docs/progress/` 不进入运行时镜像。
- 根 `VERSION` 是容器 / OCI 候选版本的唯一文本来源：整文件一行、不带前导 `v`。它不进入 Go 或
  `pnpm` 日常构建，也不驱动 `packages/client`、`packages/admin` 的 package 版本。
- 准备容器发版提交时，必须把同一版本号同步到这四项，缺一不可：
  - `VERSION`（无 `v`）
  - 根 `package.json` 的 `version`（与 `VERSION` 相同）
  - `compose.yaml` 的 `image`，精确写成 `git.via.moe/dejavu/ecoku:v` + `VERSION`；禁止
    `ECOKU_VERSION` 占位符或浮动 tag
  - `CHANGELOG.md` 对应章节与页脚 tag 链接
- 发布 Git tag 必须为 `v` + `VERSION` 的整行内容。Woodpecker 只在 `v*` tag 上构建镜像，并用
  `CI_COMMIT_TAG`（带 `v`）作为镜像 tag 和 OCI `org.opencontainers.image.version`。tag 流水线会
  校验去掉 `v` 后与 `VERSION` 完全一致，且 `compose.yaml` 已钉死同一 tag。改 `VERSION` 本身不会
  生成镜像。
- 私有 Forgejo 源仓库可以发布公开 OCI 镜像。Woodpecker 在原生 `linux/amd64` 与 `linux/arm64`
  Agent 上测试和构建，再合并同一 tag 的 manifest；CI 不部署生产服务器、不读取生产配置、不迁移生产数据库。
- 文档和示例只使用 `<REGISTRY_HOST>`、`<OWNER>`、`comments.example.com`、`blog.example.com`
  等占位符。真实域名、密码、token、SMTP 凭据、Telegram Token、数据库和日志不得进入 Git。
- 提交、推送、tag、镜像发布、生产部署和真实数据库操作均需要当前任务的明确授权。
- 每次发版（新 tag）若可能影响生产平滑升级——包括 schema、Compose 挂载、配置键、日志出口
  或镜像契约——必须在回复中先给出：停服冷备份、改精确镜像 tag、
  `sudo docker compose pull && sudo docker compose up -d`、健康检查与回滚步骤。未经当前任务
  明确授权，不得对生产服务器或生产数据库执行这些步骤。

## 修改后的最低验证

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

涉及设计基线时还要执行对应的无依赖原型测试；涉及容器时校验 `sudo docker compose config`、
健康检查和精确镜像 tag。分别报告自动化、本地浏览器、条件性和未验证项。
