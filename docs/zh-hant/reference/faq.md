# 常見問題

大部分問題的原因都寫在容器日誌裡，先看這裡：

```bash
cd ~/Ecoku
sudo docker compose ps
sudo docker compose logs --tail=100 ecoku
```

## 部署 {#deploy}

::: details 容器反覆重新啟動，日誌裡有 permission denied
容器以 UID/GID `10001:10001` 執行，要能讀取 `app/config.yaml`、寫入 `data/`：

```bash
cd ~/Ecoku
sudo chown -R 10001:10001 data
sudo chmod 750 data
sudo chown "$(id -u):$(id -g)" app app/config.yaml
chmod 755 app
chmod 644 app/config.yaml
sudo docker compose up -d
```
:::

::: details 容器反覆重新啟動，日誌裡有 config.yaml is a directory
啟動前 `app/config.yaml` 還不存在，Docker 在那裡建了一個空目錄。刪掉它，[寫好設定檔](../self-hosting/docker#config) 再啟動：

```bash
cd ~/Ecoku
sudo docker compose stop ecoku
sudo rmdir app/config.yaml
```
:::

::: details 改了設定沒有生效
修改 `app/config.yaml` 或 `compose.yaml` 後要重建容器：

```bash
cd ~/Ecoku && sudo docker compose up -d --force-recreate --wait --wait-timeout 120 ecoku
```
:::

::: details 啟動失敗：「通知凭据校验失败」或「CAPTCHA 凭据校验失败」
`data/ecoku-secrets.json` 和資料庫對不上。確認它和資料庫來自同一份備份，擁有者是容器使用者，權限為 `600`。不要刪掉它讓程式重新產生。見 [從備份還原](../self-hosting/backup#restore)。
:::

::: details 啟動失敗：「与已存储的公开站点来源重叠」
管理後台的來源和某個站點的允許來源重複了。後台要用獨立的網域，見 [設定生效與來源檢查](./configuration#reload)。
:::

## 評論區 {#comments}

::: details 頁面上沒有出現評論區
載入器找不到需要的元素或屬性時什麼都不顯示。檢查：

- 外層元素上有 `data-ecoku-comments`，裡面有 `data-ecoku-mount`、`data-ecoku-loader`、`data-ecoku-status`、`data-ecoku-retry` 四個元素；
- `data-server-url`、`data-site-id`、`data-page-key` 都有值；
- 瀏覽器網路面板裡 `ecoku-loader.js` 和 `ecoku.umd.js` 都載入成功。
:::

::: details 顯示「評論暫時無法使用」
最常見的原因是文章頁的來源沒登記。在後台站點的 [允許來源](../admin/sites#origins) 裡加上瀏覽器網址列的 `協定://網域[:連接埠]`。帶 `www` 和不帶 `www` 是兩個來源。
:::

::: details 訪客經常看到「提交過於頻繁，請稍後再試。」
沒有設定 `trusted_proxies`，所有訪客被當成同一個 IP。見 [設定 trusted_proxies](../self-hosting/reverse-proxy#trusted-proxies)。
:::

::: details 只有某一篇文章的評論載入失敗
看網路面板裡評論列表請求是否回傳 `422`。這表示討論超過了單次讀取的上限，見 [討論串與分頁](./concepts#threads)。多則根評論加起來超限時，調低 `data-page-size` 能解決。
:::

::: details 改了部落格的連結格式後，舊評論不見了
評論依頁面 key 儲存，連結格式一變，頁面 key 也變了。資料還在，把 `data-page-key` 改回原來的產生方式即可。見 [頁面 key](./concepts#page-key)。
:::

::: details 評論時間的時區不對
修改 `compose.yaml` 裡的 `TZ`，然後重建容器。見 [時區與後台語言](../self-hosting/docker#timezone)。
:::

## 管理後台 {#admin}

::: details 找不到初始密碼
Ecoku 沒有預設密碼，日誌裡也不會印出。依 [取得管理員臨時密碼](../self-hosting/docker#temporary-password) 產生一個。
:::

::: details 無法登入
依序檢查：

1. 用 HTTPS 開啟後台。只有 `localhost`、`127.0.0.1` 可以用 HTTP。
2. 網址列的來源和 `notifications.instance_public_url`（或 `admin.allowed_origins`）完全一致，包括連接埠。
3. 使用者名稱和密碼正確。同一 IP 每分鐘最多 5 次登入請求，成功的也算。
4. 人機驗證能正常完成。驗證服務壞了就 [用命令列關閉驗證](../admin/captcha#disable)。
:::

::: details 忘記管理員密碼
停服後用 `admin reset-password` 產生新的臨時密碼，見 [命令列](./cli#admin-reset-password)。
:::

## 通知與人機驗證 {#notify}

::: details 測試郵件傳送失敗
見 [通知 · 常見問題](../admin/notifications#troubleshooting)。
:::

::: details 儲存 Cap 設定時提示位址無效
Cap 位址必須是公開網路的 HTTPS 位址，不能帶使用者名稱密碼、查詢參數或 `#`。`localhost` 和內網 IP 都不行。
:::

::: details 啟用 Cap 後瀏覽器主控台報 CSP 錯誤
報錯在部落格頁面上，表示部落格自己的 CSP 沒有放行 Cap，見 [部落格頁面的 CSP](../admin/captcha#csp)。報錯在後台的話，重新整理後台頁面即可。
:::
