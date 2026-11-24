---
layout: home
markdownStyles: false
title: Ecoku
titleTemplate: Self-hosted comments
---

<div class="landing">

<section class="hero">
<div class="landing-wrap">
<div>

<a class="hero-pill" href="/en/self-hosting/upgrades/v0.6.3"><b>v0.6.3</b>Admin shows the running version</a>

<h1>Self-hosted comments for static blogs</h1>

<p class="hero-lede">One Docker container and one HTML snippet. Visitors comment without signing up, and comments live in a single SQLite file on your own server.</p>

<div class="hero-actions">
  <a class="btn btn-primary" href="/en/guide/quick-start">Quick start <Icon name="arrow" :size="16" /></a>
  <a class="btn" href="/en/guide/introduction">About Ecoku</a>
</div>

<div class="hero-meta">
  <span><Icon name="check" :size="15" />No visitor IP logging</span>
  <span><Icon name="check" :size="15" />Multiple sites</span>
  <span><Icon name="check" :size="15" />Open source, self-hosted</span>
</div>

</div>
<div>

<LiveDemo address="ecoku.zsh.moe" title="Ecoku home" />

<p class="hero-demo-caption">This is a real Ecoku comment section. Try posting a comment.</p>

</div>
</div>
</section>

<section class="section section-alt">
<div class="landing-wrap">

<div class="section-head">
<h2>Three steps to set up</h2>
<p>Start the container, set up HTTPS, and add the comment section to your post template.</p>
</div>

<div class="setup">

<ol class="setup-steps">
<li><h3>Start the container</h3><p>Write <code>compose.yaml</code> and a config file that needs one line changed, then run <code>docker compose up -d</code>.</p></li>
<li><h3>Set up HTTPS</h3><p>Give Ecoku its own domain with Caddy or Nginx, then sign in to the admin console and register your blog.</p></li>
<li><h3>Embed comments</h3><p>Add an HTML snippet to your post template and use the post path as the page key.</p></li>
</ol>

<div class="setup-code">
<div class="vp-doc">

::: code-group

```yaml [compose.yaml]
services:
  ecoku:
    image: "ghcr.io/dejavumoe/ecoku:v0.6.3"
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

```html [Post template]
<section id="ecoku-comments" class="ecoku-shell" data-ecoku-comments
  data-server-url="https://ecoku.example.com"
  data-site-id="blog"
  data-page-key="/posts/hello-world/">
  <div class="ecoku-loader" data-ecoku-loader hidden>
    <p class="ecoku-loader-status" data-ecoku-status></p>
    <button class="ecoku-loader-retry" data-ecoku-retry hidden>Retry</button>
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
<h2>What blog comments need, and nothing more</h2>
<p>Ecoku does text discussion only, and does it completely.</p>
</div>

<div class="features">
<a class="feature" href="/en/admin/sites"><div class="feature-icon"><Icon name="globe" /></div><h3>One instance, many sites</h3><p>Each site has its own origin allowlist, required fields, length limit, and comment area language.</p></a>
<a class="feature" href="/en/reference/concepts#threads"><div class="feature-icon"><Icon name="thread" /></div><h3>Inline replies</h3><p>Replies open under the comment they answer, up to 16 levels deep. Deleting a comment keeps the thread structure.</p></a>
<a class="feature" href="/en/reference/concepts#data"><div class="feature-icon"><Icon name="lock" /></div><h3>No visitor data collection</h3><p>No IP or User-Agent logging, emails stay private, and no third-party avatars or analytics are loaded.</p></a>
<a class="feature" href="/en/admin/notifications"><div class="feature-icon"><Icon name="bell" /></div><h3>Email and Telegram notifications</h3><p>Get notified of new comments, and visitors get an email when someone replies. Failed sends are retried automatically.</p></a>
<a class="feature" href="/en/admin/captcha"><div class="feature-icon"><Icon name="shield" /></div><h3>Bot blocking</h3><p>Supports Cloudflare Turnstile and self-hostable Cap, protecting both comments and admin sign-in.</p></a>
<a class="feature" href="/en/integration/custom-css"><div class="feature-icon"><Icon name="sliders" /></div><h3>Matches your blog</h3><p>Adapts to light and dark mode automatically. Change colors, corner radius, and font size with CSS variables.</p></a>
</div>

</div>
</section>

<section class="section section-alt">
<div class="landing-wrap">

<div class="section-head">
<h2>Is it right for you?</h2>
<p>Ecoku stays simple on purpose. It does not have the features on the right.</p>
</div>

<div class="fit">
<div class="fit-card fit-yes">
<h3><Icon name="check" :size="16" />Good fit</h3>
<ul>
<li>Static sites built with Hugo, Hexo, Astro, VitePress and similar tools, or Vue and React single-page apps</li>
<li>You want to keep your own comment data instead of relying on a third-party comment service</li>
<li>You run several sites and want to manage them from one service</li>
<li>You use Twikoo and want to <a href="/en/self-hosting/twikoo">bring your existing comments over</a></li>
</ul>
</div>
<div class="fit-card fit-no">
<h3><Icon name="x" :size="16" />Not a fit</h3>
<ul>
<li>You need Markdown, rich text, or image uploads (<a href="/en/integration/smoji">stickers</a> aside)</li>
<li>You need visitor accounts, social sign-in, or avatars</li>
<li>You need likes or a moderation queue</li>
<li>You must use MySQL or PostgreSQL</li>
</ul>
</div>
</div>

</div>
</section>

<section class="section">
<div class="landing-wrap">

<div class="section-head">
<h2>Sites using Ecoku</h2>
</div>

<div class="sites">
<a class="site" href="https://blog.dejavu.moe/" target="_blank" rel="noopener"><span class="site-name"><span class="site-mark">D</span>Dejavu's Blog</span><span>The author's blog, built with Hugo</span><span class="site-host">blog.dejavu.moe</span></a>
<a class="site" href="https://ecoku.zsh.moe/"><span class="site-name"><span class="site-mark">E</span>Ecoku Docs</span><span>This site; every page has a comment section at the bottom</span><span class="site-host">ecoku.zsh.moe</span></a>
<a class="site" href="https://sani.zsh.moe/" target="_blank" rel="noopener"><span class="site-name"><span class="site-mark">S</span>Sani Docs</span><span>Docs for Sani, a self-hosted sharing tool</span><span class="site-host">sani.zsh.moe</span></a>
<a class="site" href="https://vps.gripe" target="_blank" rel="noopener"><span class="site-name"><span class="site-mark">V</span>vps.gripe</span><span>VPS benchmark reports</span><span class="site-host">vps.gripe</span></a>
</div>

</div>
</section>

<section class="cta">
<div class="landing-wrap">
<h2>Live in under twenty minutes</h2>
<p>You need a Linux host with Docker and a domain.</p>
<div class="hero-actions">
  <a class="btn btn-primary" href="/en/guide/quick-start">Quick start <Icon name="arrow" :size="16" /></a>
  <a class="btn" href="https://github.com/DejavuMoe/Ecoku" target="_blank" rel="noopener">GitHub</a>
</div>
</div>
</section>

</div>
