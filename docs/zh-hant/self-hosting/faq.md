# 常見問題

遇到問題時，請先看容器日誌，大多數啟動錯誤都會在這裡寫明原因：

```bash
cd ~/Ecoku
sudo docker compose ps
sudo docker compose logs --tail=100 ecoku
```

## 部署與啟動

### 容器反覆重新啟動，日誌提示 permission denied

容器以 UID/GID `10001:10001` 執行，需要能讀取 `app/config.yaml`、能寫入 `data/` 和 `app/logs/`。修正擁有者與權限後重新啟動：

```bash
cd ~/Ecoku
sudo chown -R 10001:10001 data app/logs
sudo chmod 750 data app/logs
sudo chown "$(id -u):$(id -g)" app app/config.yaml
chmod 644 app/config.yaml
sudo docker compose up -d
```

`app/config.yaml` 不含金鑰，屬於你自己的帳號即可，之後編輯不需要 `sudo`。

### 編輯 app/config.yaml 時提示權限不足 {#config-permission}

早期的部署步驟把 `app/` 和 `app/config.yaml` 的擁有者設為 root 或 UID 10001。把它們改回自己的帳號即可，不需要重建容器：

```bash
cd ~/Ecoku
sudo chown "$(id -u):$(id -g)" app app/config.yaml
chmod 755 app
chmod 644 app/config.yaml
```

### 容器反覆重新啟動，日誌提示 config.yaml is a directory

啟動前 `app/config.yaml` 不存在，Docker 在這個位置建立了一個空目錄。停止服務，刪除這個目錄，依照 [Docker 部署](./docker)第 3 步重新寫入設定檔後再啟動：

```bash
cd ~/Ecoku
sudo docker compose down
sudo rmdir app/config.yaml
```

### 儲存站點時提示「公开站点来源不能复用管理端来源」

站點的允許來源與 `admin.allowed_origins` 中的位址重複了。管理後台必須使用一個獨立的來源，通常就是 Ecoku 自己的網域，例如 `https://ecoku.example.com`。如果在 `app/config.yaml` 中寫了 `sites`，同樣的衝突會在啟動時提示「管理员来源 … 不能复用公开站点来源」。

### 日誌提示「管理员会话固定为 8 小时」

`app/config.yaml` 中的 `admin.token_ttl_minutes` 不是 480。刪除這一行或改為 `480`，再重建容器。

### 日誌提示「无法解密 … 凭据」

資料庫中儲存過 SMTP、Telegram 或人機驗證的憑據，但 `ECOKU_NOTIFICATION_ENCRYPTION_KEY` 缺失或與儲存時不同。請從備份中找回原本的 `ecoku.env`，還原這把金鑰。金鑰無法找回時，只能從先前的備份還原整個實例。

### 修改了 ecoku.env 但沒有生效

`docker compose restart` 不會重新讀取 `env_file`。修改 `ecoku.env` 或 `app/config.yaml` 後，請用下面的指令重建容器：

```bash
cd ~/Ecoku && sudo docker compose up -d --force-recreate ecoku
```

## 評論區

### 頁面上沒有出現評論區

載入器找不到必要的屬性時會靜默略過，不顯示任何提示。請檢查：

- 外層元素上有 `data-ecoku-comments`，內部有 `data-ecoku-mount`、`data-ecoku-loader`、`data-ecoku-status`、`data-ecoku-retry` 四個元素，結構與[接入範例](../integration/html)一致；
- `data-server-url`、`data-site-id`、`data-page-key` 三個屬性都有值；
- 在瀏覽器開發人員工具的「網路」面板中，`ecoku-loader.js` 和 `ecoku.umd.js` 能正常載入。

### 評論區顯示「评论暂时不可用」，或提示沒有權限

多半是文章頁的來源沒有登記。在後台「站点管理」中，把瀏覽器網址列中的 `协议://域名[:端口]` 加入該站點的允許來源。帶 `www` 與不帶 `www` 是兩個不同的來源。

### 訪客頻繁收到「提交过于频繁」

Ecoku 放在反向代理後面，但沒有設定 `trusted_proxies`，所有訪客都被算作同一個 IP，共用每分鐘 5 次的送出額度。請依照[反向代理](./reverse-proxy#trusted-proxies)填入 Docker 閘道位址，並確認反向代理以覆寫方式設定 `X-Forwarded-For`。

### 某篇文章的評論載入失敗，其他文章正常

這篇文章的討論可能超出了單次讀取的上限（200 則評論、16 層或 1 MiB）。可以在接入程式碼中調低 `data-page-size`；如果是單一討論串本身過大，調低也沒有用，需要在後台刪除部分評論。詳見[討論串與分頁](../guide/concepts#threads)。

### 調整部落格連結格式後，舊評論不見了

評論依頁面 key 儲存。連結格式改變後，接入程式碼產生的頁面 key 也跟著改變。資料仍在資料庫中，把 `data-page-key` 改回原本的產生方式即可重新顯示。

### 評論時間的時區不對

時區由 `ecoku.env` 中的 `TZ` 決定，例如 `TZ='Asia/Tokyo'`。修改後需要重建容器（見上文）。

## 管理後台

### 無法登入

請依序排查：

1. 透過 HTTPS 存取後台。只有 `localhost`、`127.0.0.1` 可以用 HTTP。
2. 網址列中的來源已寫入 `admin.allowed_origins`，而且與存取的位址完全一致（包括連接埠）。
3. 使用者名稱和密碼正確。同一 IP 每分鐘最多 5 次登入請求（成功的也計入），超出後依提示等待。沒有設定 [`trusted_proxies`](./reverse-proxy#trusted-proxies) 時，所有人共用這一個額度。
4. 人機驗證元件能正常完成驗證。驗證服務出問題時，用 `captcha disable` 暫時關閉，見[人機驗證](./captcha#disable)。

### 忘記了管理員密碼

重新產生密碼雜湊，取代 `ecoku.env` 中 `ECOKU_ADMIN_PASSWORD_HASH` 的值（保留兩側的單引號，否則雜湊中的 `$` 會被 Compose 展開），再重建容器：

```bash
cd ~/Ecoku
read -rsp '新密码: ' P; echo
printf '%s\n' "$P" | sudo docker run --rm -i git.via.moe/dejavu/ecoku:v0.2.6 hash-password
unset P
```

更換後所有已登入的工作階段都會失效。

## 通知與人機驗證

### 測試郵件寄送失敗

見[通知](./notifications#troubleshooting)。

### 儲存 Cap 設定時提示位址無效

Cap 實例位址必須是可從公開網路存取的 HTTPS 位址，不能帶使用者名稱密碼、查詢字串或 `#` 片段。`localhost`、`127.0.0.1` 和內部網路 IP 都會被拒絕。

### 啟用 Cap 後，瀏覽器主控台出現 CSP 錯誤

如果錯誤出現在部落格頁面，表示部落格自己的 CSP 沒有為 Cap 放行，需要加入 Cap 實例來源、`worker-src blob:` 和 WebAssembly 權限，詳見[人機驗證 · 內容安全政策](./captcha#csp)。管理後台的 CSP 由 Ecoku 自動調整，不需要手動處理。
