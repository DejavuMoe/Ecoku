# 常見問題

## 容器 unhealthy 或反覆重啟

看 `sudo docker compose logs --tail=200 ecoku`。常見原因是遷移失敗、配置校驗失敗或管理員靜態目錄缺失。對照 [升級說明](/zh-hant/self-hosting/upgrades/) 與當前 `CHANGELOG.md`。

## 啟動報未知 schema / 校驗和不符

用舊鏡像打開了已升級庫，或手工改過 `schema_migrations`。停服，用升級前冷備份整庫恢復；不要只回退鏡像。

## 限流像所有人共用一個桶

`trusted_proxies` 為空，或反代**追加**而非覆蓋 `X-Forwarded-For`。按 [反向代理](/zh-hant/self-hosting/reverse-proxy) 拓撲 1：Docker 網關 `/32` + Caddy/Nginx 覆蓋頭。不要填 `0.0.0.0/0` 或 CDN 段。

## CORS 拒絕評論送出

站點 `allowed_origins` 未登記頁面 Origin。管理端補全；管理端來源與公開站點來源分開配。

## Turnstile 登入或評論失敗

管理端「安全」檢查是否啟用、Sitekey/Secret 是否已設定。Secret 需要 `ECOKU_NOTIFICATION_ENCRYPTION_KEY`。Siteverify 失敗不會自動降級。

## Cap 登入或評論失敗

檢查 Cap 健康、Key 的 CORS、`/assets/widget.js`、WASM 與 Siteverify。Token 已消費需重新求解。無法登入時按 [後台配置](/zh-hant/self-hosting/admin#驗證故障時恢復登入) 執行 `captcha disable`。

`instr_timeout` 且 `/redeem` 429：核對管理端響應 CSP 是否來自當前鏡像（`v0.1.6` 起 Cap 模式才含 `'unsafe-eval'`）。不要給 Caddy 加第二份寬泛 CSP。

## 控制臺 aborting clearance redemption

開了 Cloudflare Pre-clearance，但站點不在 CF 代理後。在 Cloudflare 控制臺關閉；小組件仍可完成 Siteverify。

## 備份後恢復仍異常

備份時存在 WAL/SHM，或只複製了主檔案。必須停服且確認無邊車檔案後再備份。

## 評論時間不對

容器未設定 `TZ`，或改 `ecoku.env` 後未重建容器。寫入 IANA 名稱後 `docker compose up -d`。未設定時回退 `Asia/Shanghai`。

## 博主評論無徽章

歷史評論未回填。管理端再保存一次博主口令；暱稱與信箱須與歷史評論一致。

## management key 能刪不能看列表

設計如此：該 key 只做所屬站點墓碑刪除。列表與詳情用管理員登入。

## 宿主 CSP

Turnstile：允許 `https://challenges.cloudflare.com` 的 `script-src`、`frame-src`、`connect-src`。

Cap：實例 Origin 加入 `script-src` 與 `connect-src`；`worker-src blob:`；`'wasm-unsafe-eval'`；啟用 instrumentation 時還需要 `'unsafe-eval'`。不要用 `*` 或寬泛 `unsafe-inline` 代替。
