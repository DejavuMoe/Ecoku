# 後台設定

開啟執行個體的 `/admin/`，用 `ECOKU_ADMIN_USERNAME` 與對應密碼登入。管理端 Bearer token 只存在目前頁記憶體，關閉或重新整理後需重新登入。

`admin.allowed_origins` 與評論站點來源分開設定，不能用一個寬泛來源代替。

## 站點

| 設定 | 說明 |
| --- | --- |
| ID | 接入用的唯一值；建立後不可改 |
| 站點位址、名稱 | 識別站點與拼通知連結 |
| Allowed origins | 允許呼叫評論 API 的精確 Origin（完整 `https://網域`，無路徑） |
| 信箱、網站 | 訪客欄位是否**必填**（欄位仍會顯示） |
| 佔位文字、長度上限、空狀態、排序 | 表單與列表行為 |

評論送出後直接發布，沒有審核佇列。

### 表情包

每個站點可選擇啟用表情包並填寫一個 `smoji.json` 清單 URL。正式環境須使用 HTTPS，且清單內圖片必須與清單同源。Ecoku 不會內建或代理這些資源；訪客首次開啟選擇器時才會動態載入。直鏈請求可能向資源主機暴露訪客 IP，請只使用可信主機。停用後會保留 URL，歷史表情標記則以純文字顯示。

management key（若在 YAML 中宣告）只供可信服務端做所屬站點的墓碑刪除等操作，不是瀏覽器接入設定。詳見 [Docker 部署](./docker#設定)。

## 部落客身分

暱稱與信箱須同時填寫或同時留空。啟用時另設 12–80 字元口令；儲存後按該身分回填歷史評論的部落客標記。可設定公開徽章文案。

公開區：已啟用口令時，部落客在暱稱欄填口令即可，不必填信箱或網站。口令錯誤且同時填了訪客身分時，按普通訪客發布。

## 通知

執行個體級 SMTP（僅 TLS / STARTTLS）與 Telegram。憑據由 `ECOKU_NOTIFICATION_ENCRYPTION_KEY` 加密存入 SQLite；管理端只顯示「已設定」，不提供判定表或範本預覽。啟用渠道前須設定 `notifications.instance_public_url`。

預設規則（以儲存的 `is_blogger` 為準）：

| 場景 | 行為 |
| --- | --- |
| 訪客發根評論 | 通知部落客渠道 |
| 訪客回覆訪客 | 通知部落客渠道，並郵件通知被直接回覆者 |
| 部落客回覆訪客 | 僅郵件通知被直接回覆者 |
| 訪客回覆部落客 | 僅通知部落客渠道 |
| 部落客回覆部落客 | 不通知 |
| 同一信箱回覆自己 | 不發送訪客回覆郵件 |

## 人機驗證

在「安全」頁選擇關閉、Cloudflare Turnstile 或自託管 Cap（三選一）。啟用後同時保護評論送出與管理員登入；失敗則拒絕，不會自動換提供方。切換提供方不會刪除未啟用方的已存設定。

### Turnstile

在 Cloudflare 建立 Widget，填入 Site key 與 Secret key。Pre-clearance 要求站點經 Cloudflare 代理；`cf_clearance` 不替代 Ecoku Siteverify。

### Cap

在 Cap Standalone 建立金鑰，並把管理端 Origin、全部評論站點 Origin 加入該 Key 的 CORS。執行個體須經公開 HTTPS 提供 `/assets/widget.js`、`/assets/cap_wasm_bg.wasm` 與 `/<sitekey>/siteverify`。在 Ecoku 填寫執行個體位址、Site key、Secret key。

管理端 CSP 隨目前提供方收斂：Turnstile 放行 Cloudflare；Cap 放行執行個體 Origin、WASM、Blob Worker；Cap instrumentation 可能還需 `'unsafe-eval'`。無法接受時關閉 instrumentation 或改用 Turnstile。

## 驗證故障時恢復登入

```bash
sudo docker compose down
sudo docker compose run --rm --no-deps ecoku captcha status
sudo docker compose run --rm --no-deps ecoku captcha disable
sudo docker compose up -d
```

登入後修正驗證設定，再在管理端重新啟用。
