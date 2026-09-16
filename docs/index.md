---
layout: home
hero:
  name: Ecoku
  text: 自托管的<br>纯文本评论系统
  tagline: 为静态博客与个人站点而生。极简单容器架构，数据全在 SQLite，提交后立即公开。
  image:
    src: /ecoku-hero.png
    alt: Ecoku 示意图
  actions:
    - theme: brand
      text: 快速开始部署
      link: /self-hosting/docker
    - theme: alt
      text: 核心设计与机制
      link: /guide/concepts
    - theme: alt
      text: 客户端快速接入
      link: /integration/html

features:
  - title: 提交即发布 · 讨论不中断
    details: 无审核队列，回复直达原评论下方；数据层无限嵌套语义，视觉最多 3 级缩进，软删除保留墓碑上下文。
    link: /guide/concepts#树状评论与分页模型
  - title: 严格隐私边界 · 零泄露
    details: 公开 API 绝不返回邮箱、IP 或 User-Agent；访客身份在浏览器 IndexedDB 中使用 AES-GCM 本地加密保存 7 天。
    link: /guide/concepts#访客身份加密存储
  - title: 单容器极简拓扑
    details: Go 单二进制同源提供 API、静态管理端 (/admin/) 与 SDK 加载器 (/client/)；单 SQLite 文件 WAL 事务演进。
    link: /guide/introduction#系统架构全景
  - title: 现代化人机验证
    details: 实例级三态安全切换：关闭、Cloudflare Turnstile 与开源自托管 Cap，配合动态收敛的 CSP 安全防护。
    link: /self-hosting/admin#人机验证
  - title: 事务一致性异步通知
    details: Outbox 模式驱动 SMTP（TLS/STARTTLS）与 Telegram 机器人通知，按目标拆行重试，支持博主口令免密认证。
    link: /guide/concepts#outbox-事务一致性通知
  - title: 轻量且灵活的接入
    details: 提供 2KB 极简 Loader 声明式嵌入，支持 Hugo PaperMod、原生 HTML 与 Vue/React，具备全套 CSS Design Tokens。
    link: /integration/html
---
