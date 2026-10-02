# 設定參考

::: warning 尚未發佈的設定契約
本頁對應下一版本。既有 v0.2.8 實例請先閱讀[升級與舊設定遷移](../self-hosting/upgrade#unreleased-config)。
:::

新部署的手動設定只有 `app/config.yaml`：

```yaml
notifications:
  instance_public_url: "https://ecoku.example.com"
```

站點、評論、通知、人機驗證和管理員帳戶保存在 SQLite 中，在[管理後台](../self-hosting/admin)修改。官方映像檔固定使用連接埠 `12123`、瀏覽器資源 `/app/client`、管理頁面 `/app/admin` 和資料庫 `/data/ecoku.sqlite3`。新實例的簽章金鑰、通知加密主金鑰和管理員帳戶也保存在 `data/`。

## site

| 欄位 | 預設值 | 說明 |
| --- | --- | --- |
| `trusted_proxies` | `[]` | 允許轉送 `X-Forwarded-For` 的直連對端，填 IP 或 CIDR。通常只填 Docker 閘道，例如 `172.18.0.1/32`。禁止 `0.0.0.0/0` 與 `::/0`。詳見[反向代理](../self-hosting/reverse-proxy#trusted-proxies)。 |

## rate_limit {#rate-limit}

所有限流按用戶端 IP 計數，狀態保存在程序記憶體中，重新啟動後清零。超過限制時回傳 `429` 和 `Retry-After`。

| 欄位 | 預設值 | 說明 |
| --- | --- | --- |
| `window_seconds` | `60` | 計數時間窗長度（秒）。 |
| `comment_submit` | `5` | 每個時間窗允許送出的評論數。 |
| `comment_list` | `60` | 每個時間窗允許讀取評論清單的次數。 |
| `comment_delete` | `30` | 每個時間窗允許刪除的次數。 |
| `admin_login` | `5` | 每個時間窗允許登入的次數。 |
| `notification_test` | `5` | 每個時間窗允許發送測試通知的次數。 |

## notifications

| 欄位 | 預設值 | 說明 |
| --- | --- | --- |
| `instance_public_url` | 空 | Ecoku 公開網址，例如 `https://ecoku.example.com`。未填 `admin.allowed_origins` 時，它的來源也是管理後台來源。啟用通知前必須填寫。 |

## admin

管理後台和管理 API 始終啟用，頁面位於 `/admin/`。

| 欄位 | 預設值 | 說明 |
| --- | --- | --- |
| `allowed_origins` | `instance_public_url` 的來源 | 允許存取管理 API 的瀏覽器來源。只有從多個位址開啟後台時才需要填寫。至少需要一個管理來源。 |

新實例啟動時會自動建立 `admin` 和隨機臨時密碼。臨時密碼只在首次建立帳戶時列印，首次登入後必須修改。新管理員帳戶不需要環境變數。

## 日誌 {#logs}

日誌寫到標準輸出，用 `docker compose logs` 查看，保留與輪替由 Docker 管理。新部署不掛載 `app/logs`，也不使用 `site.log_path`。

## 環境變數 {#env}

新部署不需要 `ecoku.env`。如需指定顯示時區，可在 Compose 設定選填的 `TZ`，例如 `Asia/Shanghai`。

既有實例升級時仍會讀取以下變數，並把它們導入 `data/ecoku-secrets.json` 或 `admin_accounts`：

| 變數 | 用途 |
| --- | --- |
| `ECOKU_ADMIN_USERNAME` | 舊管理員名稱。 |
| `ECOKU_ADMIN_PASSWORD_HASH` | 舊管理員 bcrypt 密碼雜湊。 |
| `ECOKU_ADMIN_TOKEN_KEY` | 舊管理員工作階段簽章金鑰。 |
| `ECOKU_NOTIFICATION_ENCRYPTION_KEY` | 已儲存通知和人機驗證憑據的加密主金鑰。遷移完成前不要更換。 |

變數導入並驗證成功後，可以停服備份，再刪除它們，讓程序改用 `/data` 中的持久狀態。

## 舊設定欄位 {#legacy}

新範本不再寫入這些欄位，但相容層仍會讀取：`site.port`、`site.log_path`、`client.static_dir`、`admin.static_dir`、`database.sqlite.path`、`sites`、`management_key_env`、`admin.enabled`、`admin.token_ttl_minutes` 和管理員或通知的 `*_env` 欄位。新實例不要加入這些欄位，見[升級](../self-hosting/upgrade#unreleased-config)。
