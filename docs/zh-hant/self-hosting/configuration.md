# 設定字典與環境變數參考

表內預設值為程式備援值。範例 `/app/client`、`/app/admin`、`/data/ecoku.sqlite3` 與 `ECOKU_*` 名稱由部署範本明確填入；升級保留現有值即可。

本篇提供 `app/config.yaml` 設定檔與 `ecoku.env` 環境變數的完整欄位參考與技術規範。

`rate_limit.comment_list` 控制單一 IP 的公開列表讀取次數，預設每個 `window_seconds` 視窗 60 次（視窗預設 60 秒）。兩種列表模式共用同一桶，超限回傳 429 和 `Retry-After`；其他操作使用獨立桶。每個限流器最多保存 10,000 個活躍位址桶，額滿時拒絕新位址，過期後釋放。沿用 `trusted_proxies` 規則，反向代理後未配置受信任代理時訪客會共享代理 IP 的額度。

兩種列表模式的保護均在 CORS 查詢前執行；列表路徑的預檢和被拒絕來源也計入讀取額度。提前拒絕不會添加未經驗證的跨域許可，因此跨域瀏覽器可能只顯示載入失敗。取消交易後若 SQLite 重建連線，外部鍵、同步等級和忙等待設定會自動重新套用。

---

## 設定檔 `app/config.yaml`

`app/config.yaml` 在容器啟動時掛載為唯讀檔案（`:ro`），定義了實例的服務連接埠、儲存路徑、頻控規則與各模組的基礎參數。

```yaml
site:
  port: 12123
  log_path: "/var/log/ecoku/ecoku.log"
  trusted_proxies:
    - "172.18.0.1/32"

client:
  static_dir: "/app/client"

rate_limit:
  window_seconds: 60
  comment_submit: 5
  comment_list: 60
  comment_delete: 30
  admin_login: 5
  notification_test: 5

notifications:
  encryption_key_env: "ECOKU_NOTIFICATION_ENCRYPTION_KEY"
  instance_public_url: "https://ecoku.example.com"

database:
  sqlite:
    path: "/data/ecoku.sqlite3"

admin:
  enabled: true
  static_dir: "/app/admin"
  username_env: "ECOKU_ADMIN_USERNAME"
  password_hash_env: "ECOKU_ADMIN_PASSWORD_HASH"
  token_key_env: "ECOKU_ADMIN_TOKEN_KEY"
  token_ttl_minutes: 480
  allowed_origins:
    - "https://ecoku.example.com"
```

### 欄位詳細說明

#### 1. `site` 基礎服務設定
| 設定項 | 類型 | 必填 | 預設值 | 說明 |
| :--- | :--- | :---: | :--- | :--- |
| `port` | 整數 | 否 | `12123` | 服務監聽的內部連接埠。 |
| `log_path` | 字串 | 否 | `""` | 日誌輸出路徑。為空、`stdout` 或 `-` 時僅寫入標準輸出；指定檔案路徑時在程序內自動輪轉封存。 |
| `trusted_proxies` | 字串列表 | 否 | `[]` | 信任的反向代理 IP 或 CIDR 列表（如 Docker 網關 `172.18.0.1/32`）。僅匹配對端的請求才解析 `X-Forwarded-For`。 |

#### 2. `client` 靜態資源
| 設定項 | 類型 | 必填 | 預設值 | 說明 |
| :--- | :--- | :---: | :--- | :--- |
| `static_dir` | 字串 | 否 | `""` | 瀏覽器 SDK 與載入器靜態檔案所在的目錄路徑。 |

#### 3. `rate_limit` 頻控規則
所有限流規則基於固定視窗在單程序記憶體中運行：
| 設定項 | 類型 | 必填 | 預設值 | 說明 |
| :--- | :--- | :---: | :--- | :--- |
| `window_seconds` | 整數 | 否 | `60` | 限流時間視窗（秒）。 |
| `comment_submit` | 整數 | 否 | `5` | 單一 IP 在時間視窗內允許的最大評論提交次數。 |
| `comment_list` | 整數 | 否 | `60` | 單一 IP 在時間視窗內允許的最大公開列表讀取次數，兩種讀取模式共用。 |
| `comment_delete` | 整數 | 否 | `30` | 單一 IP 在時間視窗內允許的最大刪除請求次數。 |
| `admin_login` | 整數 | 否 | `5` | 單一 IP 在時間視窗內允許的最大管理端登入嘗試次數。 |
| `notification_test`| 整數 | 否 | `5` | 單一 IP 在時間視窗內允許的最大通知測試發送次數。 |

#### 4. `notifications` 通知服務
| 設定項 | 類型 | 必填 | 預設值 | 說明 |
| :--- | :--- | :---: | :--- | :--- |
| `encryption_key_env` | 字串 | 是 | `""` | 儲存敏感設定的主加密金鑰對應的環境變數名稱。 |
| `instance_public_url` | 字串 | 否 | `""` | 啟用通知時必須填寫；目前不用來產生郵件連結，原文連結來自站點 `site_url` 與留言 `mark`。 |

#### 5. `database` 資料庫
| 設定項 | 類型 | 必填 | 預設值 | 說明 |
| :--- | :--- | :---: | :--- | :--- |
| `sqlite.path` | 字串 | 是 | `./data/ecoku.bin` | SQLite3 資料庫檔案的絕對路徑（程式碼內建備援為 `./data/ecoku.bin`，容器部署固定為 `/data/ecoku.sqlite3`）。 |

#### 6. `admin` 管理後台
| 設定項 | 類型 | 必填 | 預設值 | 說明 |
| :--- | :--- | :---: | :--- | :--- |
| `enabled` | 布林 | 否 | `false` | 是否啟用管理端後台。生產環境部署需顯式設定為 `true`。 |
| `static_dir` | 字串 | 否 | `./admin` | 管理端靜態 HTML/JS 資源目錄（程式碼內建備援為 `./admin`，容器部署固定為 `/app/admin`）。 |
| `username_env` | 字串 | 是 | `""` | 管理員使用者名稱對應的環境變數名。 |
| `password_hash_env` | 字串 | 是 | `""` | 管理員 bcrypt 密碼雜湊對應的環境變數名。 |
| `token_key_env` | 字串 | 是 | `""` | 管理員 Bearer Token 簽名金鑰對應的環境變數名。 |
| `token_ttl_minutes` | 整數 | 否 | `480` | 管理端登入工作階段生命週期（分鐘，預設 8 小時）。 |
| `allowed_origins` | 字串列表 | 是 | `[]` | 允許存取管理後台 API 的精確 Origin 列表（需包含協定與網域）。 |

#### 7. `sites` 初始站點種子（可選）
僅在資料庫**首次初始化**時將設定項作為種子站點寫入資料庫。初始化後，所有站點設定以資料庫為準，後續可在管理後台隨時新增與調整：
| 設定項 | 類型 | 必填 | 說明 |
| :--- | :--- | :---: | :--- |
| `id` | 字串 | 是 | 站點唯一識別碼（字母/數字開頭，匹配 `^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$`）。 |
| `site_url` | 字串 | 是 | 規範站點 URL（如 `https://blog.example.com`）。 |
| `name` | 字串 | 否 | 站點可讀名稱（留空時自動回退為網域名稱）。 |
| `allowed_origins` | 字串列表 | 是 | 允許呼叫評論介面的前端精確 Origin 列表。 |
| `management_key_env` | 字串 | 否 | 外部自動化呼叫評論刪除 API 的獨立憑證環境變數名（至少 32 字元，各站點不可共享）。 |
| `comment` | 物件 | 否 | 評論表單預設規則（`placeholder`, `default_sort`, `length_limit`, `empty_message`, `email_required`, `website_required`）。 |

---

## 環境變數 `ecoku.env`

環境變數透過 Docker Compose 的 `env_file` 指令注入，保存所有高敏感機密：

| 變數名 | 必填 | 安全要求 | 範例與產生方式 |
| :--- | :---: | :--- | :--- |
| `GIN_MODE` | 否 | 生產環境固定為 `release` | `release` |
| `TZ` | 否 | 標準 IANA 時區標識 | `Asia/Taipei` |
| `ECOKU_ADMIN_USERNAME` | 是 | 管理員登入使用者名稱（1～80 字元） | `admin` |
| `ECOKU_ADMIN_PASSWORD_HASH` | 是 | 管理員密碼的 bcrypt 雜湊值 | 由 `ecoku-server hash-password` 指令產生 |
| `ECOKU_ADMIN_TOKEN_KEY` | 是 | 管理員 Bearer Token HMAC 簽名金鑰（至少 32 字元） | `openssl rand -hex 32` |
| `ECOKU_NOTIFICATION_ENCRYPTION_KEY` | 是 | 資料庫憑證 AES-256-GCM 主加密金鑰（Base64 編碼的 32 位元組字串） | `openssl rand -base64 32` |
