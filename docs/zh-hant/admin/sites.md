# 站點設定

一個站點對應一個放評論區的網站。一個 Ecoku 實例可以有多個站點，每個站點有自己的評論和設定。

## 管理後台概覽

後台在 `https://ecoku.example.com/admin/`，只有一個管理員帳號，管理所有站點。

| 頁面 | 作用範圍 | 用途 |
| --- | --- | --- |
| 評論 | 目前站點 | [查看和刪除評論](./comments) |
| 站點 | 目前站點 | 新增和編輯站點（本頁） |
| 通知 | 整個實例 | [電子郵件與 Telegram](./notifications) |
| 安全 | 整個實例 | [人機驗證](./captcha) |

有多個站點時，點左上角的站點名稱切換。登入後工作階段保持 8 小時，到期後重新登入。

::: details 登入不了？
- 必須用 HTTPS 開啟後台（`localhost`、`127.0.0.1` 除外）。
- 網址列的來源要和 `notifications.instance_public_url` 完全一致，包括連接埠；設定了 `admin.allowed_origins` 時以它為準。
- 忘記密碼用 [admin reset-password](../reference/cli#admin-reset-password)；人機驗證壞了用 [captcha disable](./captcha#disable)。
:::

## 新增站點 {#sites}

在「站點」頁點「新增站點」。必填的只有三項：

| 欄位 | 填什麼 |
| --- | --- |
| 站點 ID | 接入程式碼裡的 `data-site-id`，例如 `blog`。字母或數字開頭，可以有 `.`、`_`、`-`，最多 100 個字元。**建立後不能修改。** |
| 站點 URL | 網站位址，例如 `https://blog.example.com`。通知和後台裡的文章連結 = 站點 URL + 頁面 key。 |
| 允許來源 | 能載入評論區的網站來源，見 [下文](#origins)。 |

其餘欄位都有預設值，之後隨時可以修改：

| 欄位 | 預設 | 說明 |
| --- | --- | --- |
| 站點名稱 | 站點 URL 的網域 | 顯示在後台和通知裡，最多 120 個字元 |
| 評論區語言 | 简体中文 | 也可選繁體中文、English。接入程式碼可以覆寫。 |
| 評論排序 | 最新 | 訪客開啟評論區時的預設順序，訪客可以切換 |
| 訪客信箱 | 必填 | 可改為選填 |
| 訪客網站 | 選填 | 可改為必填。暱稱一律必填。 |
| 評論佔位文案 | 「寫下評論（僅支援純文字）」 | 1～80 個字元 |
| 評論長度上限 | 1000 | 1～10000 個字元，一個漢字算一個 |
| 無評論文案 | 「還沒有評論」和「成為第一個留下評論的人。」兩行 | 1～240 個字元，可以換行 |
| 表情包 | 關閉 | 見 [Smoji 表情](../integration/smoji) |

儲存後，用站點 ID 去 [接入評論區](../integration/html)。

## 允許來源 {#origins}

來源是 `協定://網域[:連接埠]`，不帶路徑。評論區所在頁面的來源不在清單裡時，瀏覽器讀取和提交評論都會被拒絕。

- `https://blog.example.com` 和 `https://www.blog.example.com` 是兩個來源，能存取部落格的網域都要寫上。
- 本機預覽部落格時，把 `http://localhost:1313` 這樣的位址也加上。
- 不能填管理後台自己的來源。後台和部落格必須用不同的網域，原因見 [設定生效與來源檢查](../reference/configuration#reload)。

可以一次貼上多行或逗號分隔的多個來源，最多 32 個。

## 站點 URL 與頁面路徑 {#site-url}

部落格部署在子目錄、頁面 key 已經包含這個子目錄時，站點 URL 不要再帶它。

| 頁面 key | 站點 URL | 組成的連結 |
| --- | --- | --- |
| `/blog/posts/hello/` | `https://example.com` | `https://example.com/blog/posts/hello/` ✓ |
| `/blog/posts/hello/` | `https://example.com/blog` | `https://example.com/blog/blog/posts/hello/` ✗ |

## 部落客身分

在站點裡設定部落客暱稱、信箱和口令後，你可以在評論區以部落客身分發言，見 [部落客身分](./blogger)。
