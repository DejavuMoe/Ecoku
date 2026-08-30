# 简介

Ecoku 是自托管的多站点纯文本评论系统。一个实例可服务多个站点，评论提交后立即公开。

适合静态博客、文档站，以及希望把评论数据留在自己服务器上的个人站点。生产环境使用 Docker Compose 与 SQLite3。

目前只发布 Docker 镜像，不公开分发源码。

## 适合什么

- 为多个站点提供评论区。
- 访客用昵称、邮箱和可选网站发表评论与回复。
- 可选邮件或 Telegram 通知；可从 Twikoo 一次性导入历史评论。
- 可用 Cloudflare Turnstile 或自托管 Cap 做人机验证。

## 不提供什么

评论正文是纯文本，不解析 HTML 或 Markdown。没有头像、点赞、富文本、普通用户账户、按站点审核队列或 MySQL。

管理员凭据和站点 management key 不得放入浏览器、URL 或页面 markup。

## 怎么跑

一个非 root 容器同时提供 API、管理端 `/admin/` 和评论前端 `/client/`。默认只绑定宿主机 `127.0.0.1:12123`，公网访问交给 HTTPS 反向代理。

站点、表单与通知在管理端配置，保存在 SQLite。首次部署见 [Docker 部署](/self-hosting/docker)，页面接入见 [通用 HTML](/integration/html)。
