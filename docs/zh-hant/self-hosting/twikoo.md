# Twikoo 歷史資料匯入

`import-twikoo` 將 Twikoo JSON 陣列中的支援欄位轉換為 Ecoku 純文字留言。目標站點必須已註冊且零留言（包括墓碑）。匯入不發送通知，也不保留 IP、UA、頭像、讚踩或外部使用者身分。

## 欄位與轉換

| JSON | Ecoku |
| :--- | :--- |
| `_id` / `id`、`pid` / `rid` | 重建 ID 與父子關係，優先直接父留言；缺失、跨頁面或無法解析的父關係可能轉為根留言並計入缺失父記錄。 |
| `url` | 提取站內路徑並移除 query / fragment。 |
| `comment` | 提取 HTML 文字，丟棄 script/style，圖片保留 alt 或 `[图片]`；不解析 Markdown 語法。 |
| `nick` / `mail` / `link` | 保存暱稱、私有電子郵件及合法 http(s) 作者網站。 |
| `created` / `updated` | 轉換並保存時間。 |
| 博主標記 | 依目標站點已設定的暱稱與電子郵件回填，不讀取匯出檔案中的 `is_blogger`。 |

## 1. 預檢前準備

先註冊目標站點，依[備份與恢復](./backup)完成停服冷備份並驗證歸檔。備份範例最後會啟動服務，因此匯入前再次停服。以下命令將原始匯出複製為臨時檔案，並讓容器 UID 10001 可讀；將 `/path/to/twikoo.json` 替換為自己的來源檔案，保留原件。

```bash
cd ~/Ecoku
sudo docker compose down
sudo install -o 10001 -g 10001 -m 600 /path/to/twikoo.json data/twikoo.json
```

## 2. 執行 dry-run

將 `blog` 替換為目標站點 ID。dry-run 執行匯入交易後回滾，不持久化匯入的留言；但 CLI 啟動時仍會初始化或遷移資料庫，因此不是純唯讀檢查。

```bash
sudo docker compose run --rm --no-deps ecoku \
  import-twikoo --site=blog --file=/data/twikoo.json --dry-run
```

核對輸出的留言、根留言、回覆、頁面、電子郵件、網站及缺失父記錄數量。無效 JSON、重複 ID 等錯誤會中止；無法解析的父關係會保留為根留言，不是跳過異常資料。

## 3. 正式匯入與清理

預檢結果無誤且備份已驗證後，保持服務停止，執行不帶 `--dry-run` 的相同命令。匯入交易失敗會整體回滾。成功後刪除本次臨時副本、啟動服務，檢查目標站點與歷史留言；原件與備份依自己的保留策略管理。

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
