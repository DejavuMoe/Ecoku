# 常見問題

## `/api/health` 正常，但頁面打不開

健康檢查只表示行程可回應。確認反代轉發了 `/`、`/api/`、`/admin/`、`/client/`：

```bash
sudo docker compose ps
sudo docker compose logs --tail=200 ecoku
```

詳見 [反向代理](./reverse-proxy)。

## 所有訪客共用一個限流桶

常見於 `trusted_proxies: []`，或反代**追加**而非覆蓋 `X-Forwarded-For`。按 [反向代理](./reverse-proxy#用戶端位址與限流) 設定 Docker 閘道 `/32`；不要填 `0.0.0.0/0`、`::/0` 或 CDN 網段。

## 出現 CORS 錯誤

站點 Allowed origins 填評論頁完整 Origin；管理端填管理頁 Origin。協定、網域、連接埠須完全一致，不能帶路徑或用 `*`。

## 管理員無法登入

核對使用者名稱、bcrypt 雜湊、`ECOKU_ADMIN_TOKEN_KEY` 與管理端 Allowed origins。若被人機驗證擋住，見 [恢復登入](./admin#驗證故障時恢復登入)。

## Turnstile 或 Cap 驗證失敗

確認執行個體能存取驗證服務，金鑰成對，CORS 含所需 Origin，瀏覽器能載入 Widget / WASM / Siteverify。token 一次性消費，失敗後需重新求解。

## 升級後提示資料庫版本不支援

不要刪庫或手工改 `schema_migrations`。保留備份，對照 [升級](./upgrade) 中的映像與 schema 表。只支援順序原位升級，沒有降級遷移。

## 如何修改時區

改 `ecoku.env` 的 `TZ` 為 IANA 名（如 `Asia/Singapore`），再：

```bash
sudo docker compose up -d --force-recreate
```

## 嚴格 CSP 阻止驗證元件

Turnstile 需要 Cloudflare Origin；Cap 需要執行個體 Origin、WASM、Blob Worker，instrumentation 可能還需 `'unsafe-eval'`。見 [人機驗證](./admin#人機驗證)。
