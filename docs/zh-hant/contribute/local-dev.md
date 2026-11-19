# 本機開發

本機開發使用倉庫根目錄 `mise.toml` 固定的 Go、Node.js 與 pnpm，不使用 Corepack。GitHub Actions 安裝對應版本的工具鏈；容器建置和 Woodpecker 文件部署使用官方映像，不安裝 mise。生產部署仍使用 Docker Compose。

## 初始化

```bash
mise install
pnpm install --frozen-lockfile
cp server/config.yaml.example server/config.yaml
mkdir -p server/data
```

一次性建置產物與驗證檔案放在 Git 排除的根目錄 `tmp/`。本機資料庫和持久金鑰由服務依設定寫入 `server/data/`，不要提交這些執行資料。

本機服務使用 SQLite 檔案與 `server/config.yaml`。新資料庫首次啟動時會自動建立管理員 `admin`，並在 `server/data/ecoku-secrets.json` 儲存持久金鑰，啟動日誌不輸出密碼。首次啟動完成後，先用 Ctrl+C 停止服務，再執行 `(cd server && go run . admin reset-password)`，從命令輸出取得臨時密碼，然後重新啟動服務。使用臨時密碼登入後台後必須改密；無需預先匯出管理員憑據或通知加密金鑰。

既有開發資料庫繼續使用原管理員帳號；如先前設定過舊環境變數，請先完成持久化遷移再移除，參見 [舊設定遷移](../self-hosting/upgrade#legacy-config)。

## 啟動

```bash
(cd server && go run .)
pnpm -C packages/client dev
ECOKU_ADMIN_DEV_API_URL=http://127.0.0.1:12123 pnpm -C packages/admin dev
pnpm docs:dev
```

以上命令按需在不同終端執行。

原始碼執行預設僅監聽 `127.0.0.1`，透過 `http://127.0.0.1:12123` 存取 API，預設連接埠為 `12123`，資料庫位於 `server/data/ecoku.bin`，持久金鑰位於同目錄的 `ecoku-secrets.json`。原始碼執行預設不提供瀏覽器靜態資源，評論區與管理後台使用各自的 Vite 開發伺服器；Docker 映像提供建置後的靜態頁面。容器模式（`ECOKU_RUNTIME=container`）繼續監聽容器內所有介面，主機可存取範圍仍由 Compose 連接埠映射決定。

評論區開發 demo 固定使用本機 API `http://127.0.0.1:12123/`，URL 查詢參數不能選擇或覆寫伺服器位址。

完整驗證由 GitHub Actions 執行；本機只執行與目前改動直接相關且 CI 未覆蓋的檢查。

開發後台的來源（範例設定中的 `http://localhost:5174`）必須寫在獨立的 `admin.allowed_origins` 中，開發頁透過 Vite 同源 `/api` 代理存取伺服器。只有明確允許的 HTTP localhost/回環來源可用非 Secure Cookie，正式環境必須 HTTPS。

## 映像檔遷移驗證 {#image-migration}

以下驗證指令在 Linux 環境中執行，需要 Go 工具鏈、Docker 和 Python 3。

以下指令只建置本地候選映像檔，使用臨時卷或臨時主機目錄驗證，不發布映像檔、不存取生產資料：

```bash
docker build -t ecoku:distroless-migration .
sh scripts/verify-image.sh ecoku:distroless-migration
previous=ghcr.io/dejavumoe/ecoku:v0.5.7@sha256:81962c68bf134c0d9fcbc9b5bc0c189b6c886f0f2e5a81fc5fed91b0f8bac847
docker pull "$previous"
sh scripts/verify-image.sh ecoku:distroless-migration "$previous"
```

腳本檢查非 root、唯讀根檔案系統、憑證、時區、靜態資源、管理員登入及安全停止；第二次執行在 v0.5.7 中產生臨時評論與加密通知憑據，升級後新增評論，再回滾並比對原資料、schema 和持久金鑰。結束時刪除自建容器、卷和臨時目錄。根 Compose 已更新至 v0.6.1 並使用內建二進位 healthcheck 探針；本地建置候選映像檔驗證時同樣使用新探針。

## 文件流程圖 {#documentation-diagrams}

「簡介」和「反向代理」中的流程圖使用 `docs/public/diagrams/` 下的本地 SVG，不在建置時或瀏覽器中執行 Mermaid。檔名由圖名、語言和 `light` / `dark` 組成；兩種主題使用相同的節點、連線和畫布尺寸，由頁面主題切換顯示。

修改圖表時，編輯或重新匯出對應的 SVG，並同步三種語言、明暗版本及 Markdown 中的替代文字。保持 SVG 自包含，不引用外部字型、圖片或指令碼。透過 `pnpm docs:dev` 檢查標籤、連線、主題切換，以及窄螢幕下用鍵盤或觸控橫向捲動的效果。

`node docs/.vitepress/diagrams.test.mjs` 檢查六個頁面的資源引用、替代文字和明暗版本一致性，也會拒絕遺留的 Mermaid 程式碼區塊；該檢查包含在文件建置中。
