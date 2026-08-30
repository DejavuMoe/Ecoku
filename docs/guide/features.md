# 特性

## 评论

- 纯文本，提交后立即公开，没有审核队列。
- 回复写在被回复评论下方；数据层可无限嵌套，界面缩进最多三级。
- 根评论分页，当前页带上该批根评论的全部公开回复。
- 可按最新或最早排序。
- 删除保留占位（墓碑），不拆散线程；墓碑不可再回复。
- 可选启用 Smoji 表情包；选择器按需加载同源清单，表情以纯文本标记保存。

## 身份与隐私

- 昵称必填；邮箱与网站是否必填由站点配置（默认邮箱必填、网站可选）。
- 访客身份在浏览器 IndexedDB 中加密保存 7 天，不写入 localStorage、Cookie 或 URL。
- 公开接口不返回邮箱、IP、User-Agent、地区或密钥。

## 管理与通知

- `/admin/` 配置站点、评论、博主身份、通知和人机验证。
- 博主由昵称与邮箱共同匹配，可显示博主标记；启用时用口令证明身份。
- 通知支持 SMTP 与 Telegram；规则与渠道配置见 [后台配置](/self-hosting/admin#通知)。
- 人机验证按实例选择关闭、Cloudflare Turnstile 或自托管 Cap；启用后同时保护评论提交与管理员登录。

## 数据与接入

- 仅 SQLite；多站点；schema 原位顺序迁移。
- 资源：`/client/ecoku-loader.js`、`/client/ecoku.umd.js`、`/client/ecoku.css`、`/client/ecoku.unstyled.css`。
- 接入需要服务地址、站点 ID、稳定的页面 key，以及可选的页面标题。详见 [通用 HTML](/integration/html)。
