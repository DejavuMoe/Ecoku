# 自訂樣式

評論區的外觀有三種改法，由少到多：

| 方式 | 怎麼做 | 適合 |
| --- | --- | --- |
| 改變數 | 保持預設樣式，在部落格 CSS 裡覆寫 `--ecoku-*` 變數 | 只想調整顏色、圓角、字級 |
| 結構樣式 | `data-css-url` 指向 `/client/ecoku.unstyled.css` | 保留版面配置，顏色和裝飾自己寫 |
| 完全自訂 | `data-css-url="none"` | 所有樣式都由部落格提供 |

評論區的字型繼承部落格頁面。這些樣式只影響評論區，和管理後台無關。

## 改變數

在部落格的 CSS 裡給 `.ecoku-comments` 寫同名變數：

```css
.ecoku-comments {
  --ecoku-accent: #a8412c;
  --ecoku-radius: 8px;
  --ecoku-font-size: 16px;
}
```

預設值寫在零權重的 `:where(.ecoku-comments)` 裡，所以你寫的規則總會生效，不需要 `!important`，也不用管樣式表的載入順序。

### 明暗模式 {#theme}

`data-theme`（SDK 裡是 `theme`）決定評論區的配色：

- `auto`（預設）：評論區讀取部落格頁面上的同名顏色變數，例如 `--theme`、`--primary`（見下表「預設值」一欄），部落格切換明暗時評論區一起變。部落格沒有定義這些變數時，依系統的淺色或深色偏好使用內建配色。
- `light` / `dark`：固定使用內建的淺色或深色配色，不讀部落格的變數。

這些變數名稱和 Hugo PaperMod 主題一致，所以在 PaperMod 裡通常什麼都不用設定。部落格的明暗切換不靠這些變數的話（比如 VitePress），把 `--ecoku-*` 對應到部落格自己的變數，參考 [VitePress 範例](./sdk#vitepress)。

## 變數一覽 {#variables}

| 變數 | 預設值 | 用於 |
| --- | --- | --- |
| `--ecoku-theme` | `var(--theme, #f7f4ee)` | 主按鈕文字；Cap 核取方塊底色 |
| `--ecoku-entry` | `var(--entry, #fbf9f5)` | 發表卡片、排序選單、貼圖面板、錯誤提示的底色 |
| `--ecoku-primary` | `var(--primary, #1e1c19)` | 標題、暱稱、輸入文字、主按鈕底色、聚焦底線 |
| `--ecoku-secondary` | `var(--secondary, #6b655b)` | 時間、字數、欄位標籤、文字按鈕 |
| `--ecoku-content` | `var(--content, #35312b)` | 評論內文與內文輸入框 |
| `--ecoku-border` | `var(--border, #cbc3b5)` | 身分欄位底線、次要按鈕邊框、「回覆」底線；回覆連線預設色的基礎 |
| `--ecoku-border-soft` | `var(--border-soft, rgb(30 28 25 / 0.12))` | 卡片描邊、討論串分隔線 |
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
| `--ecoku-font-size-title` | `22px`（窄螢幕 `20px`） | 「N 則評論」標題 |
| `--ecoku-thread-indent` | `22px`（窄螢幕 `14px`） | 每級回覆的縮排，第四級之後不再增加 |
| `--ecoku-thread-line` | `--ecoku-border` 與 `--ecoku-theme` 混合的不透明色 | 回覆連線顏色 |
| `--ecoku-thread-line-width` | `2px` | 回覆連線粗細 |
| `--ecoku-thread-x` | `6px`（窄螢幕 `4px`） | 豎線距父評論作者列起點的距離 |
| `--ecoku-thread-gap` | `5px`（窄螢幕 `3px`） | 轉角末端與回覆作者名之間的空隙 |
| `--ecoku-thread-radius` | `8px`（窄螢幕 `6px`） | 轉角圓角 |

回覆連線只畫在第二至第四級回覆和父評論之間：每則回覆用一個圓角轉角連到自己的作者列，後面還有同級回覆時豎線才繼續往下。更深的回覆不再畫線，用「@暱稱」標明回覆對象。

等寬字型只使用頁面已經載入的 Maple Mono，Ecoku 不會下載字型。觸控裝置上輸入框字級至少 16px，避免 iOS 聚焦時放大頁面。

## 結構樣式

`/client/ecoku.unstyled.css` 只有版面配置：格線、間距、貼圖面板、驗證元件尺寸、摺疊按鈕寬度等，以及必要的重設和無障礙規則，沒有配色和裝飾。

```html
<section
  data-ecoku-comments
  data-css-url="https://ecoku.example.com/client/ecoku.unstyled.css"
  ...
>
```

HTML 載入器會自動插入這個樣式表。直接用 SDK 時要自己引入，見 [SDK · 樣式](./sdk#styles)。

## 完全自訂

`data-css-url="none"` 時，Ecoku 不注入也不載入任何樣式。評論區根元素是 `.ecoku-comments`，所有元素的類別名稱都以 `ecoku-` 開頭。建議從 `ecoku.unstyled.css` 開始改，它列出了需要處理的狀態（摺疊、隱藏、貼圖面板等）。

寫樣式時可以參考預設樣式的這些慣例：

- 回覆縮排每級 22px，窄螢幕（≤ 620px）14px，最多 3 級。元素上的 `--ecoku-depth`（0～3）給出目前層級。
- 摺疊按鈕 `[+]` / `[-]` 固定寬度 `3ch`，切換時同一行的內容不會移動。
- 暱稱、時間、摺疊按鈕和「回覆」在同一行，依基線對齊。
- Turnstile 元件寬度不超過 300px，Cap 元件為 260×58px。
