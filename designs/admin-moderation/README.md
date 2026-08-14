# Ecoku 管理端设计基线

本目录保存 Ecoku 管理端的已批准设计证据、脱敏 fixture 与发送模板设计基线。
`index-v5.html` 是当前已批准且已经映射到生产管理端的基线；原型文件本身不调用真实 API，也不进入运行时镜像。

## 当前产品边界

- 评论提交后直接发布；管理队列只包含“已发布”和“已删除”。
- 管理员可以将已发布评论改为隐私墓碑，并可对墓碑执行显式永久删除。
- 管理端支持站点创建和编辑：站点 ID、站点 URL、可选名称、允许来源、默认排序、字段要求、评论占位文案、长度上限与无评论文案。
- 通知设置是实例级配置，支持 SMTP、Telegram、管理员新评论通知和访客回复通知。
- 邮件和 Telegram 模板使用站点名称；名称为空时回落到站点 URL 的域名。
- 管理端不展示模板预览，也不对外提供 `/admin/templates/*` 静态页面；实际发送模板只在服务端渲染。
- 管理员会话只保存在页面内存；浏览器端不接触站点 management key。
- 不存在待审核、批准、拒绝、批量审核或审核方式设置。

## 生产映射

`ui-contract.json` 记录原型与生产实现的对应关系。主要实现位于：

- `packages/admin/src/App.vue`
- `packages/admin/src/components/CommentManagementView.vue`
- `packages/admin/src/components/SiteManagementView.vue`
- `packages/admin/src/components/NotificationSettingsView.vue`
- `packages/admin/src/style.css`
- `server/handle/admin/`
- `server/notifications/`

右下角“原型场景”切换器、mock 数据和故障模拟只用于设计验收，不得进入生产管理端。

## 视觉来源

设计沿用测试 Hugo 主题的暖纸张表面、低对比细边框、克制圆角、宿主衬线字体与明确焦点状态。
可跟踪的站点接入示例位于 `examples/hugo-papermod/`。历史外部参考
`D:\Forgejo\Blog\designs\twikoo-theme-styles` 仅用于视觉方向，不构成生产文件映射。

## 文件

- `index-v5.html`、`styles-v5.css`、`prototype-v5.js`：当前管理端设计基线；
- `fixtures-v5.js`：脱敏的站点、评论与通知配置 fixture；
- `email-*-v5.html`、`telegram-notification-v5.html`：仅供开发验证的已批准发送模板设计基线，不进入管理端构件；
- `index.html`、`index-v2.html`、`index-v4.html` 及配套文件：历史设计证据；
- `_d_meta.json`：设计审批元数据；
- `ui-contract.json`：原型到生产实现的合同。

所有示例邮箱、站点和 URL 都是脱敏 fixture，不得替换成真实凭据或私有配置。

## 本地预览与检查

从 `designs` 的父目录启动静态 HTTP 服务，然后打开：

```text
http://127.0.0.1:4311/admin-moderation/index-v5.html
```

执行无依赖静态契约测试：

```text
node designs/admin-moderation/index-v5.test.mjs
```
