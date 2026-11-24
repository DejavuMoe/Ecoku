---
layout: home
markdownStyles: false
title: Ecoku
titleTemplate: 自託管評論系統
---

<div class="landing">

<section class="hero">
<div class="landing-wrap">
<div>

<a class="hero-pill" href="/zh-hant/self-hosting/upgrades/v0.6.2"><b>v0.6.2</b>回覆改為樹狀連線</a>

<h1>給靜態部落格的自託管評論系統</h1>

<p class="hero-lede">一個 Docker 容器，一段 HTML。訪客不用註冊就能留言，評論存在你自己伺服器上的一個 SQLite 檔案裡。</p>

<div class="hero-actions">
  <a class="btn btn-primary" href="/zh-hant/guide/quick-start">快速上手 <Icon name="arrow" :size="16" /></a>
  <a class="btn" href="/zh-hant/guide/introduction">認識 Ecoku</a>
</div>

<div class="hero-meta">
  <span><Icon name="check" :size="15" />不記錄訪客 IP</span>
  <span><Icon name="check" :size="15" />多站點</span>
  <span><Icon name="check" :size="15" />開源，自託管</span>
</div>

</div>
<div>

<LiveDemo address="ecoku.zsh.moe" title="Ecoku 首頁" />

<p class="hero-demo-caption">這是一個真實的 Ecoku 評論區，可以直接發一則試試。</p>

</div>
</div>
</section>

<section class="section section-alt">
<div class="landing-wrap">

<div class="section-head">
<h2>三步接入</h2>
<p>啟動容器，設定 HTTPS，把評論區放進文章範本。</p>
</div>

<div class="setup">

<ol class="setup-steps">
<li><h3>啟動容器</h3><p>寫好 <code>compose.yaml</code> 和一個只需改一行的設定檔，執行 <code>docker compose up -d</code>。</p></li>
<li><h3>設定 HTTPS</h3><p>用 Caddy 或 Nginx 給 Ecoku 一個獨立網域，然後登入後台登記你的部落格。</p></li>
<li><h3>嵌入評論區</h3><p>把一段 HTML 放進文章範本，頁面 key 用文章路徑。</p></li>
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

```html [文章範本]
<section id="ecoku-comments" class="ecoku-shell" data-ecoku-comments
  data-server-url="https://ecoku.example.com"
  data-site-id="blog"
  data-page-key="/posts/hello-world/">
  <div class="ecoku-loader" data-ecoku-loader hidden>
    <p class="ecoku-loader-status" data-ecoku-status></p>
    <button class="ecoku-loader-retry" data-ecoku-retry hidden>重試</button>
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
<h2>部落格評論需要的，就這些</h2>
<p>Ecoku 只做文字討論，把它做完整。</p>
</div>

<div class="features">
<a class="feature" href="/zh-hant/admin/sites"><div class="feature-icon"><Icon name="globe" /></div><h3>一個實例，多個站點</h3><p>每個站點有自己的來源白名單、必填欄位、字數上限和評論區語言。</p></a>
<a class="feature" href="/zh-hant/reference/concepts#threads"><div class="feature-icon"><Icon name="thread" /></div><h3>就地回覆</h3><p>回覆在被回覆的評論下展開，最多 16 層。刪除評論時保留討論結構。</p></a>
<a class="feature" href="/zh-hant/reference/concepts#data"><div class="feature-icon"><Icon name="lock" /></div><h3>不收集訪客資料</h3><p>不記錄 IP 和 User-Agent，信箱不公開，不載入第三方頭像和統計。</p></a>
<a class="feature" href="/zh-hant/admin/notifications"><div class="feature-icon"><Icon name="bell" /></div><h3>電子郵件與 Telegram 通知</h3><p>有新評論時通知你，訪客被回覆時收到電子郵件。傳送失敗自動重試。</p></a>
<a class="feature" href="/zh-hant/admin/captcha"><div class="feature-icon"><Icon name="shield" /></div><h3>攔截機器人</h3><p>支援 Cloudflare Turnstile 和可自託管的 Cap，同時保護評論和後台登入。</p></a>
<a class="feature" href="/zh-hant/integration/custom-css"><div class="feature-icon"><Icon name="sliders" /></div><h3>跟隨部落格外觀</h3><p>自動適配淺色和深色模式，顏色、圓角、字級都能用 CSS 變數修改。</p></a>
</div>

</div>
</section>

<section class="section section-alt">
<div class="landing-wrap">

<div class="section-head">
<h2>適不適合你</h2>
<p>Ecoku 刻意保持簡單，右邊這些功能它沒有。</p>
</div>

<div class="fit">
<div class="fit-card fit-yes">
<h3><Icon name="check" :size="16" />適合</h3>
<ul>
<li>Hugo、Hexo、Astro、VitePress 等靜態網站，或 Vue、React 單頁應用程式</li>
<li>想自己保管評論資料，不依賴第三方評論服務</li>
<li>維護好幾個網站，想用一套服務統一管理</li>
<li>正在用 Twikoo，想 <a href="/zh-hant/self-hosting/twikoo">把歷史評論搬過來</a></li>
</ul>
</div>
<div class="fit-card fit-no">
<h3><Icon name="x" :size="16" />不適合</h3>
<ul>
<li>需要 Markdown、富文字或圖片上傳（<a href="/zh-hant/integration/smoji">貼圖</a> 除外）</li>
<li>需要訪客帳號、社群登入或頭像</li>
<li>需要按讚或審核佇列</li>
<li>必須用 MySQL 或 PostgreSQL</li>
</ul>
</div>
</div>

</div>
</section>

<section class="section">
<div class="landing-wrap">

<div class="section-head">
<h2>正在使用 Ecoku 的網站</h2>
</div>

<div class="sites">
<a class="site" href="https://blog.dejavu.moe/" target="_blank" rel="noopener"><span class="site-name"><span class="site-mark">D</span>Dejavu's Blog</span><span>作者的部落格，以 Hugo 建置</span><span class="site-host">blog.dejavu.moe</span></a>
<a class="site" href="https://ecoku.zsh.moe/"><span class="site-name"><span class="site-mark">E</span>Ecoku 文件</span><span>就是本站，每頁底部都有評論區</span><span class="site-host">ecoku.zsh.moe</span></a>
<a class="site" href="https://sani.zsh.moe/" target="_blank" rel="noopener"><span class="site-name"><span class="site-mark">S</span>Sani 文件</span><span>自託管分享工具 Sani 的文件</span><span class="site-host">sani.zsh.moe</span></a>
<a class="site" href="https://vps.gripe" target="_blank" rel="noopener"><span class="site-name"><span class="site-mark">V</span>vps.gripe</span><span>VPS 效能測試報告</span><span class="site-host">vps.gripe</span></a>
</div>

</div>
</section>

<section class="cta">
<div class="landing-wrap">
<h2>十幾分鐘就能上線</h2>
<p>需要一台裝了 Docker 的 Linux 主機和一個網域。</p>
<div class="hero-actions">
  <a class="btn btn-primary" href="/zh-hant/guide/quick-start">快速上手 <Icon name="arrow" :size="16" /></a>
  <a class="btn" href="https://github.com/DejavuMoe/Ecoku" target="_blank" rel="noopener">GitHub</a>
</div>
</div>
</section>

</div>
