# Ecoku 命名统一验收记录

日期：2026-08-14

## 目标与边界

本次将项目遗留命名完整统一为 `ecoku`，并按语言和运行环境使用对应形式：

- 产品、TypeScript 类和浏览器全局：`Ecoku`
- npm 包、构建文件、静态资源与一般标识：`ecoku`
- Go 模块：`ecoku-server`
- 环境变量与常量：`ECOKU`

本次没有修改 HTTP 路由、评论领域数据、审核状态、通知行为或 UI 交互契约，也没有执行数据库迁移、部署、发布、推送或线上验收。

## 修改范围

### 浏览器 SDK

- SDK 入口及测试文件统一为 `src/ecoku.ts`、`src/ecoku.test.ts`。
- 默认导出类、配置类型、错误类型和错误消息统一使用 `Ecoku`。
- npm 包名统一为 `ecoku`。
- ESM、CommonJS、UMD 与类型声明输出统一使用 `ecoku.*`。
- UMD 仅暴露 `globalThis.Ecoku`。
- 客户端源码、构建配置、发布脚本、许可证、README、CHANGELOG 与发布说明同步更新。

### Go 服务端

- Go module 与全部内部 import 统一为 `ecoku-server/...`。
- 默认 SQLite 文件统一为 `./data/ecoku.bin`，并增加默认值测试。
- 服务端 API、数据库 schema 与运行逻辑保持不变。

### 文档、设计与验收记录

- 根 README、产品约束、静态站点集成文档、设计契约及 P0～P4 验收记录中的遗留命名同步更新。
- 历史分析文档保留其事实和结论，只修正命名边界及已不再成立的命名债务描述。
- 通用技术词 `markup` 及 Hugo `_markup` 配置不属于产品命名，保持原样。

### Hugo 测试站与构建产物

- Hugo 加载器改为检测并实例化 `window.Ecoku`。
- vendor 文件统一为 `static/vendor/ecoku.umd.js` 及对应许可证。
- Hugo partial 的资源指纹路径同步更新。
- SDK `dist`、Hugo `public/vendor` 与保留的验收构建产物同步为新文件名。

当前生产 UMD 与 Hugo vendor 文件 SHA-256：

`2daa8ba0ed4535b9cfb6cf960b180c975092b208159bb91c117a120e8f27668c`

## 自动化验证

| 命令或检查 | 结果 |
| --- | --- |
| `pnpm -C packages/client run test` | 通过；2 个测试文件、25 个测试 |
| `pnpm -C packages/client run type-check` | 通过 |
| `pnpm -C packages/client run build` | 通过；生成 ESM、UMD、CommonJS 与类型声明 |
| `pnpm -C packages/client run test:package` | 通过；包名、三种模块格式及唯一浏览器全局均正确 |
| `pnpm -C packages/client run validate` | 通过 |
| `go test -count=1 ./...` | 通过；使用临时 `GOCACHE` 避免用户缓存目录权限干扰 |
| `go vet ./...` | 通过；使用同一临时 `GOCACHE` |
| `pnpm -C packages/admin run test` | 通过；1 个测试文件、10 个测试 |
| `pnpm -C packages/admin run type-check` | 通过 |
| `pnpm -C packages/admin run build` | 通过 |
| `hugo --enableGitInfo=false --cleanDestinationDir` | 通过；测试站构建完成 |
| 全仓库遗留命名内容扫描 | 通过；排除通用 `markup` 后为 0 |
| 全仓库遗留命名路径扫描 | 通过；为 0 |
| 根仓库及 Hugo 嵌套仓库 `git diff --check` | 通过 |

## 本地浏览器验收

使用 Hugo 测试站文章 `/posts/my-2025-selfhosted-services-report/` 验证：

- 页面加载 `/js/ecoku-comments.js` 与 `/vendor/ecoku.umd.js`。
- SDK 指纹与上述 SHA-256 一致。
- 真实 API 返回 60 条评论并完整渲染线程。
- 折叠按钮可由展开切换为折叠并恢复。
- 分页可由 `1/4` 切换至 `2/4` 并恢复至 `1/4`。
- 未发现 Ecoku 相关控制台 warning 或 error；仅存在测试主题自身统计脚本忽略 localhost 的 warning。

## 兼容性与风险

- 这是完整命名迁移，不保留旧类名、旧浏览器全局、旧 npm 包名或旧构建文件名的兼容别名。
- 使用默认数据库配置的新启动会读取 `./data/ecoku.bin`。已有部署若曾依赖旧默认文件名，应在升级前显式设置 `database_path` 或完成文件改名；本次没有移动或修改任何实际数据库文件。
- Hugo 测试站原有用户修改和删除项均被保留，没有替用户回退或覆盖。

## 版本控制与交付状态

- 当前修改均位于本地工作区，尚未提交。
- 根仓库和嵌套 Hugo 仓库在本次开始前均存在用户自有未提交改动；本次没有创建提交、推送或发布。
- 未同步测试服务器，也未执行线上验收。
