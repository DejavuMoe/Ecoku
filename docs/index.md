---
layout: home
hero:
  name: Ecoku
  text: 自托管的纯文本评论
  tagline: Docker 部署，数据放 SQLite。一个实例服务多个站点，评论提交后立即公开。
  image:
    src: /ecoku-hero.png
    alt: Ecoku 示意图
  actions:
    - theme: brand
      text: Docker 部署
      link: /self-hosting/docker
    - theme: alt
      text: 特性说明
      link: /guide/features
features:
  - title: 提交即公开
    details: 没有审核队列。回复写在原评论下方，可多层嵌套。
  - title: 公开接口不含隐私字段
    details: 不返回邮箱、IP、UA。访客身份只在浏览器 IndexedDB 加密保存 7 天。
  - title: 单个容器
    details: 固定镜像版本，数据挂在宿主机。管理端与评论 SDK 由同一服务提供。
  - title: 邮件与 Telegram
    details: 可选 SMTP 或 Telegram 通知。博主可用口令证明身份。
---
