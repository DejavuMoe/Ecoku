# 本機開發

生產以 Docker Compose 為準。本地用 SQLite 檔案與 `server/config.yaml`，不依賴容器。

## 前提

- Go 1.26+（與 CI 一致）
- Node.js 20.19+ / 22.12+ / 24+ 與 pnpm 11.3+
- 可選：[air](https://github.com/air-verse/air)

```bash
pnpm install --frozen-lockfile
cp server/config.yaml.example server/config.yaml
mkdir -p server/data
```

按需編輯 `server/config.yaml`：`client.static_dir` / `admin.static_dir` 指向對應 `dist`；啟用管理端時 `admin.enabled: true`；`admin.allowed_origins` 含管理端 dev 地址（預設 `http://localhost:5173`）；站點 `allowed_origins` 含評論區預覽（預設 `http://localhost:3000`）。

## 環境變量

在 `server/` 下導出（bash）：

```bash
export ECOKU_ADMIN_USERNAME="dev-admin"
export ECOKU_ADMIN_PASSWORD_HASH="<bcrypt 哈希>"
export ECOKU_ADMIN_TOKEN_KEY="<至少 32 字节的随机十六进制>"
export ECOKU_NOTIFICATION_ENCRYPTION_KEY="<Base64 编码的 32 字节密钥>"
```

```bash
printf 'your-password\n' | go run ./server hash-password
openssl rand -hex 32
openssl rand -base64 32
```

## 啟動

```bash
pnpm -C packages/client build
pnpm -C packages/admin build
cd server && go run .
# 或：air
```

預設 `http://127.0.0.1:12123`。空庫首次啟動會跑完全部遷移；刪除 `server/data/` 可重置。

評論區：`pnpm -C packages/client dev`（`http://localhost:3000`）。

管理端：

```bash
export ECOKU_ADMIN_DEV_API_URL="http://127.0.0.1:12123"
pnpm -C packages/admin dev
```

Vite 把 `/api` 代理到該地址。文件站點：`pnpm docs:dev`。

日常驗證交給 Woodpecker。本地只在 CI 未覆蓋處補充：`pnpm -C packages/<pkg> test`、`go test -count=1 ./...`、已批准原型的 `designs/**/*.test.mjs`。
