# 自訂 CSS

未設定 `data-css-url` / `css_url` 時，SDK 向頁面**內嵌**預設評論區樣式。只有需要貼合站點設計或完全自控外觀時，才改這個選項。

## 選項

| 值 | 行為 |
| --- | --- |
| 不設定 | SDK 內嵌預設樣式 |
| `/client/ecoku.css`（或絕對 URL） | 載入完整樣式表；不再內嵌預設樣式 |
| `/client/ecoku.unstyled.css` | 僅版面；顏色與字體由站點提供 |
| `none` 或 `-` | 不載入 Ecoku 樣式；站點負責全部 `.ecoku-comments` 樣式 |

位址可以是根相對路徑或完整 `http(s)` URL。用 UMD 且自行 `<link>` 樣式時，初始化須傳 `cssURL: 'none'`。

## 外殼樣式（可選）

下面的 CSS 只影響載入前外殼、失敗狀態與重試按鈕，不替代評論內容樣式：

```css
.ecoku-shell {
  margin-top: 2.75rem;
  min-height: 8rem;
}

.ecoku-loader {
  padding: 1.25rem 0;
  color: var(--secondary);
}

.ecoku-loader-status {
  margin: 0;
}

.ecoku-loader-retry {
  margin-top: 0.75rem;
  padding: 0.55rem 0.9rem;
  border: 1px solid var(--tertiary);
  border-radius: 0.4rem;
  color: var(--primary);
  background: var(--entry);
  cursor: pointer;
  font: inherit;
}

.ecoku-loader-retry:hover {
  border-color: var(--secondary);
}

.ecoku-loader-retry:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 3px;
}

.ecoku-loader-retry[hidden],
.ecoku-loader[hidden] {
  display: none;
}

@media (max-width: 640px) {
  .ecoku-shell {
    margin-top: 2rem;
  }
}
```

`var(--primary)` 等為 PaperMod 變數；其他主題請換成自己的色值。

## 步驟

1. 把外殼 CSS（如需要）寫入主題樣式並發布。
2. 在 HTML 設 `data-css-url`，或在 Hugo 設 `css_url`。
3. 使用 `unstyled` 時補充 `.ecoku-comments` 的顏色與邊框；使用 `none` 時還要提供版面。
4. 檢查淺色、深色、窄螢幕與失敗重試。

接入範例見 [通用 HTML](/zh-hant/integration/html) 與 [Hugo PaperMod](/zh-hant/integration/hugo)。
