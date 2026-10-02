# 設定參考

`app/config.yaml` 的欄位、預設值、可選值、用途與範例集中在下方註解範本中。Docker 部署頁引用同一份範本，無需在多份欄位表之間查找。

## 完整設定範本 {#template}

新部署複製範本並替換 `instance_public_url`。已展開的項目使用預設值；舊版相容項保持註解，只有保留舊部署行為時才需要啟用。YAML 中每個頂層區段只能出現一次，不要在檔案末尾重複附加 `site:` 或 `admin:`。

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

預設日誌寫到標準輸出，以 `docker compose logs` 查看，保留與輪替由 Docker 管理。範本中的 `site.log_path` 僅為舊版相容項；新部署不需要日誌目錄掛載。

## 環境變數 {#env}

新部署不需要 `ecoku.env`。Compose 中的 `TZ: Asia/Shanghai` 決定評論與通知的顯示時區；需要其他時區時直接修改該行。`TZ` 不是 YAML 設定欄位。

範本中的 `*_env` 都是舊環境變數的名稱，而非秘密值。新實例自動建立管理員、臨時密碼與持久金鑰；舊實例須先完成匯入及備份，再移除原變數。映像已設定 `GIN_MODE=release` 和 `ECOKU_RUNTIME=container`，不要覆寫。

## 舊設定遷移 {#legacy}

範本保留目前仍接受的相容欄位及其預設值。站點種子只在建立全新資料庫時匯入，不會覆蓋已有站點；站點、SMTP、Telegram、人機驗證與 Smoji 在後台修改。

升級與刪除舊環境變數的操作步驟見 [舊實例設定遷移](../self-hosting/upgrade#legacy-config)。資料庫與同目錄的 `ecoku-secrets.json` 必須一起備份。
