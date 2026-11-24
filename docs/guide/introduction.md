# 介绍

Ecoku 是一个自托管的评论系统，给 Hugo、Hexo、Astro、VitePress 这类静态网站用。你在自己的服务器上运行一个 Docker 容器，在文章模板里加一段 HTML，文章底部就有了评论区。

访客不需要注册，填好昵称和邮箱就能发表评论，评论提交后立即显示。回复在被回复的评论下方展开。本站每一页的底部就是一个 Ecoku 评论区。

## 它由什么组成 {#components}

<figure class="doc-diagram" tabindex="0" aria-label="系统组成图，可横向滚动">
  <img class="diagram-light" src="/diagrams/components.zh-CN.light.svg" width="1110" height="304" loading="lazy" decoding="async" alt="访客和管理员浏览器经反向代理访问 Ecoku 服务；服务连接 SQLite 数据库并发送 SMTP 或 Telegram 通知。">
  <img class="diagram-dark" src="/diagrams/components.zh-CN.dark.svg" width="1110" height="304" loading="lazy" decoding="async" alt="访客和管理员浏览器经反向代理访问 Ecoku 服务；服务连接 SQLite 数据库并发送 SMTP 或 Telegram 通知。">
</figure>

| 部分 | 说明 |
| --- | --- |
| `ecoku-server` | 容器里唯一的程序。提供评论接口、管理后台 `/admin/`、博客加载的脚本 `/client/`，并在后台发送通知。 |
| SQLite 数据库 | 存放所有站点、评论和设置。旁边的 `ecoku-secrets.json` 保存密钥，两者一起备份。 |
| 反向代理 | 你自己的 Caddy 或 Nginx，负责 HTTPS。容器只监听本机 `127.0.0.1:12123`。 |
| 评论区脚本 | 博客页面加载的 `ecoku-loader.js`，也可以用 npm 包 `ecoku`。 |

不需要 MySQL、Redis 或其他外部服务。

## 它不做什么

- 不渲染 Markdown 或 HTML，不能上传图片。[Smoji 表情](../integration/smoji) 是唯一显示为图片的内容。
- 没有访客账号、第三方登录和头像。
- 没有点赞和审核队列。评论提交后直接公开，你在后台事后删除。
- 只支持 SQLite。

如果其中某一项是你必须要的，Ecoku 可能不适合你。

## 隐私

Ecoku 不保存访客的 IP、User-Agent 和地理位置。访客填的邮箱只用于通知，不会出现在任何公开接口里。评论区不请求第三方头像、统计或 IP 查询服务。详见 [保存和公开的数据](../reference/concepts#data)。

## 从哪里开始

<div class="cards">
<Card title="快速上手" link="/guide/quick-start" icon="rocket">十几分钟走完部署到嵌入的全过程。</Card>
<Card title="工作原理" link="/reference/concepts" icon="book">页面 key、回复层级、删除和身份是怎么工作的。</Card>
<Card title="HTML 接入" link="/integration/html" icon="code">已经有 Ecoku 服务，只想把评论区放进博客。</Card>
<Card title="从 Twikoo 迁移" link="/self-hosting/twikoo" icon="download">把 Twikoo 的历史评论导入 Ecoku。</Card>
</div>
