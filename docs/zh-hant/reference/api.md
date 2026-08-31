# REST API 參考

---

## 1. 公開端點

### 健康檢查 `GET /api/health`
回應：`{"status":"ok"}`

### 獲取評論列表 `GET /api/comment/list`
- Query 參數：`siteId`, `key`, `page`, `pageSize`, `sort`
- 預設成功回應保留 `data.data`、根數 `total`、可達評論數 `commentTotal`、`page/pageSize/pageCount`、`formConfig` 與 `timeZone`。
- 完整討論串模式最多回傳 **200 個節點、16 層後代**（根為 0 層），統計最多檢查同站點/頁面的 **10,000 條 ID/父關係**。超出預算回傳 **422**，不回傳殘缺討論串或近似總數；文章總記錄超限時即使 `pageSize=1` 也會失敗。現有 SDK 顯示既有載入失敗狀態，不自動切換模式。
- 按需讀取時，傳入 `parentId=0` 只取根節點，正整數只取該父節點的直接子評論（含墓碑，限定同站點/頁面）。`afterId` 預設 0，按 **ID 遞增**分頁；`pageSize` 預設 10、最多 100，不可混用 `page/sort`。此模式不遞迴、不計算總數；回應 `data` 內含評論陣列 `data` 及 `parentId/pageSize/hasMore/nextAfterId/formConfig/timeZone`。僅在 `hasMore=true` 時以 `nextAfterId` 繼續。父節點不存在或跨範圍回傳 404，參數無效回傳 400。

```http
GET /api/comment/list?siteId=blog&key=/posts/example/&parentId=0&pageSize=20
GET /api/comment/list?siteId=blog&key=/posts/example/&parentId=101&afterId=120&pageSize=20
```

兩種模式的完整 JSON（含跳脫與封裝）上限均為 **1 MiB**；超限回傳 422，可減小 `pageSize` 重試。列表處理最多 **4 個並行請求**，資料庫讀取有 **2 秒期限**；額滿立即回傳 503 / `Retry-After: 1`，逾時回傳 503。統計與後代查詢使用同一 SQLite 快照。[讀取頻控](../self-hosting/configuration.md)預設每 IP 每 60 秒 60 次，超限回傳 429 / `Retry-After`。

### 送出評論 `POST /api/comment/submit`
- JSON 請求體：
  ```json
  {
    "siteId": "blog",
    "pageKey": "/posts/hello-world/",
    "pageTitle": "你好，世界",
    "parent": 0,
    "username": "張三",
    "email": "zhangsan@example.com",
    "url": "https://example.com",
    "comment": "純文字評論內容",
    "captchaToken": "0.xxxxxx"
  }
  ```

---

## 2. 管理端端點

請求標頭需攜帶 `Authorization: Bearer {TOKEN}`。

- `POST /api/admin/login`：管理員登入。
- `GET /api/admin/sites`：站點列表。
- `DELETE /api/admin/sites/:siteId/comments/:commentId`：墓碑軟刪除。
- `DELETE /api/admin/sites/:siteId/comments/:commentId/permanent`：無後代墓碑徹底刪除。
