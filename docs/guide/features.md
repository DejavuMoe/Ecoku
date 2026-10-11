# 功能

按使用者分组列出 Ecoku 当前版本（v0.5.0）的功能，每项末尾的链接指向详细说明。

## 访客

- 无需注册，填写昵称、邮箱和网址即可发言；邮箱与网址的必填性由站点配置决定（默认邮箱必填、网址选填）。[访客身份](./concepts#visitor-identity)
- 在任意评论下就地回复，缺少的身份信息直接在回复框内补填。
- 浏览器本地加密记住身份 7 天，不使用 Cookie。
- 发布前支持实时预览；字数按 Unicode 字符计算，一个汉字计为一个字符。
- 支持在最新、最早两种排序之间切换。
- 支持折叠长讨论分支。
- 站点启用表情包后，可插入 Smoji 表情。 [Smoji 表情包](../integration/smoji)

## 博主

- 在评论区昵称栏输入口令，即可按博主身份发布并显示博主标志。 [博主身份](./concepts#blogger)
- 新评论与新回复即时通过邮件或 Telegram 通知。 [通知](../self-hosting/notifications)
- 访客评论收到回复时，自动向被回复者发送邮件通知。

## 管理员

- 单实例注册并管理多个站点，独立配置来源白名单、默认排序、必填字段、字数上限与提示文字。 [管理后台](../self-hosting/admin#sites)
- 按「已发布 / 已删除」筛选评论流，可直达原文所在位置。
- 墓碑删除保留上下文结构；无后代的墓碑可彻底删除。 [删除](./concepts#deletion)
- 在关闭、Cloudflare Turnstile、自托管 Cap 三种人机验证之间切换，同时保护评论与后台登录。 [人机验证](../self-hosting/captcha)
- 支持从 Twikoo 导入历史评论。 [从 Twikoo 迁移](../self-hosting/twikoo)

## 接入

- 一段 HTML 加一个脚本即可嵌入，适用于各种静态网站生成器。 [HTML 接入](../integration/html)
- 在 Vue、React 等单页应用中切换文章时，评论区跟随切换。 [JavaScript SDK](../integration/sdk)
- 提供 Hugo PaperMod 主题的现成模板。 [Hugo PaperMod](../integration/hugo)
- 默认样式通过 CSS 变量调整颜色、圆角和字号；也可使用结构样式或完全自写样式。 [自定义样式](../integration/custom-css)
- 自动继承页面的浅色与深色模式。

## 运维

- 单个 Docker 容器运行，采用非 root 用户与只读文件系统。 [Docker 部署](../self-hosting/docker)
- 停服备份数据目录、持久密钥与配置文件即可完整保存状态。 [备份与恢复](../self-hosting/backup)
- 升级时数据库自动顺序迁移，既有业务数据原位保留。 [升级](../self-hosting/upgrade)
- 基于 IP 进行内存限流，支持位于反向代理和 CDN 之后。 [反向代理](../self-hosting/reverse-proxy)
- 通知通过数据库 Outbox 队列异步投递，失败自动重试，不阻塞评论提交。

## 隐私

- 不持久化或记录访客 IP、User-Agent 与地理位置。 [保存和公开的数据](./concepts#data)
- 邮箱不出现在任何公开接口中。
- SMTP 密码、Bot Token 与人机验证密钥在数据库中加密存储，管理端不回显明文。
- 评论区前端不请求任何第三方头像、统计分析或 IP 查询服务。
