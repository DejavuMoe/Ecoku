# 功能

按使用者分组列出 Ecoku 当前版本（v0.5.0）的功能。每项后面的链接指向详细说明。

## 访客

- 不用注册，填写昵称、邮箱和网址即可发言；邮箱和网址是否必填由站点决定（默认邮箱必填、网址选填）。[访客身份](./concepts#visitor-identity)
- 在任意评论下直接回复，回复框就地展开，缺少的身份信息在回复框里补填。
- 浏览器加密记住身份 7 天，不使用 Cookie。
- 发布前可以预览；字数按 Unicode 字符计算，一个汉字算一个。
- 在最新、最早两种排序之间切换。
- 折叠长讨论分支。
- 站点启用表情包后，可以插入 Smoji 表情。[Smoji 表情包](../integration/smoji)

## 博主

- 在评论区昵称栏输入口令，即以博主身份发布，并显示博主标志。[博主身份](./concepts#blogger)
- 新评论、新回复通过邮件或 Telegram 通知。[通知](../self-hosting/notifications)
- 访客被回复时，自动发邮件告诉对方。

## 管理员

- 一个实例注册多个站点，各自设置允许来源、默认排序、必填字段、字数上限、提示文字。[管理后台](../self-hosting/admin#sites)
- 按「已发布 / 已删除」浏览评论，一键跳到原文位置。
- 墓碑删除保留讨论结构；没有回复的墓碑可以彻底删除。[删除](./concepts#deletion)
- 在关闭、Cloudflare Turnstile、自托管 Cap 三种人机验证之间切换，同时保护评论与后台登录。[人机验证](../self-hosting/captcha)
- 从 Twikoo 导入历史评论。[从 Twikoo 迁移](../self-hosting/twikoo)

## 接入

- 一段 HTML 加一个脚本即可嵌入，适用于任何静态网站。[HTML 接入](../integration/html)
- 在 Vue、React 等单页应用中切换文章时，评论区跟随切换。[JavaScript SDK](../integration/sdk)
- 提供 Hugo PaperMod 主题的现成模板。[Hugo PaperMod](../integration/hugo)
- 默认样式通过 CSS 变量调整颜色、圆角和字号；也可以只用结构样式或完全自己写。[自定义样式](../integration/custom-css)
- 跟随页面的浅色与深色模式。

## 运维

- 单个 Docker 容器，非 root、只读文件系统运行。[Docker 部署](../self-hosting/docker)
- 停服备份整个数据目录、持久密钥和配置。[备份与恢复](../self-hosting/backup)
- 升级时数据库自动迁移，已有数据原地保留。[升级](../self-hosting/upgrade)
- 按 IP 限流，支持放在反向代理和 CDN 后面。[反向代理](../self-hosting/reverse-proxy)
- 通知通过数据库队列异步发送，失败自动重试，不影响评论提交。

## 隐私

- 不保存访客 IP、User-Agent 或地理位置。[保存和公开的数据](./concepts#data)
- 邮箱不出现在任何公开接口中。
- SMTP 密码、Bot Token、人机验证密钥加密后存入数据库，后台只显示「已设置」。
- 评论区不请求第三方头像、统计或 IP 查询服务。
