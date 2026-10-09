---
layout: home
hero:
  name: Ecoku
  text: 自托管，多站点<br>专注文字讨论
  tagline: 给博客与个人网站的评论系统。访客无需注册，评论提交即公开，数据由你保管。
  image:
    src: /logo.svg
    alt: Ecoku 标识
  actions:
    - theme: brand
      text: 开始部署
      link: /self-hosting/docker
    - theme: alt
      text: 了解 Ecoku
      link: /guide/introduction
    - theme: alt
      text: 嵌入评论区
      link: /integration/html

features:
  - title: 提交即公开
    details: 无审核队列。回复就地展开，删除保留墓碑，讨论上下文始终连贯。
    link: /guide/concepts#threads
  - title: 不记录访客 IP
    details: 仅保存昵称、正文与访客填写的邮箱和网址；公开接口不返回邮箱，不记录访客 IP 与 User-Agent。浏览器本地加密记住身份 7 天。
    link: /guide/concepts#data
  - title: 单容器独立运行
    details: Go 单二进制整合接口、管理后台与嵌入脚本；SQLite 存储业务数据，密钥独立持久化。冷备数据目录、配置与 Compose 即可恢复。
    link: /guide/introduction#components
  - title: 多站点支持
    details: 单实例服务多个网站，各站点独立配置来源白名单、表单字段、限制规则与博主身份。
    link: /self-hosting/admin#sites
  - title: 通知与人机验证
    details: 新评论即时通过邮件或 Telegram 通知博主；支持 Cloudflare Turnstile 与自托管 Cap 防刷。
    link: /self-hosting/notifications
  - title: 一段 HTML 即可接入
    details: 适用于 Hugo、Hexo、Astro 等静态站点与 Vue、React 单页应用；支持通过 CSS 变量自由调整样式。
    link: /integration/html
---
