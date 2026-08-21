# 项目介绍

Ecoku 是面向自托管场景的多站点纯文本评论系统。一个实例可以挂多个站点；评论提交后立即公开。

它适合静态博客、文档站，以及不想把评论交给第三方 SaaS 的个人站点。生产部署只支持 Docker Compose + SQLite3。

## 做什么

- 访客评论：昵称必填；邮箱与网站是否必填由站点配置。
- 无限语义层级回复；公开列表按根线程分页。
- 删除保留墓碑，后代回复仍在。
- 实例级管理员：站点、评论、通知、机器人验证。
- 浏览器 SDK：镜像同源 `/client/ecoku-loader.js`。
- 可选：SMTP / Telegram 通知、Twikoo 首次导入、Cloudflare Turnstile 或自托管 Cap。

## 不做什么

纯文本正文，不解释 HTML 或 Markdown。没有头像、赞踩、富文本、普通用户注册、按站点审核，也不提供 MySQL。

管理密钥和站点 management key 不得放进浏览器、URL 或页面 markup。

## 运行形态

一个非 root 容器同时提供 API、管理端 `/admin/` 和评论前端。端口绑在宿主机 `127.0.0.1:12123`，公网走本机 Caddy 或 Nginx。

数据在容器外：

| 路径 | 用途 |
| --- | --- |
| `app/config.yaml` | 公开配置（端口、日志、可信代理、管理端来源） |
| `ecoku.env` | 管理员凭据、通知加密主密钥、时区 |
| `data/` | SQLite 主库与 WAL |
| `app/logs/` | 可选文件日志副本 |

站点、评论表单和通知渠道由管理端写入 SQLite。YAML 里的 `sites` 只在空库首次初始化时导入。

## 版本

容器版本以仓库根 `VERSION` 为准，Git tag 为 `v` + 该值。`compose.yaml` 使用精确镜像 tag，不要用 `latest`。

下一步：[特性](/guide/features) 或 [Docker 部署](/self-hosting/docker)。
