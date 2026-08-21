# Twikoo 匯入

僅在目標站點已經建立、評論數仍為零時執行一次。匯入保留時間、暱稱、私有信箱、網站、頁面 key、回覆層級和轉換後的純文字正文；不匯入 IP、UA、地區、頭像、讚踩或外部使用者 ID，也不發送歷史通知。

頁面 key 會去掉 query/fragment；絕對 URL 只保留路徑。匯入結束時按站點博主暱稱+信箱回填 `is_blogger`。整批使用一個事務，失敗不留部分資料。

## 備份

```bash
sudo docker compose down
sudo test ! -e ./data/ecoku.sqlite3-wal
sudo test ! -e ./data/ecoku.sqlite3-shm

twikoo_stamp="$(date +%Y%m%d-%H%M%S)"
sudo cp --reflink=auto --preserve=mode,timestamps \
  ./data/ecoku.sqlite3 "./backups/ecoku-before-twikoo-${twikoo_stamp}.sqlite3"
sudo chown "$USER":"$USER" "./backups/ecoku-before-twikoo-${twikoo_stamp}.sqlite3"
chmod 600 "./backups/ecoku-before-twikoo-${twikoo_stamp}.sqlite3"
sha256sum "./backups/ecoku-before-twikoo-${twikoo_stamp}.sqlite3" \
  > "./backups/ecoku-before-twikoo-${twikoo_stamp}.sqlite3.sha256"
```

導出檔案放在倉庫和服務目錄之外，用絕對路徑只讀掛載。

## 預檢與匯入

```bash
sudo docker compose run --rm --no-deps \
  --volume <ABSOLUTE_PATH>/twikoo-comment.json:/import/twikoo-comment.json:ro \
  ecoku import-twikoo \
  --site <SITE_ID> \
  --file /import/twikoo-comment.json \
  --dry-run
```

確認評論、根評論、回覆、頁面、信箱、網站和缺失父記錄摘要符合源資料後：

```bash
sudo docker compose run --rm --no-deps \
  --volume <ABSOLUTE_PATH>/twikoo-comment.json:/import/twikoo-comment.json:ro \
  ecoku import-twikoo \
  --site <SITE_ID> \
  --file /import/twikoo-comment.json

sudo docker compose up -d
```

目標站點已有評論時會拒絕。驗收後從伺服器刪除含私有信箱的原始導出；冷備份是否保留由你決定。
