# 設定參考

`app/config.yaml` 的欄位、預設值、可選值、用途與範例集中在下方註解範本中。Docker 部署頁引用同一份範本，無需在多份欄位表之間查找。

## 完整設定範本 {#template}

複製範本並替換 `instance_public_url`。其他未註解的值使用預設值；註解中的賦值可依需要啟用。YAML 中每個頂層區段只能出現一次，不能重複附加 `site:` 或 `admin:`。後台始終啟用；工作階段時長是固定限制，不能自由調整。

<div class="config-template">

<<< ../../../deploy/config.zh-hant.yaml.example{yaml}

</div>

## 修改後生效 {#reload}

儲存檔案後，在 Compose 所在目錄重建容器並查看日誌。單純修改掛載的 YAML 不會熱更新服務：

```bash
sudo docker compose up -d --force-recreate ecoku
sudo docker compose logs --tail=100 ecoku
```

設定檔只能包含一個 YAML 文件。未知欄位、無效值或重複欄位會阻止啟動；依日誌修正後重新啟動。

## 限流行為 {#rate-limit}

`rate_limit` 每一項的預設值、單位與範例均在範本中。按 IP 分別計數，超限回傳 `429` 與 `Retry-After`；程序重啟後計數歸零。填寫 `0` 是恢復預設值，不是關閉限流。反向代理場景也要設定 `site.trusted_proxies`，避免所有訪客共用代理位址的額度。

## 日誌 {#logs}

預設日誌寫到標準輸出，以 `docker compose logs` 查看，保留與輪替由 Docker 管理。`site.log_path` 是可選的檔案日誌路徑；設定實際路徑時同時寫標準輸出和檔案，並須掛載容器可寫入的目錄。具體值見範本。

## 環境變數 {#env}

新部署不需要 `ecoku.env`。Compose 中的 `TZ: Asia/Shanghai` 決定評論與通知的顯示時區，`ECOKU_ADMIN_LOCALE: zh-CN` 決定管理後台語言；可選值為 `zh-CN`、`zh-Hant`、`en`。站點評論區語言在後台站點的 `i18n` 欄位設定，SDK 的 `i18n` 參數可以覆寫它。這些是 Compose 環境變數，不是 YAML 設定欄位。

範本中的 `*_env` 是程式讀取的環境變數名稱，不是秘密值；需要自行注入時，在 Compose 的 `environment` 或 `env_file` 提供對應變數。預設自動建立管理員和持久金鑰，不必注入這些憑據。映像檔已設定 `GIN_MODE=release` 和 `ECOKU_RUNTIME=container`，不要覆寫。

## 初始化與持久資料 {#legacy}

站點種子 `sites` 僅在建立全新資料庫時匯入，不會覆蓋既有站點；後續站點編輯、SMTP、Telegram、人機驗證與 Smoji 在後台完成。資料庫和同目錄的 `ecoku-secrets.json` 必須一起備份。修改資料庫路徑不會自動搬移資料。
