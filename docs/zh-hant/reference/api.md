# REST API 參考

Ecoku 提供了整潔的 RESTful HTTP 介面，分為面向訪客的**公開評論介面**與面向管理者的**管理後台介面**。

---

## 通用約定與狀態碼

- **回應格式**：所有介面均回傳 `application/json; charset=utf-8`。
- **時間格式**：採用 ISO 8601 UTC 時間戳記（如 `2026-08-20T10:00:00Z`）。
- **標準狀態碼**：
  - `200 OK`：請求成功。
  - `201 Created`：資源建立成功。
  - `400 Bad Request`：參數校驗未通過。
  - `401 Unauthorized`：未提供有效憑證或管理 Token 已過期。
  - `403 Forbidden`：跨域 Origin 未在站點白名單中。
  - `404 Not Found`：目標站點、父評論或資源不存在。
  - `422 Unprocessable Entity`：超出資源預算（200 節點、16 層深度、10,000 探針預算、1 MiB JSON）。
  - `429 Too Many Requests`：觸發了單一 IP 記憶體頻控限流（包含 `Retry-After` 標頭）。
  - `503 Service Unavailable`：伺服端忙碌（4 個工作槽滿載）或資料庫讀取逾時（2 秒）。

---

## 1. 公開端點（Public Endpoints）

### 健康檢查 `GET /api/health`
- **請求方法**：`GET`
- **認證方式**：公開無認證
- **回應示例 (HTTP 200)**：
  ```json
  {
    "code": 200,
    "message": "Success",
    "data": {
      "status": "healthy",
      "timestamp": 1756700000
    }
  }
  ```

---

### 獲取評論列表 `GET /api/comment/list`
預設按根討論串分頁回傳完整評論樹。成功回應保留 `data.data`、根數 `total`、可達評論數 `commentTotal`、`page/pageSize/pageCount`、`formConfig` 和 `timeZone`。

完整討論串模式最多回傳 **200 個節點、16 層後代**（根為 0 層）；統計最多檢查同站點/頁面的 **10,000 條 ID/父關係**。任何預算超限回傳 **422**，不回傳殘缺討論串或近似總數。頁面總記錄超限時，即使 `pageSize=1` 也會失敗；現有 SDK 顯示既有載入失敗狀態，不會自動切換讀取模式。

需要按需讀取時，顯式傳入 `parentId`：`0` 只取根節點，正整數只取該父節點的直接子評論（包括墓碑，限定同站點/頁面）。傳入 `afterId`（預設 0）按 **ID 遞增**繼續讀取；`pageSize` 預設 10、最大 100，不可同時使用 `page` 或 `sort`。該模式不遞迴、不計算總數，回應 `data` 內為 `data` 評論陣列、`parentId/pageSize/hasMore/nextAfterId/formConfig/timeZone`；僅在 `hasMore=true` 時用 `nextAfterId` 繼續請求。父節點不存在或不屬於該站點/頁面回傳 404，參數無效回傳 400。

```http
GET /api/comment/list?siteId=blog&key=/posts/example/&parentId=0&pageSize=20
GET /api/comment/list?siteId=blog&key=/posts/example/&parentId=101&afterId=120&pageSize=20
```

兩種模式的完整 JSON 上限均為 **1 MiB**（包含跳脫和封裝）；超限回傳 422，可減小 `pageSize` 重試。列表處理共享 **4 個並行名額**及每次 **2 秒資料庫讀取逾時**；忙碌時回傳 503 / `Retry-After: 1`，逾時回傳 503。評論統計與後代查詢在同一 SQLite 快照中執行，不會因並行寫入無限增長。讀取頻控見[配置參考](../self-hosting/configuration.md)：預設每 IP 每 60 秒 60 次，超限回傳 429 / `Retry-After`。

- **Query 參數**：
  - `siteId` (string, 必填)：站點 ID。
  - `key` (string, 必填)：站內頁面相對路徑。
  - `page` (number, 可選)：根評論頁碼（預設 1）。
  - `pageSize` (number, 可選)：每頁根評論數量（預設 10，最大 100）。
  - `sort` (string, 可選)：排序方式，`newest` 或 `oldest`。
  - `parentId` (number, 可選)：啟用單層游標模式。`0` 表示根評論，正整數表示特定父評論的子節點。
  - `afterId` (number, 可選)：游標分頁錨點 ID。

- **完整討論串回應示例 (HTTP 200)**：
  ```json
  {
    "code": 200,
    "message": "获取评论成功",
    "data": {
      "data": [
        {
          "id": 101,
          "site_id": "blog",
          "mark": "/posts/example/",
          "parent": 0,
          "username": "張三",
          "url": "https://example.com",
          "content": "這是一條根評論",
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
      "timeZone": "Asia/Taipei",
      "formConfig": {
        "emailRequired": true,
        "websiteRequired": false,
        "placeholder": "寫下評論（僅支援純文字）",
        "defaultSort": "newest",
        "lengthLimit": 1000,
        "emptyMessage": "還沒有評論\n成為第一個留下評論的人。",
        "bloggerBadge": "[站長]",
        "bloggerProofEnabled": true,
        "turnstileSitekey": "example-sitekey",
        "captcha": {
          "provider": "turnstile",
          "sitekey": "example-sitekey"
        },
        "smoji": {
          "enabled": false,
          "manifestUrl": ""
        }
      }
    }
  }
  ```

- **游標模式回應示例 (HTTP 200，傳入 parentId)**：
  ```json
  {
    "code": 200,
    "message": "获取评论成功",
    "data": {
      "data": [
        {
          "id": 105,
          "site_id": "blog",
          "mark": "/posts/example/",
          "parent": 101,
          "username": "李四",
          "content": "這是一條子評論",
          "isBlogger": false,
          "deleted": false,
          "created_at": "2026-08-20T12:05:00Z",
          "updated_at": "2026-08-20T12:05:00Z"
        }
      ],
      "parentId": 101,
      "pageSize": 20,
      "hasMore": true,
      "nextAfterId": 105,
      "timeZone": "Asia/Taipei",
      "formConfig": {
        "emailRequired": true,
        "websiteRequired": false,
        "placeholder": "寫下評論（僅支援純文字）",
        "defaultSort": "newest",
        "lengthLimit": 1000,
        "emptyMessage": "還沒有評論\n成為第一個留下評論的人。",
        "bloggerBadge": "[站長]",
        "bloggerProofEnabled": true,
        "turnstileSitekey": "example-sitekey",
        "captcha": {
          "provider": "turnstile",
          "sitekey": "example-sitekey"
        },
        "smoji": {
          "enabled": false,
          "manifestUrl": ""
        }
      }
    }
  }
  ```

---

### 提交評論 `POST /api/comment/submit`
提交一條新的根評論或對已有評論發表回覆。請求體上限為 **80 KiB**。

- **請求體 (JSON)**：
  ```json
  {
    "siteId": "blog",
    "mark": "/posts/hello-world/",
    "pageTitle": "你好，世界",
    "parent": 0,
    "username": "張三",
    "email": "zhangsan@example.com",
    "url": "https://example.com",
    "content": "純文字內文內容",
    "captchaToken": "0.xxxxxx"
  }
  ```

- **回應示例 (HTTP 201 Created)**：
  ```json
  {
    "code": 201,
    "message": "评论提交成功",
    "data": {
      "id": 102,
      "isBlogger": false
    }
  }
  ```

- **站長免密發表**：
  若站點已配置站長通關密語，站長只需將 `username` 設定為通關密語明文，`email` 與 `url` 留空，伺服端校驗通過後會自動賦予站長身分與徽章。

---

新回覆最多 16 層後代（根為 0），第 17 層回傳 422，提示回覆較上層留言。歷史深鏈與匯入資料不自動修改；200 節點、1 MiB JSON、10,000 節點統計等讀取預算仍然有效。

## 2. 管理端端點（Admin Endpoints）

管理後台使用登入回應設定的 HttpOnly Cookie，同源請求自動攜帶，登入 JSON 不回傳 token。登入及 Cookie 寫入操作必須提供符合 `admin.allowed_origins` 的 `Origin`；恢復會話 GET 可省略。可信自動化可使用 Cookie jar；`Authorization: Bearer` 也必須使用新版已登記且未撤銷的會話憑證，舊版無狀態 token 不再接受。`EcokuSite` 原有站點墓碑刪除權限不變。

管理端寫入操作請求體上限為 **16 KiB**。

### 會話恢復與登出

- `GET /api/admin/session`：回傳原有 `expires_at` 與剩餘 `expires_in`，不續期、不回傳憑證。無效或過期為 401，儲存不可用為 503。
- `POST /api/admin/logout`：撤銷目前會話並清除 Cookie；成功 200，寫入失敗 503，不可當作已登出。兩者僅限實例管理員。

### 管理員登入 `POST /api/admin/login`
- **請求體**：
  ```json
  {
    "username": "admin",
    "password": "my-strong-password",
    "captchaToken": "0.xxxxxx"
  }
  ```
- **回應示例 (HTTP 200)**：
  ```json
  {
    "code": 200,
    "message": "管理员登录成功",
    "data": {
      "expires_at": "2026-08-20T20:00:00Z",
      "expires_in": 28800
    }
  }
  ```

### 取得管理端配置 `GET /api/admin/login-config`
取得管理端登入介面所需的人機驗證公鑰與參數（無需登入）。

### 站點管理介面
- `GET /api/admin/sites`：取得全部註冊站點列表與配置。
- `POST /api/admin/sites`：註冊新站點（需提供 `id`, `site_url`, `name`, `allowed_origins` 等）。
- `GET /api/admin/sites/:siteId`：取得指定站點的詳細配置。
- `PUT /api/admin/sites/:siteId`：更新指定站點的配置（支援樂觀鎖 `revision`）。

### 安全與人機驗證介面
- `GET /api/admin/captcha`：取得目前人機驗證三態配置（密碼部分掩碼保護）。
- `PUT /api/admin/captcha`：更新人機驗證三態配置（關閉 / Turnstile / Cap）。

### 通知管道管理介面
- `GET /api/admin/notifications`：取得 SMTP 郵件與 Telegram 通知管道配置。
- `PUT /api/admin/notifications/email`：更新郵件通知配置（SMTP 憑證使用主金鑰 AES-GCM 加密儲存）。
- `POST /api/admin/notifications/email/test`：發送一封測試郵件驗證 SMTP 連通性。
- `PUT /api/admin/notifications/telegram`：更新 Telegram Bot 通知配置。
- `POST /api/admin/notifications/telegram/test`：發送測試 Telegram 訊息驗證 Bot 連通性。

### 評論治理介面
- `GET /api/admin/sites/:siteId/comments`：管理端多條件分頁查詢評論列表。
- `GET /api/admin/sites/:siteId/comments/:commentId`：取得單條評論詳情與上下文。
- `DELETE /api/admin/sites/:siteId/comments/:commentId`：將評論執行墓碑化軟刪除，清空隱私並保留樹狀結構。
- `DELETE /api/admin/sites/:siteId/comments/:commentId/permanent`：對**沒有任何子評論**的孤立墓碑評論執行物理 DELETE 清除。
