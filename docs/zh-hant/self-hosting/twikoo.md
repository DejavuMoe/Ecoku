# Twikoo 匯入

一次性匯入：目標站點須已在管理端建立，且評論數為零。保留時間、暱稱、私有信箱、網站、頁面 key、回覆關係，正文轉為純文字。不匯入 IP、UA、地區、頭像、讚踩或外部使用者 ID，也不發送歷史通知。

頁面 key 會去掉查詢字串與片段；絕對 URL 只保留路徑。單事務寫入，最大匯出約 64 MB。損壞的父評論會降為根評論，並在結果中報告。匯入結束後按站點部落客暱稱+信箱回填 `is_blogger`。

## 備份

匯入前按 [備份與還原](./backup) 停服冷備份。確認無殘留 WAL/SHM：

```bash
sudo test ! -e ./data/ecoku.sqlite3-wal
sudo test ! -e ./data/ecoku.sqlite3-shm
```

## 預檢與匯入

將匯出檔放在服務目錄外，用絕對路徑唯讀掛載：

```bash
sudo docker compose run --rm --no-deps \
  --volume <ABSOLUTE_PATH>/twikoo-comment.json:/import/twikoo-comment.json:ro \
  ecoku import-twikoo \
  --site <SITE_ID> \
  --file /import/twikoo-comment.json \
  --dry-run
```

確認後再去掉 `--dry-run` 執行一次，然後：

```bash
sudo docker compose up -d
```

目標站點已有評論時匯入會拒絕。驗收後刪除含私有信箱的原始匯出。
