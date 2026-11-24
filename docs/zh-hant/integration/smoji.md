# Smoji 貼圖包

Ecoku 的評論是純文字，貼圖是唯一能顯示為圖片的內容。貼圖以 `![smoji:名称](图片地址)` 這樣的文字儲存在評論裡，顯示時才變成圖片，圖片由訪客的瀏覽器直接從圖床載入，Ecoku 不儲存也不轉發它們。

[Smoji](https://github.com/DejavuMoe/Smoji) 是配套的貼圖圖庫。你可以在 [Smoji 工作台](https://smoji.zsh.moe/) 複製單張貼圖，也可以挑選一部分匯出成清單，供評論框的貼圖選擇器使用。

## 直接使用 Smoji {#quick-start}

直接用 Smoji 的公共圖庫，不需要自行託管素材：

1. 在後台「站點」中編輯站點，在「表情包」選擇「啟用」。
2. 在「Smoji 清單」填寫公共清單位址，儲存：

   ```text
   https://s3-cdn.zsh.moe/smoji/smoji.json
   ```

3. 開啟評論頁，點擊「貼圖」選擇圖片；也可以前往 [Smoji 工作台](https://smoji.zsh.moe/) 開啟單張貼圖的詳細資訊，複製 **Markdown** 格式，貼到評論框：

   ```text
   ![smoji:挠脸](https://s3-cdn.zsh.moe/smoji/aodamiao/iclpknnbbcne.webp)
   ```

4. 點擊「預覽」檢查圖片，再發布評論。直接貼上標記不需要先開啟「貼圖」選擇器。

只有 `![smoji:…](…)` 這種格式會顯示為貼圖。單獨的圖片位址、HTML、BBCode 和一般 Markdown 圖片都按文字顯示。

貼上的貼圖只要圖片來源符合站點設定就能用，不要求它出現在選擇器的清單裡。關閉「表情包」後，已有的貼圖按原文顯示，新的貼圖會被拒絕提交。

## 挑選貼圖並匯出清單 {#custom-manifest}

只想讓選擇器顯示一部分貼圖時，匯出自己的清單：

1. 在 [Smoji 工作台](https://smoji.zsh.moe/) 使用「按分类导出」勾選分類，或使用「自选分组」建立自己的分組並加入貼圖。
2. 選擇 **Smoji** 格式（v1），點擊「导出」，下載 `smoji-YYYYMMDD.json`。「分组备份」是工作台的備份檔案，不能作為 Ecoku 清單。
3. 將匯出的檔案發布到可公開存取的 HTTPS 靜態位址。可以改名為 `smoji.json`，也可以保留日期後綴，後台填寫實際 URL。託管前先核對 [清單與圖片的來源要求](#hosting)。

匯出的是一個本機 JSON 檔案，不包含圖片，也不會替你上傳。自選分組儲存在目前的瀏覽器裡；改了選擇，就重新匯出並替換你託管的檔案。

例如，自選分組 `favorites` 可以包含來自 `aodamiao` 的兩張圖片：

```json
{
  "version": 1,
  "base": "https://s3-cdn.zsh.moe/smoji/{pack}/{id}.webp",
  "packs": [
    {
      "id": "favorites",
      "label": "常用",
      "items": [
        {
          "id": "iclpknnbbcne",
          "label": "挠脸",
          "src": "https://s3-cdn.zsh.moe/smoji/aodamiao/iclpknnbbcne.webp"
        },
        {
          "id": "lhbidblgecnj",
          "label": "坏笑",
          "src": "https://s3-cdn.zsh.moe/smoji/aodamiao/lhbidblgecnj.webp"
        }
      ]
    }
  ]
}
```

保留這些 `src`。它們指向圖片的實際位置，優先於 `base`；刪掉的話，範本會組合出 `/smoji/favorites/…`，而圖片實際在 `/smoji/aodamiao/…`。

## 清單與圖片的託管 {#hosting}

清單和圖片可以分別託管。把上面的 JSON 原樣放到 `https://example.com/smoji.json` 後，在後台「站點」的「表情包」中填寫：

| 欄位 | 填寫內容 |
| --- | --- |
| 表情包 | 啟用 |
| Smoji 清單 | `https://example.com/smoji.json` |
| 圖片來源 | `https://s3-cdn.zsh.moe` |

儲存後，瀏覽器從 `example.com` 讀取清單，從 `s3-cdn.zsh.moe` 載入圖片。不需要搬移圖片或修改匯出的 JSON。

「圖片來源」是選填的一個來源（`https://網域[:連接埠]`），不帶路徑，不支援萬用字元。留空時只允許和清單同源的圖片；填寫後只允許這個來源，清單的來源不再額外放行。

| 清單位置 | 圖片位置 | 結果 |
| --- | --- | --- |
| Smoji 公共 CDN | 同一個 CDN | 可直接使用公共清單和複製的貼圖標記。 |
| 自己的網站 | Smoji 公共 CDN | 將「圖片來源」設為 `https://s3-cdn.zsh.moe`。 |
| 自己的靜態伺服器或 CDN | 與清單同源 | 可使用自選清單；需要一併託管圖片並更新圖片位址。 |

允許哪些圖片只由後台的設定決定，清單裡寫的 `base` 和 `src` 不能擴大範圍。

託管清單的要求：

- 使用 HTTPS 位址，不帶使用者名稱密碼、`?` 或 `#`。只有 `localhost`、`127.0.0.1` 可以用 HTTP。
- 清單和評論所在的頁面不同源時，清單伺服器要回傳 CORS 標頭，例如 `Access-Control-Allow-Origin: *`。Ecoku 後台的「允許來源」管不到這一層。
- 直接回傳 JSON，`Content-Type` 為 `application/json` 或以 `+json` 結尾，大小不超過 1 MiB，8 秒內能下載完。
- 部落格設定了 CSP 的話，`connect-src` 放行清單來源，`img-src` 放行圖片來源。

## 載入與顯示 {#how-it-works}

1. 訪客第一次開啟「貼圖」選擇器時，瀏覽器直接請求清單，不帶 Cookie 和 Referer。
2. 瀏覽器檢查清單，解析 `base` 和 `src`，再從圖片位址載入選擇器裡的圖片。選取後，將完整圖片 URL 寫入評論標記。
3. 提交時，Ecoku 伺服器端檢查站點開關、標記格式和圖片來源；伺服器端不會下載清單或圖片。
4. 預覽、公開評論和後台評論依站點設定呈現合規標記，不需要先下載清單。郵件通知也使用相同的來源規則，Telegram 顯示文字標籤。圖片從資源主機直接載入，不經過 Ecoku 伺服器端。

清單載入失敗只影響選擇器，已經發布的貼圖照常顯示（前提是圖片還能存取）。

::: warning 隱私
清單和圖片由圖床直接傳送到訪客的瀏覽器，圖床看得到訪客的 IP。圖片請求設定了 `no-referrer`，但這不會隱藏 IP。
:::

## 清單格式 {#manifest-format}

| 欄位 | 規則 |
| --- | --- |
| `version` | 固定為 `1`。 |
| `base` | 選填，見下文。 |
| `packs` | 分組清單，1～64 個。 |
| `packs[].id` | 分組 ID，以字母或數字開頭，可包含字母、數字、`.`、`_`、`-`，最多 64 個字元，不能重複。 |
| `packs[].label` | 分組名稱，顯示在選擇器的分頁標籤上。規則同 `items[].label`。 |
| `packs[].items` | 貼圖清單，每組 1～600 個；整份清單合計不超過 6000 個。 |
| `items[].id` | 貼圖 ID，規則同分組 ID，組內不能重複。 |
| `items[].label` | 貼圖名稱，去掉前後空白後為 1～40 個字元，不能包含 `]` 和換行等控制字元。它會寫進評論標記，也用作圖片的替代文字。 |
| `items[].src` | 圖片位址。可以是完整位址，也可以是相對於清單的路徑。 |

清單的整體要求：

- **每個物件只能包含上面列出的欄位**，多出任何欄位都會被拒絕。
- 所有圖片位址解析後必須與設定的圖片來源 **同源**（協定、網域、有效連接埠相同），不能帶使用者名稱密碼、`?` 或 `#`。圖片來源留空時使用清單來源。
- 檔案大小與回應要求見 [託管說明](#hosting)。

## 精簡寫法：base {#base}

貼圖較多時，可以用 `base` 範本取代逐一填寫 `src`：

```json
{
  "version": 1,
  "base": "https://stickers.example.com/smoji/{pack}/{id}.webp",
  "packs": [
    {
      "id": "douyin",
      "label": "抖音",
      "items": [
        { "id": "smile", "label": "微笑" },
        { "id": "cool", "label": "酷", "src": "https://stickers.example.com/smoji/extra/cool.png" }
      ]
    }
  ]
}
```

- `base` 必須同時包含 `{pack}` 和 `{id}`，分別替換為分組 ID 和貼圖 ID；展開後也必須符合圖片來源設定。
- 沒有 `src` 的貼圖使用範本產生位址；寫了 `src` 的以 `src` 為準。
- 展開後的結果仍是完整位址，評論中儲存的標記格式不變。

## 更新貼圖素材 {#updates}

評論裡儲存的是完整的圖片位址，所以換素材時要注意：

- 保留舊圖片的位址，或在原路徑上放置相容的副本。只替換清單無法修復歷史評論中已經失效的圖片。
- 保持歷史圖片符合已設定的圖片來源。明確設定來源後，移動清單不會改變圖片的信任範圍；留空時，更換清單來源會使舊來源的標記顯示為文字。歷史評論不會自動改寫。
- 從自選清單移除一張貼圖，只會從選擇器中移除它，不會刪除歷史評論裡的標記，也不會禁止同源圖片標記直接提交。
- 使用公共 CDN 時，圖片是否持續可用取決於素材託管方。自行遷移素材時，同時檢查 `base` 和每個明確指定的 `src`；正式環境清單不要引用本機開發位址。

## 標記格式 {#markers}

```text
![smoji:名称](图片地址)
```

圖片位址中的 `(` 和 `)` 會被編碼為 `%28` 和 `%29`。公開介面的 `formConfig.smoji` 回傳 `enabled`、`manifestUrl` 和選填的 `imageOrigin`，自訂前端可以據此實作自己的選擇器和呈現方式，規則與上文相同。
