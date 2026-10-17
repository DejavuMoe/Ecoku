# Ecoku

[![License: MIT](https://img.shields.io/github/license/DejavuMoe/Ecoku)](LICENSE)
[![Release](https://img.shields.io/github/v/release/DejavuMoe/Ecoku)](https://github.com/DejavuMoe/Ecoku/releases)
[![npm](https://img.shields.io/npm/v/ecoku)](https://www.npmjs.com/package/ecoku)
[![CI](https://img.shields.io/github/actions/workflow/status/DejavuMoe/Ecoku/ci.yml?branch=master&label=CI)](https://github.com/DejavuMoe/Ecoku/actions/workflows/ci.yml)

自託管、多站點、專注純文字討論的評論系統，為靜態部落格與個人網站設計。

[English](README.md) · [简体中文](README.zh-CN.md) · 繁體中文

**完整文件請見 [ecoku.zsh.moe](https://ecoku.zsh.moe/zh-hant/)**，本檔案僅作概覽，部署、接入、設定與 API 細節請至文件站閱讀。

## 特色

- 單一 Docker 容器即可執行；業務資料存放於 SQLite，金鑰獨立持久化
- 評論為純文字，送出後立即公開，沒有審核佇列
- 訪客無需註冊；瀏覽器可加密記住身分 7 天，信箱不會透過公開 API 回傳
- 單一實例可服務多個網站，各站點資料與設定互相隔離
- 可選的電子郵件／Telegram 通知，以及 Cloudflare Turnstile 或自託管 Cap 人機驗證

## 快速上手

依 [Docker 部署](https://ecoku.zsh.moe/zh-hant/self-hosting/docker) 完成以下步驟：

1. 準備 `compose.yaml`、`app/config.yaml` 和 `data/`，將 `instance_public_url` 改成 Ecoku 的實際 HTTPS 位址。
2. 啟動並等待容器健康，再 [停服產生管理員臨時密碼](https://ecoku.zsh.moe/zh-hant/self-hosting/docker#temporary-password)。**v0.5.2 的啟動日誌不提供密碼，也沒有固定預設密碼。**
3. 設定 HTTPS 反向代理，用 `admin` 和剛才命令輸出的臨時密碼登入 `/admin/`，依頁面要求設定正式密碼。
4. 在後台註冊站點，取得接入所需的站點 ID。

站點註冊完成後，在文章範本中嵌入評論區程式碼：

```html
<section
  id="ecoku-comments"
  class="ecoku-shell"
  data-ecoku-comments
  data-server-url="https://ecoku.example.com"
  data-site-id="blog"
  data-page-key="/posts/hello-world/"
  data-page-title="你好，世界"
>
  <div class="ecoku-loader" data-ecoku-loader hidden>
    <p class="ecoku-loader-status" data-ecoku-status></p>
    <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>重新載入評論</button>
  </div>
  <div id="ecoku-mount" data-ecoku-mount></div>
</section>
<script src="https://ecoku.example.com/client/ecoku-loader.js" defer></script>
```

更多接入方式（JavaScript SDK、Hugo PaperMod 範本、自訂樣式）請見文件站的 [HTML 接入](https://ecoku.zsh.moe/zh-hant/integration/html)。

## 文件

- [指南](https://ecoku.zsh.moe/zh-hant/guide/introduction)：簡介、功能、運作方式
- [部署](https://ecoku.zsh.moe/zh-hant/self-hosting/docker)：Docker 部署、反向代理、管理後台、通知、人機驗證、備份與還原、升級
- [接入](https://ecoku.zsh.moe/zh-hant/integration/html)：HTML、JavaScript SDK、Hugo PaperMod、自訂樣式
- [參考](https://ecoku.zsh.moe/zh-hant/reference/configuration)：設定、命令列、REST API

文件站另提供 [English](https://ecoku.zsh.moe/en/) 與 [简体中文](https://ecoku.zsh.moe/) 版本。

## 專案狀態

Ecoku 已進入維護階段：後續更新將著重於細節打磨、效能與安全性，不再規劃大型功能異動。版本紀錄請見 [CHANGELOG.md](CHANGELOG.md)。

若需從原始碼建置或在本機執行，請見 [docs/contribute/local-dev.md](docs/contribute/local-dev.md)。

## 意見回饋與貢獻

如發現疑似安全漏洞，請依 [安全政策](SECURITY.md) 私密回報。

遇到問題或發現錯誤，歡迎至 [Issues](https://github.com/DejavuMoe/Ecoku/issues) 回報。

本專案暫不接受 Pull Request。若有功能建議或需求，歡迎在 Issues 中詳細說明具體情境與行為預期，由維護者評估後規劃實作。

## 授權條款

[MIT](LICENSE)
