# Twikoo 歷史資料匯入

Ecoku 提供了專用的 CLI 工具，支援從 Twikoo 匯出的 JSON 檔案無損遷移評論資料。
> [!IMPORTANT]
> **僅限全新初始部署階段執行**：
> Twikoo 評論匯入命令（`import-twikoo`）**僅支援匯入到已在管理後台註冊但評論數為 0 的純淨站點**。
> 一旦目標站點已有任何新評論寫入，系統為保障樹狀結構階層、父子引用約束與評論 ID 連續性，將**嚴格拒絕匯入**。

---

## 匯入契約
- 目標站點必須已註冊且評論數為 0。
- 匯入過程不觸發任何郵件或 Telegram 通知。

---

## 操作步驟

```bash
cd ~/Ecoku

# 1. 預演檢查 (Dry-Run)
sudo docker compose run --rm --no-deps ecoku \
  import-twikoo \
  --site=blog \
  --file=/data/twikoo.json \
  --dry-run

# 2. 正式匯入
sudo docker compose run --rm --no-deps ecoku \
  import-twikoo \
  --site=blog \
  --file=/data/twikoo.json

# 3. 刪除匯入檔案並重啟
rm -f ~/Ecoku/data/twikoo.json
sudo docker compose up -d
```
