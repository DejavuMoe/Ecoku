# 從 Twikoo 遷移

`import-twikoo` 指令會把 Twikoo 匯出的評論匯入到一個 Ecoku 站點。匯入只能執行一次：目標站點必須已經註冊，而且**沒有任何評論**（包括已刪除的）。因此請在新站點上線、有人發表評論之前完成。

## 會匯入什麼

| Twikoo 欄位 | 匯入後 |
| --- | --- |
| `_id` / `id`、`pid`、`rid` | 重建回覆關係，優先使用直接父評論。找不到父評論、父評論在另一個頁面或形成循環時，這則評論改為根評論，並計入「缺失父记录」。 |
| `url` | 取路徑部分作為頁面 key，去掉查詢參數和 `#` 片段。 |
| `comment` | HTML 轉成純文字：`<br>` 和區塊元素變為換行，圖片變為 alt 文字或 `[图片]`，`<script>`、`<style>` 捨棄。不解析 Markdown。 |
| `nick` | 暱稱。為空時記為「访客」。 |
| `mail` | 私人信箱，用於之後的回覆通知。 |
| `link` | 訪客網址，只保留 `http`/`https` 位址。 |
| `created` / `updated` | 建立和更新時間。 |

不會匯入：IP、User-Agent、大頭貼、按讚、Twikoo 使用者 ID，以及匯出檔案中的部落客標記。

匯入的評論直接公開，匯入過程不寄送任何通知。

**部落客標記**依目標站點當時的部落客暱稱和信箱回填：暱稱完全一致、信箱一致（不區分大小寫）的評論會被標為部落客評論。如有需要，請在匯入前先在後台設定好部落客身分。

## 1. 準備

1. 在後台[註冊目標站點](./admin#sites)，視需要設定部落客暱稱和信箱。
2. 從 Twikoo 匯出評論，得到一個 JSON 陣列檔案（上限 64 MiB）。
3. 依照[備份與還原](./backup#cold-backup)做一次冷備份。備份腳本最後會啟動服務，下面會再次停止。

把匯出檔案複製到 `data/` 目錄，讓容器使用者可以讀取（把 `/path/to/twikoo.json` 換成實際路徑，原始檔案保留不動）：

```bash
cd ~/Ecoku
sudo docker compose down
sudo install -o 10001 -g 10001 -m 600 /path/to/twikoo.json data/twikoo.json
```

## 2. 預先檢查

把 `blog` 換成目標站點 ID，先加上 `--dry-run` 執行：

```bash
sudo docker compose run --rm --no-deps ecoku \
  import-twikoo --site=blog --file=/data/twikoo.json --dry-run
```

預先檢查會完整執行一遍匯入再回滾，不會保存評論。輸出類似：

```text
Twikoo 导入预检通过：评论=128 根评论=90 回复=38 页面=24 邮箱=110 网站=45 缺失父记录=0
```

核對這些數字是否與 Twikoo 中的情況相符。「缺失父记录」不為 0 時，表示有些回覆會變成根評論，而不是被略過。

JSON 格式錯誤、ID 重複、目標站點不存在或已有評論時，指令會報錯結束，不做任何修改。

::: info
預先檢查不保存評論，但指令啟動時仍會開啟資料庫。如果資料庫版本較舊，會先執行遷移，所以它並不是完全唯讀的操作。
:::

## 3. 正式匯入

確認預先檢查結果和備份都沒問題後，去掉 `--dry-run` 再執行一次。匯入在一個交易中完成，任何一筆出錯都會整體回滾。成功後刪除暫存副本並啟動服務：

```bash
(
set -eu
cd ~/Ecoku
sudo docker compose run --rm --no-deps ecoku \
  import-twikoo --site=blog --file=/data/twikoo.json
sudo rm -- data/twikoo.json
sudo docker compose up -d
)
```

開啟幾篇文章，確認歷史評論和回覆關係顯示正常。原始匯出檔案和備份請依自己的習慣保存或刪除。

## 頁面 key 要對得上

匯入時頁面 key 取自 Twikoo 記錄的 `url` 路徑，例如 `/posts/hello-world/`。路徑中的中文等非 ASCII 字元會以百分比編碼形式保存，例如 `/posts/%E4%BD%A0%E5%A5%BD/`。

接入評論區時，`data-page-key` 必須產生完全相同的字串，歷史評論才會出現在對應的文章下。匯入後可以在後台的評論詳細資訊中查看每則評論的頁面 key，與部落格範本輸出的值比對。如果兩者不一致（例如結尾有沒有 `/`、是否經過編碼），請調整接入程式碼，不要更動已匯入的資料。
