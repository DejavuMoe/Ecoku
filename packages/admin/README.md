# Ecoku 管理端

这是 Ecoku 实例管理员使用的评论管理界面。生产构建由 Go 服务在
`/admin/` 下直接承载，并通过同源 `/api/admin/*` 接口工作。

范围包括：登录、站点注册与评论表单配置、已发布和已删除评论分页、评论详情、
墓碑及无后代墓碑的彻底删除，以及实例级 SMTP/Telegram 通知设置与测试投递。
管理员会话凭据保存在 HttpOnly Cookie 中，会话有效期固定为 8 小时；
刷新或重新打开页面会自动恢复有效会话。浏览器端不接触站点管理凭据（management key）。

```bash
pnpm test
pnpm type-check
pnpm build
```

当前没有 lint 脚本。`dist/` 是构建产物，不应被当作源码修改。

本地开发时如果 API 使用另一个端口，可在启动 Vite 前把
`ECOKU_ADMIN_DEV_API_URL` 设置为绝对 loopback URL。该选项仅供开发代理使用；
生产管理端始终调用同源 `/api/admin/*`。
