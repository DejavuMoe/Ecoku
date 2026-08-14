# ecoku 发布候选检查

P4 仅准备 3.0.0 发布候选；没有授权执行 `npm publish`、创建 Git tag、GitHub
Release 或推送镜像。仓库当前也没有 Git 元数据，因此无法形成可追溯发布。

## 兼容性

- ESM：`dist/ecoku.es.js`
- 浏览器 `<script>` UMD：`dist/ecoku.umd.js`，全局名 `Ecoku`
- 静态站点加载器：`dist/ecoku-loader.js`，由 Ecoku 服务端与 UMD 同源托管
- CommonJS：`dist/ecoku.cjs`
- TypeScript：`dist/ecoku.d.ts`

3.0.0 移除了旧的预置 DOM 模板协议。迁移时应改为一个空容器，
并显式传入 `container`、`serverURL`、`siteId` 与页面 `pageKey`。

## 本地发布候选门禁

```bash
pnpm clean
pnpm test
pnpm type-check
pnpm build
pnpm test:package
pnpm validate
npm pack --dry-run
```

必须人工检查 `npm pack --dry-run` 清单：只允许 `dist/`、`README.md`、
`CHANGELOG.md`、`LICENSE` 和 `package.json`；不能包含源码秘密、测试数据库、环境配置或临时
文件。真正发布前还必须重新获得版本、registry、Git tag 与发布权限确认。
