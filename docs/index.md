---
layout: home
hero:
  name: Ecoku
  text: 自托管的<br>纯文本评论系统
  tagline: 给静态博客和个人网站用。一个 Docker 容器，一个 SQLite 文件，评论提交即公开。
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
  - title: 不收集访客信息
    details: 不保存 IP 和 User-Agent，公开接口不返回邮箱。访客身份只在浏览器里加密保存 7 天。
    link: /guide/concepts#data
  - title: 一个容器，一个文件
    details: 一个 Go 程序同时提供接口、管理后台和嵌入脚本，全部数据在一个 SQLite 文件中。
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
