# Hugo PaperMod

```yaml
params:
  comments: true
  ecoku:
    server_url: "https://comments.example.com"
    site_id: "blog"
    # js_url: "https://cdn.example.com/ecoku-loader.js"
    # css_url: "https://comments.example.com/client/ecoku.unstyled.css"
```

把倉庫 `examples/hugo-papermod/layouts/_partials/comments.html` 合併到主題實際使用的 comments partial。生產使用 `.RelPermalink` 作為頁面 key、`.Title` 作為標題，並保留 Hugo 的上下文轉義。

加載前外殼樣式可複製 `examples/hugo-papermod/assets/css/extended/ecoku.css`，只美化失敗/未配置外殼。

## 上線前

至少檢查：普通文章、無評論頁、深層回覆、根討論串分頁、移動端、回覆通知、CORS 拒絕未登記 Origin，以及重新整理後 7 天加密身份恢復。清除瀏覽器站點資料會刪除身份，沒有額外清除按鈕。

使用鏡像同源加載器會自動獲得當前協議（含 Cap）。自行固定舊 SDK 的站點必須先更新再選擇 Cap。
