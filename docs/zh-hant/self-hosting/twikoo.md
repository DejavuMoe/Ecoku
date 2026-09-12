# Twikoo 歷史資料匯入

Ecoku 提供了專用的 CLI 工具，支援從 Twikoo 匯出的 JSON 檔案無損遷移歷史評論資料。

> [!IMPORTANT]
> **僅限全新初始部署階段執行**：
> Twikoo 評論匯入命令（`import-twikoo`）**僅支援匯入到已在管理端註冊但評論數為 0 的純淨站點**。
> 一旦目標站點已有任何新評論寫入，系統為保障樹狀結構階層、父子引用約束與評論 ID 連續性，將**嚴格拒絕匯入**。

---

## 匯入前提與契約

1. **目標站點必須為空**：Twikoo 匯入僅允許匯入到一個**已在管理後台註冊、但評論數為 0** 的純淨目標站點。禁止向已有評論的站點追加匯入。
2. **強制冷備份**：執行實際匯入前，必須完成資料庫的冷備份。
3. **支援預演（Dry-Run）**：支援在不寫入資料庫的情況下預先解析並校驗資料格式。
4. **單交易不可分割提交**：整個匯入過程在單個 SQLite 交易中完成，任何單筆格式錯誤都會導致全量回滾，絕不殘留部分匯入資料。
5. **通知靜默**：歷史匯入過程**絕不觸發**任何郵件或 Telegram 通知。

---

## 欄位對應與清洗規則

| Twikoo 原始欄位 | Ecoku 對應與轉換規則 |
| :--- | :--- |
| `_id` / `rid` / `pid` | 自動對應並重建父子評論階層關係（`parent_id`）。 |
| `url` (頁面標識) | 自動清洗為規範的站內相對路徑（剔除協定、Host、Query 參數與 Hash 錨點）。 |
| `comment` (內文) | 將歷史 HTML / Markdown 內文提取並轉換為安全的純文字，剔除標籤注入。 |
| `nick` | 對應為評論作者暱稱。 |
| `mail` | 對應為私有信箱（僅用於未來接收回覆通知，絕不向公開 API 暴露）。 |
| `link` | 校驗合法性後對應為作者個人網站（僅保留安全的 `http://` / `https://` 連結）。 |
| `created` | 保留精確歷史發表時間戳記。 |
| `ip` / `ua` / `os` | **直接丟棄**，嚴格符合 Ecoku 隱私邊界。 |
| `is_blogger` | 匯入完成後，系統自動根據目標站點的站長暱稱與信箱匹配並批次回填站長標記。 |

---

## 匯入操作實戰

### 1. 預演檢查（Dry-Run）

將 Twikoo 匯出的 JSON 檔案放置於宿主機（例如 `~/Ecoku/data/twikoo.json`），先執行 Dry-Run 驗證：

```bash
cd ~/Ecoku

sudo docker compose run --rm --no-deps ecoku \
  import-twikoo \
  --site=blog \
  --file=/data/twikoo.json \
  --dry-run
```

檢查主控台輸出的解析統計資訊（根評論數、子回覆數、跳過異常數等）。

### 2. 執行正式匯入

確認預演統計無誤後，執行正式寫入：

```bash
cd ~/Ecoku

sudo docker compose run --rm --no-deps ecoku \
  import-twikoo \
  --site=blog \
  --file=/data/twikoo.json
```

### 3. 清理匯入檔案並啟動服務

匯入完成後，請及時從伺服器磁碟徹底刪除原始的 `twikoo.json` 匯出檔案（因其包含明文歷史 IP/信箱等敏感資料），並啟動服務：

```bash
# 安全刪除臨時匯出檔案
rm -f ~/Ecoku/data/twikoo.json

# 啟動服務
sudo docker compose up -d
```
