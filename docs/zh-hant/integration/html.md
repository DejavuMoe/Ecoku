# HTML 接入

在文章範本中放入一段 HTML 和一個腳本，就能在任何靜態網站上顯示評論區。腳本 `ecoku-loader.js` 由你的 Ecoku 實例提供，讀取 HTML 上的屬性後會自動載入評論元件。

開始前，請確認已在後台[註冊站點](../self-hosting/admin#sites)，並把部落格的來源加入該站點的允許來源。

## 接入程式碼

把下面的程式碼放在文章範本中評論區的位置，並替換三處值：

- `data-server-url`：你的 Ecoku 網址；
- `data-site-id`：後台註冊的站點 ID；
- `data-page-key`、`data-page-title`：用範本變數輸出目前文章的路徑和標題。

```html
<section
  id="ecoku-comments"
  class="ecoku-shell"
  data-ecoku-comments
  data-server-url="https://ecoku.example.com"
  data-site-id="blog"
  data-page-key="/posts/hello-world/"
  data-page-title="你好，世界"
  data-page-size="10"
  data-theme="auto"
>
  <div class="ecoku-loader" data-ecoku-loader hidden>
    <p class="ecoku-loader-status" data-ecoku-status></p>
    <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>重新加载评论</button>
  </div>
  <div id="ecoku-mount" data-ecoku-mount></div>
</section>
<script src="https://ecoku.example.com/client/ecoku-loader.js" defer></script>
```

外層中四個帶有 `data-ecoku-*` 的元素都要保留：`data-ecoku-mount` 是評論區掛載的位置，另外三個用來在載入失敗時顯示錯誤訊息和重試按鈕。按鈕文字可以自行修改。

## 屬性

| 屬性 | 必填 | 說明 |
| --- | :---: | --- |
| `data-server-url` | 是 | Ecoku 的網址，例如 `https://ecoku.example.com`，必須是以 `http://` 或 `https://` 開頭的完整網址。 |
| `data-site-id` | 是 | 後台註冊的站點 ID。 |
| `data-page-key` | 是 | 目前文章的頁面 key，為站內相對路徑，最多 512 個字元，不能帶 `?` 或 `#`。見下文。 |
| `data-page-title` | 否 | 文章標題，顯示在通知郵件中。超過 200 個字元的部分會被截掉。 |
| `data-page-size` | 否 | 每頁顯示幾則根評論，1～100，預設 10。填寫無效值時以 10 處理。 |
| `data-theme` | 否 | `auto`（預設）、`light` 或 `dark`。`auto` 跟隨頁面的明暗設定。 |
| `data-css-url` | 否 | 取代預設樣式，見[自訂樣式](./custom-css)。 |

## 選擇頁面 key

頁面 key 決定評論屬於哪一篇文章，[一旦使用就不要再更改](../guide/concepts#page-key)。通常使用文章的站內路徑。常見產生器的寫法：

::: v-pre
| 產生器 | `data-page-key` 的值 |
| --- | --- |
| Hugo | `{{ .RelPermalink }}` |
| Hexo | `<%- url_for(page.path) %>` |
| Jekyll | `{{ page.url }}` |
| Astro | `{Astro.url.pathname}` |
| VitePress | 在自訂主題中讀取 `useRoute().path`，並使用 [SDK](./sdk) 接入 |
:::

以上僅供參考。請在瀏覽器中檢視產生的 HTML，確認輸出的是穩定的路徑，例如 `/posts/hello-world/`，而不是完整網址。

## 載入過程

1. 頁面解析完成後，載入器讀取外層元素上的屬性。缺少 `data-server-url`、`data-site-id`、`data-page-key`，或缺少四個 `data-ecoku-*` 子元素中的任何一個時，它會**靜默略過**，頁面上不會出現任何內容。
2. 載入器從自己所在的目錄載入 `ecoku.umd.js`，並初始化評論區。載入期間不會顯示「正在載入」之類的文字。
3. 腳本載入或初始化任一階段超過 12 秒、或者失敗時，會顯示錯誤訊息和「重新加载评论」按鈕，訪客可以點擊重試。

一個頁面上可以有多個外層元素，每個都會獨立初始化。

## 使用自行託管的載入器

可以把 `ecoku-loader.js` 放到自己的 CDN 上，只修改 `<script src>`。載入器會從**同一個目錄**載入 `ecoku.umd.js`，所以兩個檔案要放在一起，並且在升級 Ecoku 時同步更新。

## 部落格頁面的 CSP

如果部落格設定了內容安全政策（CSP），需要放行：

- `script-src` 和 `connect-src`：Ecoku 的來源，例如 `https://ecoku.example.com`；
- 預設樣式以 `<style>` 元素注入。CSP 不允許內嵌樣式時，把 `data-css-url` 設為 `https://ecoku.example.com/client/ecoku.css`，改用外部樣式表，並在 `style-src` 中放行該來源；
- 啟用人機驗證時，還要放行驗證服務，見[人機驗證 · 內容安全政策](../self-hosting/captcha#csp)；
- 啟用 [Smoji 貼圖包](./smoji)時，在 `connect-src` 中放行清單來源，在 `img-src` 中放行圖片來源。兩者分別託管時需要分別填寫，見[清單與圖片的託管](./smoji#hosting)。

## 不使用載入器

也可以直接引入 UMD 檔案，自行控制初始化的時機：

```html
<link rel="stylesheet" href="https://ecoku.example.com/client/ecoku.css">
<div id="ecoku-mount"></div>
<script src="https://ecoku.example.com/client/ecoku.umd.js"></script>
<script>
  const comments = new Ecoku({
    container: '#ecoku-mount',
    serverURL: 'https://ecoku.example.com',
    siteId: 'blog',
    pageKey: '/posts/hello-world/',
    pageTitle: '你好，世界',
    cssURL: 'https://ecoku.example.com/client/ecoku.css',
  })
  comments.init().catch(console.error)
</script>
```

UMD 檔案會註冊全域變數 `Ecoku`。上例用 `<link>` 引入樣式，並透過 `cssURL` 告訴 SDK 不要再注入預設樣式；如果去掉這兩處，SDK 會自行注入。設定項目和方法見 [JavaScript SDK](./sdk)。
