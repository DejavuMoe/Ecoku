---
layout: home
hero:
  name: Ecoku
  text: 自託管，多站點<br>專注文字討論
  tagline: 給部落格與個人網站的評論系統。訪客無需註冊，評論送出即公開，資料由你保管。
  image:
    src: /logo.svg
    alt: Ecoku 標誌
  actions:
    - theme: brand
      text: 開始部署
      link: /zh-hant/self-hosting/docker
    - theme: alt
      text: 認識 Ecoku
      link: /zh-hant/guide/introduction
    - theme: alt
      text: 嵌入評論區
      link: /zh-hant/integration/html

features:
  - title: 送出即公開
    details: 無審核佇列。回覆就地展開，刪除保留墓碑，討論上下文始終連貫。
    link: /zh-hant/guide/concepts#threads
  - title: 不記錄訪客 IP
    details: 僅儲存暱稱、正文與訪客填寫的信箱和網址；公開 API 不回傳信箱，不記錄訪客 IP 與 User-Agent。瀏覽器本機加密記住身分 7 天。
    link: /zh-hant/guide/concepts#data
  - title: 單容器獨立執行
    details: Go 單一二進位整合 API、後台與嵌入腳本；SQLite 儲存業務資料，金鑰獨立持久化。冷備資料目錄、設定與 Compose 即可還原。
    link: /zh-hant/guide/introduction#components
  - title: 多站點支援
    details: 單一實例服務多個網站，各站點獨立設定來源白名單、表單欄位、限制規則與部落客身分。
    link: /zh-hant/self-hosting/admin#sites
  - title: 通知與人機驗證
    details: 新評論即時透過電子郵件或 Telegram 通知部落客；支援 Cloudflare Turnstile 與自託管 Cap 防止灌水。
    link: /zh-hant/self-hosting/notifications
  - title: 一段 HTML 即可接入
    details: 適用於 Hugo、Hexo、Astro 等靜態站點與 Vue、React 單頁應用程式；支援透過 CSS 變數自訂樣式。
    link: /zh-hant/integration/html
---

<div class="home-showcase">

## 誰在使用 Ecoku？ {#who-is-using}

<p class="home-showcase-lead">Ecoku 適用於個人部落格、開源文件與資料展示等各類網站。以下是正在使用 Ecoku 承載評論交流的站點：</p>

<div class="showcase-grid">

<a class="showcase-card" href="https://blog.dejavu.moe/" target="_blank" rel="noopener noreferrer">
  <div class="showcase-card-header">
    <span class="showcase-title">Dejavu's Blog</span>
    <span class="showcase-tag">個人部落格</span>
  </div>
  <p class="showcase-desc">作者的個人技術與生活隨筆部落格，基於 Hugo 構建，使用 Ecoku 承載文章評論與讀者交流。</p>
  <span class="showcase-url">blog.dejavu.moe ↗</span>
</a>

<a class="showcase-card" href="https://ecoku.zsh.moe/" target="_blank" rel="noopener noreferrer">
  <div class="showcase-card-header">
    <span class="showcase-title">Ecoku 官方文件</span>
    <span class="showcase-tag">開源文件</span>
  </div>
  <p class="showcase-desc">Ecoku 自身的說明文件，基於 VitePress 構建。全站各文件頁面底部直接整合 Ecoku 評論區，作為自託管部署與靜態站接入的實際範例。</p>
  <span class="showcase-url">ecoku.zsh.moe ↗</span>
</a>

<a class="showcase-card" href="https://sani.zsh.moe/" target="_blank" rel="noopener noreferrer">
  <div class="showcase-card-header">
    <span class="showcase-title">Sani 文件</span>
    <span class="showcase-tag">開源文件</span>
  </div>
  <p class="showcase-desc">自託管短網址、文字與檔案分享工具 Sani 的官方文件站，在說明與指南頁面嵌入 Ecoku 收集讀者使用回饋與答疑交流。</p>
  <span class="showcase-url">sani.zsh.moe ↗</span>
</a>

<a class="showcase-card" href="https://vps.gripe" target="_blank" rel="noopener noreferrer">
  <div class="showcase-card-header">
    <span class="showcase-title">vps.gripe</span>
    <span class="showcase-tag">測試報告</span>
  </div>
  <p class="showcase-desc">VPS 效能基準測試報告平台，收錄完整的原始測試指令碼輸出與結構化統計摘要。在測評詳情頁嵌入 Ecoku，方便訪客就伺服器效能與網路表現展開討論。</p>
  <span class="showcase-url">vps.gripe ↗</span>
</a>

</div>

</div>
