---
layout: home
markdownStyles: false
title: Ecoku
titleTemplate: 自托管评论系统
---

<div class="landing">

<section class="hero">
<div class="landing-wrap">
<div>

<a class="hero-pill" href="/self-hosting/upgrades/v0.6.2"><b>v0.6.2</b>回复改为树形连线</a>

<h1>给静态博客的自托管评论系统</h1>

<p class="hero-lede">一个 Docker 容器，一段 HTML。访客不用注册就能留言，评论存在你自己服务器上的一个 SQLite 文件里。</p>

<div class="hero-actions">
  <a class="btn btn-primary" href="/guide/quick-start">快速上手 <Icon name="arrow" :size="16" /></a>
  <a class="btn" href="/guide/introduction">了解 Ecoku</a>
</div>

<div class="hero-meta">
  <span><Icon name="check" :size="15" />不记录访客 IP</span>
  <span><Icon name="check" :size="15" />多站点</span>
  <span><Icon name="check" :size="15" />开源，自托管</span>
</div>

</div>
<div>

<LiveDemo address="ecoku.zsh.moe" title="Ecoku 首页" />

<p class="hero-demo-caption">这是一个真实的 Ecoku 评论区，可以直接发一条试试。</p>

</div>
</div>
</section>

<section class="section section-alt">
<div class="landing-wrap">

<div class="section-head">
<h2>三步接入</h2>
<p>启动容器，配好 HTTPS，把评论区放进文章模板。</p>
</div>

<div class="setup">

<ol class="setup-steps">
<li><h3>启动容器</h3><p>写好 <code>compose.yaml</code> 和一个只需改一行的配置文件，运行 <code>docker compose up -d</code>。</p></li>
<li><h3>配置 HTTPS</h3><p>用 Caddy 或 Nginx 给 Ecoku 一个独立域名，然后登录后台登记你的博客。</p></li>
<li><h3>嵌入评论区</h3><p>把一段 HTML 放进文章模板，页面 key 用文章路径。</p></li>
</ol>

<div class="setup-code">
<div class="vp-doc">

::: code-group

```yaml [compose.yaml]
services:
  ecoku:
    image: "ghcr.io/dejavumoe/ecoku:v0.6.2"
    restart: unless-stopped
    ports:
      - "127.0.0.1:12123:12123"
    volumes:
      - ./app/config.yaml:/app/config.yaml:ro
      - ./data:/data
```

```caddyfile [Caddyfile]
ecoku.example.com {
    reverse_proxy 127.0.0.1:12123 {
        header_up X-Forwarded-For {remote_host}
    }
}
```

```html [文章模板]
<section id="ecoku-comments" class="ecoku-shell" data-ecoku-comments
  data-server-url="https://ecoku.example.com"
  data-site-id="blog"
  data-page-key="/posts/hello-world/">
  <div class="ecoku-loader" data-ecoku-loader hidden>
    <p class="ecoku-loader-status" data-ecoku-status></p>
    <button class="ecoku-loader-retry" data-ecoku-retry hidden>重试</button>
  </div>
  <div id="ecoku-mount" data-ecoku-mount></div>
</section>
<script src="https://ecoku.example.com/client/ecoku-loader.js" defer></script>
```

:::

</div>
</div>

</div>

</div>
</section>

<section class="section">
<div class="landing-wrap">

<div class="section-head">
<h2>博客评论需要的，就这些</h2>
<p>Ecoku 只做文字讨论，把它做完整。</p>
</div>

<div class="features">
<a class="feature" href="/admin/sites"><div class="feature-icon"><Icon name="globe" /></div><h3>一个实例，多个站点</h3><p>每个站点有自己的来源白名单、必填字段、字数上限和评论区语言。</p></a>
<a class="feature" href="/reference/concepts#threads"><div class="feature-icon"><Icon name="thread" /></div><h3>就地回复</h3><p>回复在被回复的评论下展开，最多 16 层。删除评论时保留讨论结构。</p></a>
<a class="feature" href="/reference/concepts#data"><div class="feature-icon"><Icon name="lock" /></div><h3>不收集访客数据</h3><p>不记录 IP 和 User-Agent，邮箱不公开，不加载第三方头像和统计。</p></a>
<a class="feature" href="/admin/notifications"><div class="feature-icon"><Icon name="bell" /></div><h3>邮件与 Telegram 通知</h3><p>有新评论时通知你，访客被回复时收到邮件。发送失败自动重试。</p></a>
<a class="feature" href="/admin/captcha"><div class="feature-icon"><Icon name="shield" /></div><h3>拦截机器人</h3><p>支持 Cloudflare Turnstile 和可自托管的 Cap，同时保护评论和后台登录。</p></a>
<a class="feature" href="/integration/custom-css"><div class="feature-icon"><Icon name="sliders" /></div><h3>跟随博客外观</h3><p>自动适配浅色和深色模式，颜色、圆角、字号都能用 CSS 变量改。</p></a>
</div>

</div>
</section>

<section class="section section-alt">
<div class="landing-wrap">

<div class="section-head">
<h2>适不适合你</h2>
<p>Ecoku 刻意保持简单，右边这些功能它没有。</p>
</div>

<div class="fit">
<div class="fit-card fit-yes">
<h3><Icon name="check" :size="16" />适合</h3>
<ul>
<li>Hugo、Hexo、Astro、VitePress 等静态网站，或 Vue、React 单页应用</li>
<li>想自己保管评论数据，不依赖第三方评论服务</li>
<li>维护好几个网站，想用一套服务统一管理</li>
<li>正在用 Twikoo，想 <a href="/self-hosting/twikoo">把历史评论搬过来</a></li>
</ul>
</div>
<div class="fit-card fit-no">
<h3><Icon name="x" :size="16" />不适合</h3>
<ul>
<li>需要 Markdown、富文本或图片上传（<a href="/integration/smoji">表情包</a> 除外）</li>
<li>需要访客账号、社交登录或头像</li>
<li>需要点赞或审核队列</li>
<li>必须用 MySQL 或 PostgreSQL</li>
</ul>
</div>
</div>

</div>
</section>

<section class="section">
<div class="landing-wrap">

<div class="section-head">
<h2>正在使用 Ecoku 的网站</h2>
</div>

<div class="sites">
<a class="site" href="https://blog.dejavu.moe/" target="_blank" rel="noopener"><span class="site-name"><span class="site-mark">D</span>Dejavu's Blog</span><span>作者的博客，Hugo 构建</span><span class="site-host">blog.dejavu.moe</span></a>
<a class="site" href="https://ecoku.zsh.moe/"><span class="site-name"><span class="site-mark">E</span>Ecoku 文档</span><span>就是本站，每页底部都有评论区</span><span class="site-host">ecoku.zsh.moe</span></a>
<a class="site" href="https://sani.zsh.moe/" target="_blank" rel="noopener"><span class="site-name"><span class="site-mark">S</span>Sani 文档</span><span>自托管分享工具 Sani 的文档</span><span class="site-host">sani.zsh.moe</span></a>
<a class="site" href="https://vps.gripe" target="_blank" rel="noopener"><span class="site-name"><span class="site-mark">V</span>vps.gripe</span><span>VPS 性能测试报告</span><span class="site-host">vps.gripe</span></a>
</div>

</div>
</section>

<section class="cta">
<div class="landing-wrap">
<h2>十几分钟就能上线</h2>
<p>需要一台装了 Docker 的 Linux 主机和一个域名。</p>
<div class="hero-actions">
  <a class="btn btn-primary" href="/guide/quick-start">快速上手 <Icon name="arrow" :size="16" /></a>
  <a class="btn" href="https://github.com/DejavuMoe/Ecoku" target="_blank" rel="noopener">GitHub</a>
</div>
</div>
</section>

</div>
