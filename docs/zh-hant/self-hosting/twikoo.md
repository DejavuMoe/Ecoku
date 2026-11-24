# 從 Twikoo 遷移

`import-twikoo` 命令把 Twikoo 匯出的評論匯入到一個已登記的 Ecoku 站點，保留回覆關係。

匯入的評論直接公開，過程中不傳送任何通知。

::: warning 只能匯入一次
目標站點必須一則評論都沒有，包括已刪除的。在新站點開放評論之前完成匯入。
:::

<div class="steps">

### 準備

1. 在後台 [登記目標站點](../admin/sites)。想讓你自己以前的評論帶上部落客標誌，先設定好 [部落客暱稱和信箱](../admin/blogger)。
2. 在 Twikoo 裡匯出評論，得到一個 JSON 陣列檔案（不超過 64 MiB）。
3. 依 [備份與還原](./backup#cold-backup) 做一次冷備份，之後保持服務停止，直到匯入完成。

把匯出檔案複製到 `data/` 裡，讓容器能讀到（把 `/path/to/twikoo.json` 換成實際路徑）：

```bash
cd ~/Ecoku
sudo docker compose stop ecoku
sudo install -o 10001 -g 10001 -m 600 /path/to/twikoo.json data/twikoo.json
```

### 預先檢查

把 `blog` 換成你的站點 ID，加上 `--dry-run` 執行：

```bash
sudo docker compose run --rm --no-deps ecoku \
  import-twikoo --site=blog --file=/data/twikoo.json --dry-run
```

預先檢查會完整走一遍匯入，然後回滾，不儲存任何評論。輸出類似：

```text
Twikoo 导入预检通过：评论=128 根评论=90 回复=38 页面=24 邮箱=110 网站=45 缺失父记录=0
```

核對數字和 Twikoo 裡是否大致相符。「缺失父记录」不為 0，表示有些回覆找不到原評論，會變成根評論（不會被丟掉）。

匯出裡有 `isSpam: true` 的記錄時，命令會停下並回報數量。在匯出檔案的副本裡刪掉這些記錄，再重新預先檢查。

::: details 其他會讓命令報錯的情況
JSON 格式錯誤、檔案超過 64 MiB、空陣列、ID 重複、內文超過 10000 個字元、暱稱超過 80 個字元、頁面 key 為空或超過 512 個字元、站點不存在或已有評論。出錯時不會儲存任何評論。
:::

### 正式匯入

去掉 `--dry-run` 再執行一次。匯入在一個交易裡完成，任何一筆出錯都會整體回滾。成功後刪掉暫存副本，啟動服務：

```bash
(
set -eu
cd ~/Ecoku
sudo docker compose run --rm --no-deps ecoku \
  import-twikoo --site=blog --file=/data/twikoo.json
sudo rm -- data/twikoo.json
sudo docker compose up -d --wait --wait-timeout 120 ecoku
)
```

開啟幾篇文章，確認歷史評論和回覆關係都正確。

</div>

## 頁面 key 要對得上

匯入時，頁面 key 取自 Twikoo 記錄的 `url` 的路徑部分，例如 `/posts/hello-world/`。中文等非 ASCII 字元儲存為百分比編碼，如 `/posts/%E4%BD%A0%E5%A5%BD/`。

你的接入程式碼產生的 `data-page-key` 必須和它一字不差，歷史評論才會出現在對應文章下。在後台評論列表裡能看到每則評論的頁面 key，拿它和部落格範本的輸出比對。結尾斜線或編碼不一致時，調整接入程式碼，不要修改匯入的資料。

## 欄位對照

| Twikoo 欄位 | 匯入後 |
| --- | --- |
| `_id` / `id`、`pid`、`rid` | 重建回覆關係，優先使用 `pid` 指向的直接父評論。`pid` 為空或匯出中找不到該記錄時，嘗試掛到 `rid` 指向的根評論下。找不到所引用的父評論、父評論在另一個頁面或形成循環時，這則評論改為根評論，計入「缺失父记录」。同頁面的有效後代仍保留回覆關係。 |
| `url` | 取路徑部分作為頁面 key，去掉查詢參數和 `#` 片段。沒有路徑的 HTTP(S) 首頁位址（如 `https://blog.example`）使用 `/`。 |
| `comment` | HTML 轉成純文字：`<br>` 和區塊元素變為換行，移除標籤時保留 `<pre>` 內文字的縮排、定位字元和內部空白行，圖片變為 alt 文字或 `[图片]`，`<script>`、`<style>` 捨棄。不解析 Markdown。 |
| `nick` | 暱稱。為空時記為「访客」。 |
| `mail` | 私人信箱，用於之後的回覆通知。超過 254 個字元時不匯入。 |
| `link` | 訪客網址，只保留 `http`/`https` 位址；沒有協定的位址（如 `example.com`）補成 `https://`。 |
| `created` / `updated` | 建立和更新時間。 |

不匯入：IP、User-Agent、頭像、按讚、Twikoo 使用者 ID，以及匯出檔案裡的部落客標記。

部落客標記依目標站點目前的部落客暱稱和信箱回填：暱稱完全一致、信箱一致（不區分大小寫）的評論標為部落客評論。
