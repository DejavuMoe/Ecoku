# Ecoku 管理端设计基线

本目录保存 Ecoku 管理端的已批准设计证据、脱敏 fixture 与发送模板设计基线。
`index-v15.html` 是已批准、待实施的设计稿；当前生产实现恢复为 `index-v13.html`，覆盖登录、评论管理、站点管理、通知设置与安全：
颜色、圆角与深色 token 与评论区 v17「纸与墨」一致，界面使用操作系统自带的 CJK 与英文无衬线字体栈，不加载网络字体。
仅供服务端渲染参考的通知模板为 v6（`email-notification-v6.html`、`telegram-notification-v6.html`），与 v13 使用同一套纸墨 token 与系统字体栈。v12 的关闭 / Cloudflare Turnstile / 自托管 Cap 三态语义与 Cap 官方组件几何在 v13 中保留，只映射 Ecoku token。停服恢复命令只属于自托管文档，不进入界面。原型文件本身不调用真实 API，也不进入运行时镜像。

## 当前产品边界

- 评论提交后直接发布；管理队列只包含“已发布”和“已删除”。
- 管理员可以将已发布评论改为隐私墓碑，并可对墓碑执行显式永久删除。
- 管理端支持站点创建和编辑：站点 ID、站点 URL、可选名称、允许来源、默认排序、字段要求、评论占位文案、长度上限与无评论文案。
- 站点可配置一组博主昵称与私有邮箱，供服务端识别博主本人并执行通知去重；两项必须同时填写或同时留空。
- 博主通知判定采用固定服务端规则，管理端不展示额外的判定预览表。
- 通知设置是实例级配置，支持 SMTP、Telegram、管理员新评论通知和访客回复通知。
- 邮件和 Telegram 模板使用站点名称；名称为空时回落到站点 URL 的域名。
- 管理端不展示模板预览，也不对外提供 `/admin/templates/*` 静态页面；实际发送模板只在服务端渲染。
- 管理员会话只保存在页面内存；浏览器端不接触站点 management key。
- 不存在待审核、批准、拒绝、批量审核或审核方式设置。
- 管理端配色默认 `auto`，跟随系统浅色/深色；深色 token 与评论区对齐。生产不提供主题切换器。

## 生产映射

`ui-contract.json` 记录原型与生产实现的对应关系。主要实现位于：

- `packages/admin/index.html`
- `packages/admin/src/App.vue`
- `packages/admin/src/components/CommentManagementView.vue`
- `packages/admin/src/components/SiteManagementView.vue`
- `packages/admin/src/components/NotificationSettingsView.vue`
- `packages/admin/src/style.css`
- `server/handle/admin/`
- `server/notifications/`

右下角“原型场景”切换器、配色预览、mock 数据和故障模拟只用于设计验收，不得进入生产管理端。

## 视觉来源

设计沿用评论区 v17 的暖纸张表面、墨色主操作、朱砂色危险操作、低对比细边框、6px / 3px 圆角与明确焦点状态；
深色模式使用与评论区相同的纸张、表面和正文 token。后台不继承宿主字体，统一使用系统字体栈。
可跟踪的站点接入示例位于 `examples/hugo-papermod/`。历史外部参考
`D:\Forgejo\Blog\designs\twikoo-theme-styles` 仅用于视觉方向，不构成生产文件映射。

## 文件

- `index-v15.html`、`styles-v15.css`、`prototype-v15.js`、`index-v15.test.mjs`：已批准，待实施，完整重做布局与交互，功能与接口不变。
  全站按“页边栏 + 正文栏”排版：页边栏放上下文（当前站点、日期、分节标题），正文栏宽 760px，与评论区阅读宽度接近；
  评论管理改为按日分组的评论流，排版沿用评论区的作者行、正文字号、`‹ 上一页 ｜ 1/26 ｜ 下一页 ›` 分页与“N 条评论”标题，
  每条直接列出私有邮箱、访客网站、文章标题、页面 key 与父评论（父评论在本页时引用其正文并可跳转），墓碑删除与彻底删除在该条评论下方就地确认；
  支持 J/K、O、Delete、Esc、R 快捷键。站点、通知、安全三页使用评论区身份栏式的行式字段，允许来源用逐行横线的多行输入，
  修改后才在底部出现保存栏（邮件与 Telegram 仍分别保存），离开前确认放弃修改；窄屏改为底部导航，日期栏吸顶。
  换用 `designs/brand/` 的「區」印章标志与 favicon。不新增会话面板、接入代码或接口字段；
- `index-v14.html`、`styles-v14.css`、`prototype-v14.js`、`index-v14.test.mjs`：已否决（通用的“列表栏 + 详情区”骨架，没有延续评论区的版式语言），仅作记录；
- `index-v13.html`、`styles-v13.css`、`prototype-v13.js`：上一版已批准的统一视觉基线（v0.2.6 实施）：颜色、圆角与阴影使用评论区 v17
  纸墨 token（含深色），界面字体为系统 CJK 与英文字体栈，重排五个界面的布局与文案；不新增功能、不改接口；
- `index-v12.html`：上一版已批准的实例级三态验证、Cap 配置与官方风格 Cap 登录组件；
- `index-v11.html`：上一版已批准的管理端系统衬线栈（站点配置，沿用 v8 表单）；
- `index-v10.html`：上一版已批准的 Turnstile-only 安全与登录验证；
- `index-v9.html`：上一版待审稿，含已撤销的小组件模式选择；
- `index-v8.html`：当前已批准站点配置、博主身份、评论区标志与 `auto` 配色设计基线；
- `index-v7.html`：上一版已批准站点配置、博主身份与 `auto` 配色设计证据；
- `index-v6.html`：上一版已批准站点配置与博主身份设计证据；
- `index-v5.html`、`styles-v5.css`、`prototype-v5.js`：当前评论管理和通知设置布局设计基线；
- `fixtures-v5.js`：脱敏的站点、评论与通知配置 fixture；
- `email-notification-v6.html`、`telegram-notification-v6.html`、`notifications-v6.js`、`notifications-v6.test.mjs`：当前已批准的发送模板设计基线。
  邮件改用评论区 v17 纸墨 token（含深色）、系统 CJK 无衬线字体栈与表格布局，Georgia 只用于 `Ecoku` 字标；主题附带文章标题，
  时间按容器时区显示并注明 UTC 偏移，表情包按站点当前清单来源渲染为图片、其余显示为文字标签；Telegram 被回复评论放入引用块，
  评论删除后已发出的消息改写为“这条评论已被删除”。`notifications-v6.js` 是两份预览与原型测试共用的参考渲染，服务端 `server/notifications` 按同一结构输出；
  仅供开发验证，不进入管理端构件；
- `email-*-v5.html`、`telegram-notification-v5.html`：上一版已批准发送模板设计证据；
- `index.html`、`index-v2.html`、`index-v4.html` 及配套文件：历史设计证据；
- `_d_meta.json`：设计审批元数据；
- `ui-contract.json`：原型到生产实现的合同。

所有示例邮箱、站点和 URL 都是脱敏 fixture，不得替换成真实凭据或私有配置。

## 本地预览与检查

从 `designs` 的父目录启动静态 HTTP 服务，然后打开：

```text
http://127.0.0.1:4311/admin-moderation/index-v13.html
http://127.0.0.1:4311/admin-moderation/index-v15.html
http://127.0.0.1:4311/brand/index-v2.html
http://127.0.0.1:4311/admin-moderation/email-notification-v6.html
http://127.0.0.1:4311/admin-moderation/telegram-notification-v6.html
```

执行无依赖静态契约测试：

```text
node designs/admin-moderation/index-v11.test.mjs
node designs/admin-moderation/index-v10.test.mjs
node designs/admin-moderation/index-v12.test.mjs
node designs/admin-moderation/index-v13.test.mjs
node designs/admin-moderation/index-v15.test.mjs
node designs/admin-moderation/notifications-v6.test.mjs
```
