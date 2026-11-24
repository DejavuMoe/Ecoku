# 站点设置

一个站点对应一个放评论区的网站。一个 Ecoku 实例可以有多个站点，每个站点有自己的评论和设置。

## 管理后台概览

后台在 `https://ecoku.example.com/admin/`，只有一个管理员账号，管理所有站点。

| 页面 | 作用范围 | 用途 |
| --- | --- | --- |
| 评论 | 当前站点 | [查看和删除评论](./comments) |
| 站点 | 当前站点 | 新增和编辑站点（本页） |
| 通知 | 整个实例 | [邮件与 Telegram](./notifications) |
| 安全 | 整个实例 | [人机验证](./captcha) |

有多个站点时，点左上角的站点名称切换。登录后会话保持 8 小时，到期后重新登录。

::: details 登录不了？
- 必须用 HTTPS 打开后台（`localhost`、`127.0.0.1` 除外）。
- 地址栏的来源要和 `notifications.instance_public_url` 完全一致，包括端口；配置了 `admin.allowed_origins` 时以它为准。
- 忘记密码用 [admin reset-password](../reference/cli#admin-reset-password)；人机验证坏了用 [captcha disable](./captcha#disable)。
:::

## 新增站点 {#sites}

在「站点」页点「新增站点」。必填的只有三项：

| 字段 | 填什么 |
| --- | --- |
| 站点 ID | 接入代码里的 `data-site-id`，例如 `blog`。字母或数字开头，可以有 `.`、`_`、`-`，最多 100 个字符。**创建后不能改。** |
| 站点 URL | 网站地址，例如 `https://blog.example.com`。通知和后台里的文章链接 = 站点 URL + 页面 key。 |
| 允许来源 | 能加载评论区的网站来源，见 [下文](#origins)。 |

其余字段都有默认值，之后随时可以改：

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| 站点名称 | 站点 URL 的域名 | 显示在后台和通知里，最多 120 个字符 |
| 评论区语言 | 简体中文 | 也可选繁體中文、English。接入代码可以覆盖。 |
| 评论排序 | 最新 | 访客打开评论区时的默认顺序，访客可以切换 |
| 访客邮箱 | 必填 | 可改为选填 |
| 访客网站 | 选填 | 可改为必填。昵称总是必填。 |
| 评论占位文案 | 「写下评论（仅支持纯文本）」 | 1～80 个字符 |
| 评论长度上限 | 1000 | 1～10000 个字符，一个汉字算一个 |
| 无评论文案 | 「还没有评论」和「成为第一个留下评论的人。」两行 | 1～240 个字符，可以换行 |
| 表情包 | 关闭 | 见 [Smoji 表情](../integration/smoji) |

保存后，用站点 ID 去 [接入评论区](../integration/html)。

## 允许来源 {#origins}

来源是 `协议://域名[:端口]`，不带路径。评论区所在页面的来源不在列表里时，浏览器读取和提交评论都会被拒绝。

- `https://blog.example.com` 和 `https://www.blog.example.com` 是两个来源，能访问博客的域名都要写上。
- 本地预览博客时，把 `http://localhost:1313` 这样的地址也加上。
- 不能填管理后台自己的来源。后台和博客必须用不同的域名，原因见 [配置生效与来源检查](../reference/configuration#reload)。

可以一次粘贴多行或逗号分隔的多个来源，最多 32 个。

## 站点 URL 与页面路径 {#site-url}

博客部署在子目录、页面 key 已经包含这个子目录时，站点 URL 不要再带它。

| 页面 key | 站点 URL | 拼出的链接 |
| --- | --- | --- |
| `/blog/posts/hello/` | `https://example.com` | `https://example.com/blog/posts/hello/` ✓ |
| `/blog/posts/hello/` | `https://example.com/blog` | `https://example.com/blog/blog/posts/hello/` ✗ |

## 博主身份

在站点里设置博主昵称、邮箱和口令后，你可以在评论区以博主身份发言，见 [博主身份](./blogger)。
