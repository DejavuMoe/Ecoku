---
layout: home
hero:
  name: Ecoku
  text: 自托管的纯文本评论
  tagline: 多站点、SQLite、Docker Compose。提交即发布，不把邮箱和访客轨迹暴露给公共接口。
  image:
    src: /ecoku-hero.png
    alt: 连接评论线程与自托管数据的 Ecoku 插图
  actions:
    - theme: brand
      text: Docker 部署
      link: /self-hosting/docker
    - theme: alt
      text: 查看特性
      link: /guide/features
features:
  - title: 提交即发布
    details: 没有审核队列。根评论与回复在被回复处完成，线程无限层级，视觉缩进最多三级。
  - title: 隐私默认关闭
    details: 公共接口不返回邮箱、IP、UA 或管理字段。访客身份只在浏览器 IndexedDB 中加密保存 7 天。
  - title: 一个容器
    details: 精确版本镜像、SQLite 原位迁移、本机反代 HTTPS。管理端与评论 SDK 同源提供。
  - title: 通知可去重
    details: SMTP（TLS/STARTTLS）与 Telegram。博主口令证明身份；服务端按固定矩阵投递，后台不展示判定表。
---
