# 後台管理配置

管理後台位於實例的 `/admin/` 路徑。

---

## 1. 登入與會話特性
- **記憶體 Bearer Token**：登入成功後簽發的 Token 僅保存在 Vue 記憶體中，絕不寫入 `localStorage`、`sessionStorage` 或 Cookie。重新整理或關閉頁面立即登出。
- **會話有效時間**：預設為 8 小時（480 分鐘）。

---

## 2. 站點管理
- **站點 ID**：唯一識別碼，建立後永久唯讀。
- **規範站點 URL**：產生原文連結的基礎 URL。
- **允許來源 (Allowed Origins)**：精確的 CORS 白名單。
- **表單必填項**：獨立設定信箱與網站是否必填。
- **Smoji 貼圖**：支援配置遠端 HTTPS `smoji.json` 清單。

---

## 3. 站長身分與口令（Passphrase）
- 設定站長暱稱、私有信箱與 12～80 字元的站長口令。
- 前台評論時，站長只需在暱稱框輸入口令，即可免密完成身分認證。

---

## 4. 評論治理
- **墓碑軟刪除**：抹除個人資訊並保留結構，顯示 `[該評論已刪除]`。
- **徹底清除**：僅在墓碑沒有任何子回覆時允許物理刪除。

---

## 5. 人機驗證（Captcha）
- 三態切換：關閉、Cloudflare Turnstile、自託管 Cap。

---

## 6. CLI 救磚命令

```bash
sudo docker compose down
sudo docker compose run --rm --no-deps ecoku captcha disable
sudo docker compose up -d
```
