# 介紹

Ecoku 是一個自託管的評論系統，給 Hugo、Hexo、Astro、VitePress 這類靜態網站使用。你在自己的伺服器上執行一個 Docker 容器，在文章範本裡加一段 HTML，文章底部就有了評論區。

訪客不需要註冊，填好暱稱和信箱就能發表評論，評論送出後立即顯示。回覆在被回覆的評論下方展開。本站每一頁的底部就是一個 Ecoku 評論區。

## 它由什麼組成 {#components}

<figure class="doc-diagram" tabindex="0" aria-label="系統組成圖，可橫向捲動">
  <img class="diagram-light" src="/diagrams/components.zh-Hant.light.svg" width="1110" height="304" loading="lazy" decoding="async" alt="訪客和管理員瀏覽器經反向代理存取 Ecoku 服務；服務連接 SQLite 資料庫並傳送 SMTP 或 Telegram 通知。">
  <img class="diagram-dark" src="/diagrams/components.zh-Hant.dark.svg" width="1110" height="304" loading="lazy" decoding="async" alt="訪客和管理員瀏覽器經反向代理存取 Ecoku 服務；服務連接 SQLite 資料庫並傳送 SMTP 或 Telegram 通知。">
</figure>

| 部分 | 說明 |
| --- | --- |
| `ecoku-server` | 容器裡唯一的程式。提供評論介面、管理後台 `/admin/`、部落格載入的腳本 `/client/`，並在背景傳送通知。 |
| SQLite 資料庫 | 存放所有站點、評論和設定。旁邊的 `ecoku-secrets.json` 儲存金鑰，兩者一起備份。 |
| 反向代理 | 你自己的 Caddy 或 Nginx，負責 HTTPS。容器只監聽本機 `127.0.0.1:12123`。 |
| 評論區腳本 | 部落格頁面載入的 `ecoku-loader.js`，也可以用 npm 套件 `ecoku`。 |

不需要 MySQL、Redis 或其他外部服務。

## 它不做什麼

- 不轉譯 Markdown 或 HTML，不能上傳圖片。[Smoji 表情](../integration/smoji) 是唯一顯示為圖片的內容。
- 沒有訪客帳號、第三方登入和頭像。
- 沒有按讚和審核佇列。評論送出後直接公開，你在後台事後刪除。
- 只支援 SQLite。

如果其中某一項是你必須要的，Ecoku 可能不適合你。

## 隱私

Ecoku 不儲存訪客的 IP、User-Agent 和地理位置。訪客填的信箱只用於通知，不會出現在任何公開介面裡。評論區不請求第三方頭像、統計或 IP 查詢服務。詳見 [儲存和公開的資料](../reference/concepts#data)。

## 從哪裡開始

<div class="cards">
<Card title="快速上手" link="/guide/quick-start" icon="rocket">十幾分鐘走完從部署到嵌入的全過程。</Card>
<Card title="運作原理" link="/reference/concepts" icon="book">頁面 key、回覆層級、刪除和身分是怎麼運作的。</Card>
<Card title="HTML 接入" link="/integration/html" icon="code">已經有 Ecoku 服務，只想把評論區放進部落格。</Card>
<Card title="從 Twikoo 遷移" link="/self-hosting/twikoo" icon="download">把 Twikoo 的歷史評論匯入 Ecoku。</Card>
</div>
