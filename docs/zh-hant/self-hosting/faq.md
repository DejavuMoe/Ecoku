# 常見問題與排錯指南

彙總 Ecoku 在部署、維運與日常管理中最常見的問題診斷與解決方案。

---

## 1. 登入與權限問題

### Q: 重新整理或重開瀏覽器後會保留登入嗎？

管理員會話使用 HttpOnly Cookie；SQLite 僅保存憑證摘要與到期時間。登入後固定 8 小時，重新整理或關閉重開可恢復有效會話，不延長期限。主動登出由服務端撤銷目前會話；登出失敗保留目前畫面並提示重試。憑證不進入 JavaScript、localStorage、sessionStorage 或 URL。

### Q: 啟動容器提示 `permission denied` 或無法讀寫 SQLite 資料庫？
**答**：Ecoku 容器採用非 root 使用者 `10001:10001` 運行。請在宿主機上檢查資料目錄與設定檔的所有者權限：
```bash
sudo chown -R 10001:10001 ~/Ecoku/data ~/Ecoku/app/logs ~/Ecoku/app/config.yaml
sudo chmod 750 ~/Ecoku/data ~/Ecoku/app/logs
sudo chmod 640 ~/Ecoku/app/config.yaml
```

---

## 2. 人機驗證與緊急復原

### Q: 人機驗證（Turnstile 或 Cap）設定錯誤導致管理員無法登入後台，如何復原？
**答**：使用官方內建的 CLI 救磚指令離線停用驗證碼：
```bash
sudo docker compose down
sudo docker compose run --rm --no-deps ecoku captcha disable
sudo docker compose up -d
```
服務啟動後，直接使用管理員帳號密碼登入管理後台，修正驗證碼參數後重新儲存即可。

### Q: 使用自託管 Cap 驗證碼時，主控台報錯 CSP (Content Security Policy) 攔截？
**答**：Ecoku 會根據目前選中的驗證碼提供方動態產生精確收斂的 CSP。若使用 Cap，請確保：
1. 在管理端安全設定中，Cap 的**實例位址必須以 `https://` 開頭**（本地開發除錯允許 `localhost` HTTP）。
2. Cap 的 API 端點（`/<sitekey>/siteverify`）必須在同一 HTTPS 網域下提供。
3. 若 Cap 客戶端開啟了 instrumentation（探針），Ecoku 的 CSP 會自動放行必要的 `'unsafe-eval'` 與 WASM 求值。

---

## 3. 網路反代與限流排錯

### Q: 訪客發表評論頻繁提示 `429 Too Many Requests`？
**答**：通常是因為未設定 `trusted_proxies`，導致所有訪客的請求都被識別為來自同一個反向代理網關 IP（如 Docker 網關 `172.18.0.1`），從而共享了同一個單一 IP 限流計數桶。
**解決辦法**：
1. 查詢 Docker 容器網關：
   ```bash
   sudo docker inspect ecoku --format '{{range .NetworkSettings.Networks}}{{.Gateway}}{{"\n"}}{{end}}'
   ```
2. 在 `app/config.yaml` 的 `site.trusted_proxies` 中填入該網關 IP（例如 `172.18.0.1/32`）。
3. 確保 Caddy 或 Nginx 設定中使用了 `{remote_host}` 或 `$remote_addr` **覆蓋**了 `X-Forwarded-For`。

---

## 4. 郵件與通知排錯

### Q: 發送郵件測試提示逾時或握手失敗？
**答**：
- Ecoku 僅接受 `tls` 或 `starttls` 加密方式；連接埠依郵件服務商要求填寫（常見為 465 / 587），不支援明文 SMTP。
- 請確認雲端伺服器安全性群組已放行實際設定的 SMTP 出站連接埠。
- 確認 `ecoku.env` 中的 `ECOKU_NOTIFICATION_ENCRYPTION_KEY` 已經正確設定，若主金鑰缺失或不合法，資料庫內加密的密碼將無法解密。

### Q: 評論區時間顯示與目前時區不一致？
**答**：
- Ecoku 評論時間由 `ecoku.env` 中的環境變數 `TZ` 控制（如 `TZ=Asia/Taipei` 或 `TZ=Asia/Tokyo`）。
- 該變數由 Docker Compose 注入給容器執行期，預設回退為 `Asia/Shanghai`。
- 修改 `ecoku.env` 中的 `TZ` 後執行 `sudo docker compose up -d --force-recreate ecoku`，重建容器以載入新環境變數；`restart` 不會更新容器環境變數。參見 [Docker Compose restart 說明](https://docs.docker.com/reference/cli/docker/compose/restart/)。

---

## 5. 文件站點 CI 部署

### Q: 文件站點的發佈目錄如何設定？

儲存庫的 `.woodpecker/docs-deploy.yml` 在 `master` push 時獨立建置並發佈文件，固定使用文件伺服器 agent。發佈容器僅掛載單一站點目錄 `/var/www/<DOCS_DOMAIN>:/deploy`；該目錄必須是實體目錄，Web 服務根目錄設為 `/var/www/<DOCS_DOMAIN>/html`。

Nginx 可參考儲存庫的 `deploy/nginx-docs.conf.example`，替換網域與 TLS snippet 佔位符；從舊目錄配置遷移時在現有 `root` 路徑後追加 `/html`。本站啟用了 VitePress `cleanUrls: true`，`location /` 中需使用 `try_files $uri $uri.html $uri/ =404;`，讓 `/self-hosting/docker` 等無副檔名路徑匹配產生的 `.html` 檔案，否則直接存取或重新整理會回傳 404。執行 `sudo nginx -t && sudo systemctl reload nginx` 後生效。

```text
/var/www/<DOCS_DOMAIN>/
├── .deploy.lock
├── html -> releases/<commit>-<pipeline>-<rerun>
└── releases/
    └── <commit>-<pipeline>-<rerun>/
```

發佈腳本先驗證完整產物，再加鎖原子替換 `html`，拒絕舊流水線覆蓋新版本；切換驗證成功後僅保留目前版本和剛被替換的上一版，清理更早的發佈目錄；失敗或過期發佈不觸發清理。首次發佈只有一個版本，之後正常保留兩個，上一版可供手動回滾。清理失敗會輸出警告。驗證僅檢查本地檔案與軟連結，不包含線上 HTTP 健康檢查。

從舊配置遷移時，先確保沒有文件發佈工作正在執行或排隊，再移除舊 `/var/www/<DOCS_DOMAIN>` 軟連結、建立同名實體目錄並修改 Web 服務根目錄。若選擇刪除舊 `/var/www/.<DOCS_DOMAIN>-releases`，先確認無需保留其中的靜態產物。清空後文件站點會暫時無法使用，直到新 CI 發佈成功且 Web 設定生效；評論服務與資料庫不受影響。完成準備後再推送新版 CI，勿重新執行舊版發佈工作。

本地隔離驗證使用 `sh scripts/test-publish-docs.sh`。`DOCS_DEPLOY_ROOT` 可覆蓋腳本預設的 `/deploy`，取代舊的 `DOCS_DEPLOY_PARENT` / `DOCS_DEPLOY_SITE`，它不是 Ecoku 應用程式環境變數。
