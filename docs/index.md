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
    details: 没有审核队列。回复在被回复的评论下方展开，删除时保留墓碑，讨论上下文不会断。
    link: /guide/concepts#threads
  - title: 不记录访客 IP
    details: 评论会保存昵称、正文及填写的邮箱、网址；公开接口不返回邮箱，不保存 IP 和 User-Agent。浏览器可加密记住身份 7 天。
    link: /guide/concepts#data
  - title: 一个容器，便于自托管
    details: Go 程序提供接口、后台和嵌入脚本；SQLite 保存业务数据，密钥独立持久化。备份整个数据目录和配置。
    link: /guide/introduction#components
  - title: 多站点
    details: 一个实例服务多个网站，每个站点有独立的来源白名单、评论设置和博主身份。
    link: /self-hosting/admin#sites
  - title: 通知与人机验证
    details: 新评论通过邮件或 Telegram 通知博主；可选 Cloudflare Turnstile 或自托管 Cap 防刷。
    link: /self-hosting/notifications
  - title: 一段 HTML 即可接入
    details: 适用于 Hugo、Hexo、Astro 等任何静态网站，也支持 Vue、React 单页应用；样式可用 CSS 变量调整。
    link: /integration/html
---
