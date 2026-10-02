# REST API

本頁列出 Ecoku 的 HTTP API，供撰寫自訂前端或自動化腳本時參考。使用官方載入器或 SDK 時，不需要直接呼叫這些 API。

所有路徑都相對於實例網址，例如 `https://ecoku.example.com/api/health`。

## 通用慣例

### 回應格式

所有 `/api/` 端點都回傳 JSON，結構一致：

```json
{ "code": 200, "message": "Success", "data": { } }
```

`code` 與 HTTP 狀態碼相同。出錯時通常沒有 `data`（測試通知失敗例外，見[通知](#notifications)），`message` 是一句中文說明，例如：

```json
{ "code": 403, "message": "来源不属于当前站点" }
```

時間欄位為 UTC 的 RFC 3339 字串，例如 `2026-08-20T12:00:00Z`。

### 狀態碼

| 狀態碼 | 意義 |
| --- | --- |
| `200` / `201` | 成功；建立評論和站點時回傳 `201`。 |
| `400` | 參數或請求本文不合法，或人機驗證未通過。 |
| `401` | 管理 API 未登入或工作階段已失效。 |
| `403` | 來源不在允許清單中，或沒有權限。 |
| `404` | 站點、評論或端點不存在。 |
| `405` | 路徑存在，但不支援該請求方法。 |
| `409` | 狀態衝突：父評論屬於其他頁面、回覆已刪除的評論、設定已被其他工作階段修改等。 |
| `413` | 請求本文超過上限。 |
| `422` | 評論清單超出讀取上限，或回覆層數超過 16 層。 |
| `429` | 觸發速率限制，回應標頭 `Retry-After` 列出需要等待的秒數。 |
| `502` | 測試通知寄送失敗。 |
| `503` | 服務忙碌、讀取逾時、人機驗證服務無法使用、管理員工作階段儲存無法使用，或未設定憑據加密主金鑰。 |

### 跨來源與來源

- 瀏覽器請求帶有 `Origin` 時，公開 API 只接受已登記為某個站點允許來源的位址，管理 API 只接受 `admin.allowed_origins` 中的位址，其他來源回傳 `403`。
- 送出評論**必須**帶有屬於該站點的 `Origin`，沒有 `Origin` 的送出請求也會被拒絕。
- 讀取評論清單不要求 `Origin`，伺服器端腳本可以直接呼叫。

### 請求本文上限

送出評論為 80 KiB，管理 API 為 16 KiB。超過時回傳 `413`。

## 公開 API

### 健康檢查

```http
GET /api/health
```

```json
{ "code": 200, "message": "Success", "data": { "status": "healthy", "timestamp": 1790000000 } }
```

只表示程式能夠回應請求，不檢查資料庫或外部服務。

### 讀取評論

```http
GET /api/comment/list?siteId=blog&key=/posts/hello-world/&page=1&pageSize=10&sort=newest
```

| 參數 | 必填 | 說明 |
| --- | :---: | --- |
| `siteId` | 是 | 站點 ID。 |
| `key` | 是 | 頁面 key，最多 512 個字元。 |
| `page` | 否 | 根評論頁碼，預設 `1`。 |
| `pageSize` | 否 | 每頁根評論數，1～100，預設 `10`。 |
| `sort` | 否 | `newest` 或 `oldest`，預設使用站點設定。 |

回傳目前頁面的根評論，**以及它們的全部回覆**：

```json
{
  "code": 200,
  "message": "获取评论成功",
  "data": {
    "data": [
      {
        "id": 101,
        "site_id": "blog",
        "mark": "/posts/hello-world/",
        "parent": 0,
        "username": "张三",
        "url": "https://example.com",
        "content": "这是一条根评论",
        "isBlogger": false,
        "deleted": false,
        "created_at": "2026-08-20T12:00:00Z",
        "updated_at": "2026-08-20T12:00:00Z"
      }
    ],
    "total": 1,
    "commentTotal": 1,
    "page": 1,
    "pageSize": 10,
    "pageCount": 1,
    "timeZone": "Asia/Shanghai",
    "formConfig": {
      "emailRequired": true,
      "websiteRequired": false,
      "placeholder": "写下评论（仅支持纯文本）",
      "defaultSort": "newest",
      "lengthLimit": 1000,
      "emptyMessage": "还没有评论\n成为第一个留下评论的人。",
      "bloggerBadge": "[博主]",
      "bloggerProofEnabled": true,
      "turnstileSitekey": "",
      "captcha": { "provider": "off", "sitekey": "" },
      "smoji": { "enabled": false, "manifestUrl": "" }
    }
  }
}
```

評論欄位：

| 欄位 | 說明 |
| --- | --- |
| `id` | 評論 ID。對應頁面上的錨點 `#ecoku-comment-{id}`。 |
| `site_id`、`mark` | 站點 ID 與頁面 key。 |
| `parent` | 父評論 ID，根評論為 `0`。 |
| `username` | 暱稱。已刪除的評論固定為「已删除」。 |
| `url` | 訪客網址，沒有時省略該欄位。 |
| `content` | 純文字內文。已刪除的評論固定為「[该评论已删除]」。 |
| `isBlogger` | 是否為部落客評論。 |
| `deleted` | 是否已刪除（墓碑）。 |

其他欄位：

| 欄位 | 說明 |
| --- | --- |
| `total` | 根評論總數，用於分頁。 |
| `commentTotal` | 從根評論可到達的全部評論數（含回覆與墓碑）。 |
| `pageCount` | 總頁數。 |
| `timeZone` | 伺服器端的顯示時區（IANA 名稱）。 |
| `formConfig` | 該站點的評論表單設定，見下表。 |

`formConfig` 欄位：

| 欄位 | 說明 |
| --- | --- |
| `emailRequired`、`websiteRequired` | 信箱、網址是否必填。 |
| `placeholder`、`emptyMessage` | 評論框提示文字、沒有評論時顯示的文字。 |
| `defaultSort` | 預設排序。 |
| `lengthLimit` | 內文字數上限（以 Unicode 字元計）。 |
| `bloggerBadge` | 部落客標誌文字，空字串表示不顯示。 |
| `bloggerProofEnabled` | 站點是否已設定部落客口令。 |
| `captcha` | 目前的人機驗證方式：`provider` 為 `off`、`turnstile` 或 `cap`；`sitekey` 為公開的 Site key；使用 Cap 時另有 `instanceUrl`。 |
| `turnstileSitekey` | 為舊版用戶端保留。僅在 Turnstile 模式下有值。 |
| `smoji` | `enabled` 表示是否啟用，`manifestUrl` 為清單網址；下一版本增加選填的 `imageOrigin`，未回傳或為空時使用清單來源。 |

#### 讀取上限

為了避免單一超大討論拖垮服務，每次請求有以下上限，超過任何一項都會回傳 `422`，不回傳截斷的資料：

- 最多 200 則評論（根評論與回覆合計）；
- 回覆最多 16 層；
- 回應 JSON 最多 1 MiB；
- 統計時，同一頁面最多檢查 10,000 則評論。

頁面評論總數超過統計上限時，即使 `pageSize=1` 也會失敗。

此外，清單端點同時最多處理 4 個請求，忙碌時回傳 `503` 和 `Retry-After: 1`；每次請求的資料庫讀取限時 2 秒，逾時回傳 `503`。讀取頻率受 `rate_limit.comment_list` 限制，預設每個 IP 每分鐘 60 次。

#### 逐層讀取 {#cursor}

傳入 `parentId` 時，端點改為只回傳一層直接回覆，不遞迴，也不統計總數。適合自訂前端依需要展開大型討論。

```http
GET /api/comment/list?siteId=blog&key=/posts/hello-world/&parentId=0&pageSize=20
GET /api/comment/list?siteId=blog&key=/posts/hello-world/&parentId=101&afterId=120&pageSize=20
```

| 參數 | 說明 |
| --- | --- |
| `parentId` | `0` 表示讀取根評論，正整數表示讀取這則評論的直接回覆（包括已刪除的）。 |
| `afterId` | 只回傳 ID 大於它的評論，預設 `0`。 |
| `pageSize` | 1～100，預設 `10`。 |

結果依 ID 遞增排列。`afterId` 必須和 `parentId` 一起使用；這種模式下不能同時傳入 `page` 或 `sort`，否則回傳 `400`。父評論不存在或不屬於該頁面時回傳 `404`。

```json
{
  "code": 200,
  "message": "获取评论成功",
  "data": {
    "data": [ { "id": 121, "parent": 101, "...": "..." } ],
    "parentId": 101,
    "pageSize": 20,
    "hasMore": true,
    "nextAfterId": 140,
    "timeZone": "Asia/Shanghai",
    "formConfig": { }
  }
}
```

`hasMore` 為 `true` 時，把 `nextAfterId` 作為下一次請求的 `afterId`。1 MiB 的回應上限同樣適用，超過時可調低 `pageSize` 後重試。

### 送出評論

```http
POST /api/comment/submit
Content-Type: application/json
Origin: https://blog.example.com
```

```json
{
  "siteId": "blog",
  "mark": "/posts/hello-world/",
  "pageTitle": "你好，世界",
  "parent": 0,
  "username": "张三",
  "email": "zhangsan@example.com",
  "url": "https://example.com",
  "content": "纯文本正文",
  "captchaToken": "..."
}
```

| 欄位 | 必填 | 說明 |
| --- | :---: | --- |
| `siteId` | 是 | 站點 ID。 |
| `mark` | 是 | 頁面 key，為站內相對路徑，最多 512 個字元，不能是完整網址，不能帶 `?` 或 `#`。 |
| `pageTitle` | 否 | 文章標題，最多 200 個字元，用於通知。 |
| `parent` | 否 | 所回覆的評論 ID；根評論傳 `0` 或省略。 |
| `username` | 是 | 暱稱，最多 80 個字元。 |
| `email` | 依站點設定 | 信箱，最多 254 個字元。 |
| `url` | 依站點設定 | 網址，只接受 `http`/`https`，最多 2048 個字元。 |
| `content` | 是 | 內文，不超過站點的字數上限。 |
| `captchaToken` | 啟用驗證時 | Turnstile 或 Cap 元件回傳的一次性 token。 |

成功時回傳 `201`：

```json
{ "code": 201, "message": "评论提交成功", "data": { "id": 102, "isBlogger": false } }
```

部落客發言時，`username` 填部落客口令，`email` 和 `url` 留空。口令相符後，伺服器端以站點的部落客暱稱、信箱和站點 URL 保存，`isBlogger` 回傳 `true`。

與送出相關的錯誤：

| 狀態碼 | 原因 |
| --- | --- |
| `400` | 欄位不合法；人機驗證未通過（`请完成验证后再发布。`）；內文中含有不合規的 Smoji 標記。 |
| `403` | 缺少 `Origin`，或來源不屬於該站點。 |
| `404` | 站點或父評論不存在。 |
| `409` | 父評論屬於其他頁面，或父評論已刪除。 |
| `413` | 請求本文超過 80 KiB。 |
| `422` | 回覆層數超過 16 層。 |
| `429` | 超過 `rate_limit.comment_submit`（預設每個 IP 每 60 秒 5 次）。 |
| `503` | 人機驗證服務無法使用。 |

## 管理 API

管理 API 位於 `/api/admin/`。下文的 `admin.allowed_origins` 沒有填寫時，取 `notifications.instance_public_url` 的來源。

### 驗證方式

- **工作階段 Cookie**：`POST /api/admin/login` 成功後，伺服器端會設定名為 `ecoku_admin_session` 的 Cookie（HttpOnly、SameSite=Strict、Path=`/api/admin`，正式環境帶 Secure），有效期 8 小時。登入回應中不包含 token。
- 登入請求，以及以 Cookie 驗證的非 GET 請求，必須帶有 `admin.allowed_origins` 中的 `Origin`。
- 以 `Authorization: Bearer <凭据>`驗證的請求可以不帶 `Origin`；如果帶了，仍須在 `admin.allowed_origins` 中，否則回傳 `403`。Bearer 憑據必須是目前有效、未登出的工作階段；v0.2.4 之前簽發的舊 token 不再有效。
- 登入要求 HTTPS，只有迴路位址可以用 HTTP。

### 登入與工作階段

| 方法與路徑 | 說明 |
| --- | --- |
| `GET /api/admin/login-config` | 不需登入。回傳登入頁需要的人機驗證設定（`captcha`、`turnstileSitekey`）。 |
| `POST /api/admin/login` | 請求本文為 `{"username", "password", "captchaToken"}`。成功時回傳 `{"expires_at", "expires_in"}` 並設定 Cookie；首次臨時密碼登入時另外回傳 `requires_password_change: true`。受 `rate_limit.admin_login` 速率限制。 |
| `GET /api/admin/session` | 回傳目前工作階段的 `expires_at`、剩餘秒數 `expires_in` 和 `requires_password_change`，不延長工作階段。 |
| `POST /api/admin/initial-setup` | 只接受首次臨時密碼工作階段。請求本文為 `{"username", "password"}`；成功後撤銷臨時工作階段並設定普通管理員工作階段。 |
| `POST /api/admin/logout` | 登出目前的工作階段並清除 Cookie。回傳 `503` 時表示登出沒有成功。 |

### 站點

| 方法與路徑 | 說明 |
| --- | --- |
| `GET /api/admin/sites` | 所有站點。 |
| `POST /api/admin/sites` | 新增站點。 |
| `GET /api/admin/sites/:siteId` | 單一站點。 |
| `PUT /api/admin/sites/:siteId` | 更新站點。請求本文需帶上讀取時取得的 `revision`，缺少時回傳 `400`；期間被其他工作階段修改過時回傳 `409`。 |

站點欄位：`id`、`site_url`、`name`、`allowed_origins`、`default_sort`、`email_required`、`website_required`、`placeholder`、`comment_limit`、`empty_message`、`smoji_enabled`、`smoji_manifest_url`、`smoji_image_origin`、`blogger_nickname`、`blogger_email`、`blogger_badge`、`blogger_passphrase`（唯寫）、`revision`。回應中以 `blogger_passphrase_set` 表示是否已設定口令，另含唯讀的 `created_at`、`updated_at`。站點清單在 `data.data` 陣列中，單一站點以及建立、更新的結果在 `data.site` 中。

`smoji_image_origin`（未發布）是選填的受信任圖片來源，例如 `https://s3-cdn.zsh.moe`。留空使用清單來源；更新請求省略此欄位時保留原值，傳空字串恢復預設。公開的 `formConfig.smoji.imageOrigin` 僅在已設定時回傳。載入、提交、顯示和郵件通知使用同一規則，見 [Smoji 託管設定](../integration/smoji#hosting)。

新增站點時 ID 已存在，或 `allowed_origins` 與 `admin.allowed_origins` 重複，都會回傳 `409`。

### 評論

| 方法與路徑 | 說明 |
| --- | --- |
| `GET /api/admin/sites/:siteId/comments` | 評論清單。參數：`status`（`published` 或 `deleted`，預設 `published`）、`page`（最大 1000000）、`pageSize`（預設 20，最大 100）、`sort`（`newest` 或 `oldest`，預設 `newest`）。回應含 `total`、`pageCount` 和各狀態數量 `counts`。 |
| `GET /api/admin/sites/:siteId/comments/:commentId` | 單則評論，含私人信箱。 |
| `DELETE /api/admin/sites/:siteId/comments/:commentId` | 墓碑刪除。已刪除的評論再次刪除時回傳成功，`unchanged` 為 `true`。 |
| `DELETE /api/admin/sites/:siteId/comments/:commentId/permanent` | 徹底刪除。只能用於沒有回覆的墓碑，否則回傳 `409`。 |

兩個刪除端點都受 `rate_limit.comment_delete` 速率限制。

### 人機驗證

| 方法與路徑 | 說明 |
| --- | --- |
| `GET /api/admin/captcha` | 目前的設定。不回傳 Secret，以 `secret_set` 表示是否已設定。 |
| `PUT /api/admin/captcha` | 儲存設定：`provider`（`off`、`turnstile`、`cap`）、`turnstile.sitekey` / `secret`、`cap.instance_url` / `sitekey` / `secret`，以及 `revision`。Secret 留空表示不修改。 |

`/api/admin/turnstile` 是舊版端點，仍然可以使用，新的程式碼請使用 `/api/admin/captcha`。

### 通知 {#notifications}

| 方法與路徑 | 說明 |
| --- | --- |
| `GET /api/admin/notifications` | 電子郵件與 Telegram 設定。不回傳密碼與 Token，以 `password_set`、`token_set` 表示。 |
| `PUT /api/admin/notifications/email` | 儲存電子郵件設定：`enabled`、`host`、`port`、`encryption`（`tls` 或 `starttls`）、`username`、`password`、`from_address`、`recipients`、`revision`。 |
| `POST /api/admin/notifications/email/test` | 以請求中的設定寄送測試郵件。失敗時回傳 `502`，`data.error_code` 為 `timeout`、`authentication_failed`、`tls_failed` 或 `delivery_failed`。 |
| `PUT /api/admin/notifications/telegram` | 儲存 Telegram 設定：`enabled`、`token`、`targets`、`revision`。 |
| `POST /api/admin/notifications/telegram/test` | 傳送測試訊息，失敗時同上。 |

兩個測試端點受 `rate_limit.notification_test` 速率限制。
