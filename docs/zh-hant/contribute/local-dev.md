# 本機開發

本機開發使用倉庫根目錄 `mise.toml` 固定的 Go、Node.js 與 pnpm，不使用 Corepack。CI 與容器建置直接使用相同版本的官方 Node/Go 映像，不安裝 mise；生產部署仍以 Docker Compose 為準。

## 初始化

```bash
mise install
pnpm install --frozen-lockfile
cp server/config.yaml.example server/config.yaml
mkdir -p server/data
```

一次性建置產物與驗證檔案放在 Git 排除的根目錄 `tmp/`。本機資料庫和持久金鑰由服務依設定寫入 `server/data/`，不要提交這些執行資料。

本機服務使用 SQLite 檔案與 `server/config.yaml`。新資料庫首次啟動時會自動建立管理員 `admin`，在終端印出臨時密碼，並在 `server/data/ecoku-secrets.json` 儲存持久金鑰。使用臨時密碼登入後台後必須改密；無需預先匯出管理員憑據或通知加密金鑰。

既有開發資料庫繼續使用原管理員帳號；如先前設定過舊環境變數，請先完成持久化遷移再移除，參見 [舊設定遷移](../self-hosting/upgrade#legacy-config)。

## 啟動

```bash
(cd server && go run .)
pnpm -C packages/client dev
ECOKU_ADMIN_DEV_API_URL=http://127.0.0.1:12123 pnpm -C packages/admin dev
pnpm docs:dev
```

以上命令按需在不同終端執行。

本機透過 `http://127.0.0.1:12123` 存取 API，預設連接埠為 `12123`，資料庫位於 `server/data/ecoku.bin`，持久金鑰位於同目錄的 `ecoku-secrets.json`。原始碼執行預設不提供瀏覽器靜態資源，評論區與管理後台使用各自的 Vite 開發伺服器；Docker 映像提供建置後的靜態頁面。

完整驗證由 Woodpecker 執行；本機只執行與目前改動直接相關且 CI 未覆蓋的檢查。

開發後台的來源（範例設定中的 `http://localhost:5174`）必須寫在獨立的 `admin.allowed_origins` 中，開發頁透過 Vite 同源 `/api` 代理存取伺服器。只有明確允許的 HTTP localhost/回環來源可用非 Secure Cookie，正式環境必須 HTTPS。
