# Ecoku

自托管的多站点纯文本评论系统，适用于静态博客和文档站。评论提交后直接发布。当前提供 Docker 镜像，数据保存在自己的服务器上。

当前只发布 Docker 镜像，源码不作为公开发行物提供。站点可选启用 Smoji 表情包；资源由站点配置的远程清单提供，不打包进镜像。

## 快速开始

生产环境使用 Docker Compose 和 SQLite3：

- [Docker 部署](docs/self-hosting/docker.md)
- [反向代理](docs/self-hosting/reverse-proxy.md)
- [后台配置](docs/self-hosting/admin.md)
- [备份与恢复](docs/self-hosting/backup.md)
- [升级流程](docs/self-hosting/upgrade.md)

## 接入

- [通用 HTML](docs/integration/html.md)
- [Hugo PaperMod](docs/integration/hugo.md)
- [自定义 CSS](docs/integration/custom-css.md)

## 产品边界

Ecoku 只处理纯文本评论，不提供富文本、普通用户账户、点赞、头像或 MySQL。邮箱只用于评论身份和可选通知，不通过公共接口返回；管理员凭据和站点管理密钥不放入页面。
