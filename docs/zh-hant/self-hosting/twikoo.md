# Twikoo 歷史資料匯入

Ecoku 提供了專用的 CLI 工具，支援從 Twikoo 匯出的 JSON 檔案無損遷移評論資料。

---

## 匯入契約
- 目標站點必須已註冊且評論數為 0。
- 匯入過程不觸發任何郵件或 Telegram 通知。

---

## 操作步驟

```bash
# 1. 預演檢查 (Dry-Run)
sudo docker compose run --rm --no-deps ecoku \
  ecoku-server import-twikoo \
  --site-id=blog \
  --file=/data/twikoo.json \
  --dry-run

# 2. 正式匯入
sudo docker compose run --rm --no-deps ecoku \
  ecoku-server import-twikoo \
  --site-id=blog \
  --file=/data/twikoo.json

# 3. 刪除匯入檔案並重啟
rm -f ~/Ecoku/data/twikoo.json
sudo docker compose up -d
```
