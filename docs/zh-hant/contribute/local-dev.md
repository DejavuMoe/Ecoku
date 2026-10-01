# 本機開發

本機開發使用倉庫根目錄 `mise.toml` 固定的 Go、Node.js 與 pnpm，不使用 Corepack。CI 與容器建置直接使用相同版本的官方 Node/Go 映像，不安裝 mise；生產部署仍以 Docker Compose 為準。

## 初始化

```bash
mise install
pnpm install --frozen-lockfile
cp server/config.yaml.example server/config.yaml
mkdir -p server/data
```

本機建置產物、執行資料與一次性發佈驗證統一放在 Git 排除的根目錄 `tmp/`，不要寫入原始碼目錄。

本機服務使用 SQLite 檔案與 `server/config.yaml`。管理後台始終啟用，啟動服務前在目前 shell 中匯出管理員憑據，不要寫入倉庫。下面的登入密碼是 `local-dev-password`：

```bash
export ECOKU_ADMIN_USERNAME=admin
export ECOKU_ADMIN_PASSWORD_HASH="$(printf '%s\n' 'local-dev-password' | (cd server && go run . hash-password))"
export ECOKU_ADMIN_TOKEN_KEY="$(openssl rand -hex 32)"
```

在後台儲存 SMTP 密碼、Telegram Bot Token 或人機驗證金鑰時，還需要匯出 `ECOKU_NOTIFICATION_ENCRYPTION_KEY`（可用 `openssl rand -base64 32` 產生）。

## 啟動

```bash
(cd server && go run .)
pnpm -C packages/client dev
ECOKU_ADMIN_DEV_API_URL=http://127.0.0.1:12123 pnpm -C packages/admin dev
pnpm docs:dev
```

以上命令按需在不同終端執行。

伺服器預設為 `http://127.0.0.1:12123`，評論區開發頁預設為 `http://localhost:3000`。若要由 Go 提供靜態檔案，請先建置相應套件，再在 `server/config.yaml` 中填寫 `client.static_dir: ../packages/client/dist` 或 `admin.static_dir: ../packages/admin/dist`。

完整驗證由 Woodpecker 執行；本機只執行與目前改動直接相關且 CI 未覆蓋的檢查。

開發後台的來源（範例設定中的 `http://localhost:5174`）必須寫在獨立的 `admin.allowed_origins` 中，開發頁透過 Vite 同源 `/api` 代理存取伺服器。只有明確允許的 HTTP localhost/回環來源可用非 Secure Cookie，正式環境必須 HTTPS。
