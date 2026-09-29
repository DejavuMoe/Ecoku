# 自訂樣式

評論區的樣式有三種用法，依改動程度由小到大排列：

| 方式 | 做法 | 適合 |
| --- | --- | --- |
| 預設樣式 + 變數 | 不設定 `data-css-url`，在部落格 CSS 中覆寫 `--ecoku-*` 變數 | 大多數部落格，只想調整顏色、圓角、字級 |
| 結構樣式 | `data-css-url` 指向 `/client/ecoku.unstyled.css` | 想保留版面配置，顏色和裝飾全部自己寫 |
| 完全自訂 | `data-css-url="none"` | 所有樣式都由部落格提供 |

樣式只影響評論區，與管理後台無關。評論區的字型繼承部落格頁面。

## 用變數調整預設樣式

在部落格的 CSS 中，為 `.ecoku-comments` 寫入同名變數即可：

```css
.ecoku-comments {
  --ecoku-accent: #a8412c;
  --ecoku-radius: 8px;
  --ecoku-font-size: 16px;
}
```

預設值是以零權重的 `:where(.ecoku-comments)` 宣告的，你寫的任何 `.ecoku-comments` 規則都會生效，不需要 `!important`，也不受樣式表載入順序影響。

### 明暗模式

`data-theme` 決定評論區如何選擇配色：

- **`auto`（預設）**：評論區繼承部落格頁面的 `color-scheme`。顏色變數優先讀取部落格定義的同名變數（見下表「預設值」欄中的 `var(--theme, …)` 等），所以部落格用 `light-dark()` 或切換類別名稱來改變這些變數時，評論區會跟著變。部落格沒有定義這些變數時，依系統的淺色／深色偏好使用內建配色。
- **`light` / `dark`**：固定使用內建的淺色或深色配色，不再讀取部落格的顏色變數。

顏色變數的後備名稱與 PaperMod 主題一致，因此在 PaperMod 中通常不需要任何設定。

## 變數一覽 {#variables}

| 變數 | 預設值 | 用途 |
| --- | --- | --- |
| `--ecoku-theme` | `var(--theme, #f7f4ee)` | 主按鈕文字；Cap 核取方塊底色 |
| `--ecoku-entry` | `var(--entry, #fbf9f5)` | 發表卡片、排序選單、貼圖面板、錯誤提示的底色 |
| `--ecoku-primary` | `var(--primary, #1e1c19)` | 標題、暱稱、輸入文字、主按鈕底色、聚焦底線 |
| `--ecoku-secondary` | `var(--secondary, #6b655b)` | 時間、字數、欄位標籤、文字按鈕 |
| `--ecoku-content` | `var(--content, #35312b)` | 評論內文與內文輸入框 |
| `--ecoku-border` | `var(--border, #cbc3b5)` | 身分欄位底線、次要按鈕邊框、「回复」底線 |
| `--ecoku-border-soft` | `var(--border-soft, rgb(30 28 25 / 0.12))` | 卡片描邊、討論串分隔線、回覆引導線 |
| `--ecoku-surface-muted` | `var(--surface-muted, #efebe3)` | 貼圖格滑過時的底色 |
| `--ecoku-code-bg` | `var(--code-bg, #ece7de)` | 預設樣式未使用，保留給自訂樣式 |
| `--ecoku-accent` | 朱砂色 `#c8553a` 與 `--ecoku-primary` 混合 | 部落客標誌、連結滑過 |
| `--ecoku-danger` | `var(--ecoku-accent)` | 表單錯誤提示與無效欄位 |
| `--ecoku-focus` | `--ecoku-primary` 的 40% 透明度 | 鍵盤焦點框；設為 `transparent` 可隱藏 |
| `--ecoku-radius` | `6px` | 卡片、選單、面板、按鈕圓角 |
| `--ecoku-radius-sm` | `3px` | 選單項目、貼圖格、核取方塊圓角 |
| `--ecoku-shadow` | 淺色雙層陰影 | 排序選單與貼圖面板 |
| `--ecoku-font-mono` | Maple Mono，後備為系統等寬字型 | 時間、`[+]` / `[-]`、字數、頁碼 |
| `--ecoku-font-size` | `15px` | 內文與輸入框 |
| `--ecoku-font-size-small` | `13px` | 中繼資訊、標籤、按鈕 |
| `--ecoku-font-size-title` | `22px`（窄螢幕 `20px`） | 「N 条评论」標題 |

等寬字型只使用頁面已經載入的 Maple Mono，Ecoku 不會下載字型；沒有時依序後備到 `ui-monospace`、`SFMono-Regular`、`Menlo`、`Consolas`。

在觸控裝置上，輸入框字級至少為 16px，以免 iOS 在聚焦時放大頁面。

## 結構樣式

`/client/ecoku.unstyled.css` 只包含版面配置：格線、間距、貼圖面板、驗證元件尺寸、摺疊按鈕寬度等，沒有任何顏色、邊框、背景，也不使用 `--ecoku-*` 變數。

```html
<section
  data-ecoku-comments
  data-css-url="https://ecoku.example.com/client/ecoku.unstyled.css"
  ...
>
```

使用 HTML 載入器時，它會自動在頁面中插入這個樣式表的 `<link>`；直接使用 SDK 時需要自行引入，見 [SDK · 樣式](./sdk#styles)。

## 完全自訂

`data-css-url="none"` 時，Ecoku 不注入也不載入任何樣式。評論區的根元素是 `.ecoku-comments`，所有元素都使用 `ecoku-` 前綴的類別名稱。可以先開啟 `ecoku.unstyled.css`，了解結構和需要處理的狀態（摺疊、隱藏、貼圖面板等），再以此為基礎撰寫。

## 版面細節

撰寫自訂樣式時，可以參考預設樣式的這些慣例：

- 回覆縮排：每層 22px，窄螢幕（≤ 620px）為 14px，最多 3 層。目前的層級透過元素上的 `--ecoku-depth` 變數（0～3）提供。
- 摺疊按鈕 `[+]` / `[-]` 固定寬度為 `3ch`，切換時同一行的內容不會移動。
- 暱稱、時間、摺疊按鈕和「回复」在同一行，依文字基線對齊。
- Turnstile 元件寬度不超過 300px；Cap 元件維持 260×58px。
