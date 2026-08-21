# 通用 HTML

每個頁面提供專用容器和穩定的頁面 key。`pageKey` 必須是站內相對路徑，不能是絕對 URL，不能帶 query。

```html
<section
  id="ecoku-comments"
  class="ecoku-shell"
  data-ecoku-comments
  data-server-url="https://comments.example.com"
  data-site-id="blog"
  data-page-key="/posts/example/"
  data-page-title="示例文章"
  data-page-size="10"
  data-theme="auto"
>
  <div class="ecoku-loader" data-ecoku-loader hidden>
    <p class="ecoku-loader-status" data-ecoku-status></p>
    <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>重新加载评论</button>
  </div>
  <div id="ecoku-mount" data-ecoku-mount></div>
</section>
<script src="https://comments.example.com/client/ecoku-loader.js" defer></script>
```

加載器以 `data-ecoku-*` 為準：外殼、掛載點、加載態、狀態文案和重試按鈕缺一則不會初始化。規範 id 為 `ecoku-comments` 與 `ecoku-mount`。當前仍相容舊的 `#tcomment` 與 `.comment-loader` 等類名，新站點不要再用。

加載過程不顯示「正在加載評論…」；失敗時才展示狀態和「重新加載評論」。未配置站點渲染「評論服務尚未配置。」

不要放入管理員 token 或 management key。驗證由公共 `formConfig` 下發。

## 樣式

預設 SDK 注入評論區樣式。可選 `data-css-url` 後不再注入：

- `/client/ecoku.css`：與預設注入相同
- `/client/ecoku.unstyled.css`：只保留結構
- `none`：完全自寫 CSS

可選 `data-js-url` 替換預設加載器。自定義樣式只作用於評論區。

上面的程式碼即為完整示例，可直接複製後替換站點參數。

嚴格 CSP 見 [常見問題 · 宿主 CSP](/zh-hant/self-hosting/faq#宿主-csp)。
