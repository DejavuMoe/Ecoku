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

<div class="home-showcase">

## 谁在使用 Ecoku？ {#who-is-using}

<p class="home-showcase-lead">Ecoku 适用于个人博客、开源文档与数据展示等各类网站。以下是正在使用 Ecoku 承载评论交流的站点：</p>

<div class="showcase-grid">

<a class="showcase-card" href="https://blog.dejavu.moe/" target="_blank" rel="noopener noreferrer">
  <div class="showcase-card-header">
    <span class="showcase-title">Dejavu's Blog</span>
    <span class="showcase-tag">个人博客</span>
  </div>
  <p class="showcase-desc">作者的个人技术与生活随笔博客，基于 Hugo 构建，使用 Ecoku 承载文章评论与读者交流。</p>
  <span class="showcase-url">blog.dejavu.moe ↗</span>
</a>

<a class="showcase-card" href="https://ecoku.zsh.moe/" target="_blank" rel="noopener noreferrer">
  <div class="showcase-card-header">
    <span class="showcase-title">Ecoku 官方文档</span>
    <span class="showcase-tag">开源文档</span>
  </div>
  <p class="showcase-desc">Ecoku 自身的说明文档，基于 VitePress 构建。全站各文档页面底部直接集成 Ecoku 评论区，作为自托管部署与静态站接入的实际范例。</p>
  <span class="showcase-url">ecoku.zsh.moe ↗</span>
</a>

<a class="showcase-card" href="https://sani.zsh.moe/" target="_blank" rel="noopener noreferrer">
  <div class="showcase-card-header">
    <span class="showcase-title">Sani 文档</span>
    <span class="showcase-tag">开源文档</span>
  </div>
  <p class="showcase-desc">自托管短链接、文本与文件分享工具 Sani 的官方文档站，在帮助与指南页面嵌入 Ecoku 收集读者使用反馈与答疑交流。</p>
  <span class="showcase-url">sani.zsh.moe ↗</span>
</a>

<a class="showcase-card" href="https://vps.gripe" target="_blank" rel="noopener noreferrer">
  <div class="showcase-card-header">
    <span class="showcase-title">vps.gripe</span>
    <span class="showcase-tag">测试报告</span>
  </div>
  <p class="showcase-desc">VPS 性能基准测试报告平台，收录完整的原始测试脚本输出与结构化统计摘要。在测评详情页嵌入 Ecoku，方便访客就服务器性能与网络表现展开讨论。</p>
  <span class="showcase-url">vps.gripe ↗</span>
</a>

</div>

</div>
