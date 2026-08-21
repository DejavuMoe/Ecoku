# 後台配置

前往 `https://comments.example.com/admin/`，使用初始化時的管理員帳戶登入。Token 只在當前頁面記憶體，重新整理後需重新登入。管理端來源與公開評論站點來源是兩套白名單，不能混用。

## 站點

在「站點管理」中建立：

| 欄位 | 說明 |
| --- | --- |
| 站點 ID | 穩定、簡短，建立後不可改 |
| 站點 URL | 如 `https://blog.example.com`；通知原文連結只從這裡與頁面 key 拼接 |
| 站點名稱 | 留空時回落到 URL 域名 |
| 允許來源 | 每行一個完整 Origin，如 `https://blog.example.com` |
| 預設排序 | `newest` 或 `oldest` |
| 信箱 / 網站 | 是否必填；預設信箱必填、網站可選 |
| 提示文字 | 最多 80 字；空則「寫下評論（僅支援純文字）」 |
| 正文上限 | 1–10000 個 Unicode code point，預設 1000 |
| 無評論文案 | 預設「還沒有評論」加一行「成為第一個留下評論的人。」 |

新評論送出後直接公開。management key 只供可信服務端自動化做所屬站點的墓碑刪除，管理端新建站點預設不生成金鑰；它對評論列表/詳情返回 403。

## 博主

暱稱與信箱必須同時填寫或同時留空；啟用時還須設定口令（12–80 字元）。口令只存 bcrypt，界面只返回是否已設定。

公開評論區不為博主提供額外表單：暱稱欄填口令即可。服務端改寫為配置暱稱、私有信箱，網站設為該站點 URL。口令填錯且同時提供了訪客身份時，按普通訪客發布。

保存口令時，按暱稱精確匹配、信箱大小寫不敏感匹配，回填未刪除的歷史評論。公開只多一個徽章、`isBlogger` 和站點連結。

## 通知

實例級，不隨站點選擇器變化。支援 SMTP 博主通知、訪客直接回覆郵件、Telegram 博主通知。測試投遞單獨限流。

SMTP 只允許 `tls` 或 `starttls`。密碼與 Bot Token 使用 `ECOKU_NOTIFICATION_ENCRYPTION_KEY` 加密；缺金鑰或無法解密則失敗關閉。界面不展示通知判定表或模板預覽。判定矩陣見 [特性](/zh-hant/guide/features#通知)。

## 機器人驗證

「安全」頁三態：關閉 / Cloudflare Turnstile / 自託管 Cap。啟用時後兩者只能選一個，同時保護評論送出和管理員登入。切換或關閉不會清除另一提供方已保存的配置。兩者故障都失敗關閉，不會自動降級。

### Turnstile

1. 在 Cloudflare 控制臺建立小組件，把管理端與全部評論站點主機名加入列表。
2. 管理端選擇 Turnstile，填 Sitekey 與 Secret key。
3. 小組件模式只在 Cloudflare 配置。

Secret 使用同一通知主金鑰加密。未配置該金鑰時不能保存已啟用的 Turnstile。

Pre-clearance 也只在 Cloudflare 配置。`cf_clearance` 不會讓 Ecoku 跳過 Siteverify。站點不在 Cloudflare 代理後應關閉它，否則控制臺出現 `aborting clearance redemption`。

### Cap

Cap 的 `ADMIN_KEY` 只用於 Cap 自己的後台，不要填進 Ecoku。

1. 在 Cap Standalone 為 Ecoku 建立 Key；保持 instrumentation 開啟，並把管理端 Origin 與每個評論站點 Origin 加入該 Key 的 CORS。
2. 實例須為公開 HTTPS，並提供固定版本的 `/assets/widget.js` 與 `/assets/cap_wasm_bg.wasm`。
3. 管理端選擇 Cap，填寫實例根地址、Site key、Secret key。地址只接受公開 HTTPS，不要帶憑據、query、fragment、localhost 或私網 IP。
4. 保存後另開普通窗口驗證登入和發表。Token 單次使用。

`v0.1.6` 起，管理端只在 Cap 為當前方式時，為該精確 Origin 加入 Widget、WASM、Blob Worker、nonce 與 instrumentation 所需的 `'unsafe-eval'`。切到關閉或 Turnstile 會在下一次頁面響應中去掉這些項，但保留 Cap 配置。

若 instrumentation 返回 `instr_timeout` 且 `/redeem` 為 429，先核對響應 CSP 是否來自當前鏡像。不要靠改 CORS、關閉失敗關閉，或給 Caddy 加第二份寬泛 CSP 繞過。

使用鏡像同源加載器的站點會隨鏡像獲得 Cap 支援。自行固定舊 npm/UMD SDK 的站點必須先更新到包含 `formConfig.captcha` / `captchaToken` 的版本。

宿主站點若使用嚴格 CSP：Turnstile 需允許 `https://challenges.cloudflare.com`；Cap 需加入實例 Origin、`worker-src blob:`、`'wasm-unsafe-eval'`，以及當前 Cap 3.x instrumentation 所需的 `'unsafe-eval'`。不接受動態求值風險時，關閉該 Key 的 instrumentation 或改用 Turnstile。

## 驗證故障時恢復登入

當前提供方故障導致無法登入時，在 Ecoku 主機顯式停服恢復。命令會保留冷備份，把驗證方式設為關閉，兩套配置都保留：

```bash
set -euo pipefail
cd ~/Ecoku

sudo docker compose down
sudo test ! -e ./data/ecoku.sqlite3-wal
sudo test ! -e ./data/ecoku.sqlite3-shm

umask 077
mkdir -p ./backups
backup_stamp="$(date +%Y%m%d-%H%M%S)"
sudo cp --reflink=auto --preserve=mode,timestamps \
  ./data/ecoku.sqlite3 "./backups/ecoku-before-captcha-disable-${backup_stamp}.sqlite3"
sudo chown "$USER":"$USER" "./backups/ecoku-before-captcha-disable-${backup_stamp}.sqlite3"
chmod 600 "./backups/ecoku-before-captcha-disable-${backup_stamp}.sqlite3"

sudo docker compose run --rm --no-deps ecoku captcha status
sudo docker compose run --rm --no-deps ecoku captcha disable
sudo docker compose up -d
```

無 CAPTCHA 登入後修復或切換提供方再保存。必須使用當前精確鏡像和同一個 `./data`。不要手改設定表。

## 時區

`TZ` 只寫在 `ecoku.env`。改完後必須重建容器：

```bash
printf "\nTZ='Asia/Singapore'\n" >> ecoku.env
sudo chmod 0600 ./ecoku.env
sudo docker compose up -d
```

懸停提示形如 `Asia/Singapore UTC+8`。`v0.1.0-rc.7` 及更早鏡像不會應用該格式，需先升級。
