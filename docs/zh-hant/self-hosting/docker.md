# Docker 部署

Ecoku 採用單容器 Docker Compose 部署模型，以極小資源開銷提供全套服務。容器在內部監聽 `127.0.0.1:12123`，公網 HTTPS 由宿主機反向代理（Caddy / Nginx）終止。

> [!NOTE]
> 文件中的 `git.via.moe/dejavu/ecoku:v0.2.1` 為目前正式映像檔；`ecoku.example.com` 均為範例預留位置，實際部署時請替換為您的真實網域名稱。

---

## 1. 準備目錄與權限

Ecoku 容器採用非 root 使用者 `10001:10001` 運行，以唯讀根檔案系統啟動。主流 Linux 環境下可使用 `sudo install -d` 一步建立目錄並配置容器所需的所有者與權限：

```bash
# 進入部署根目錄
mkdir -p ~/Ecoku && cd ~/Ecoku

# 一步建立 logs 與 data 目錄並配置 UID/GID 10001 與 750 權限
sudo install -d -o 10001 -g 10001 -m 750 app/logs data
```

---

## 2. 編寫 Compose 配置

使用 `cat <<'EOF'` 寫入 `compose.yaml`：

```bash
cd ~/Ecoku

cat <<'EOF' > compose.yaml
services:
  ecoku:
    image: "git.via.moe/dejavu/ecoku:v0.2.1"
    init: true
    restart: unless-stopped
    container_name: ecoku
    env_file:
      - ./ecoku.env
    ports:
      # 僅綁定宿主機本地回環位址，嚴禁直接暴露 0.0.0.0
      - "127.0.0.1:12123:12123"
    volumes:
      - ./app/config.yaml:/app/config.yaml:ro
      - ./app/logs:/var/log/ecoku
      - ./data:/data
    deploy:
      resources:
        limits:
          memory: 384M
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"
    read_only: true
    tmpfs:
      - /tmp:rw,noexec,nosuid,nodev,size=16m
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--output-document=-", "http://127.0.0.1:12123/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    stop_grace_period: 30s
EOF
```

> [!IMPORTANT]
> - 生產環境**嚴禁**使用 `latest` 等浮動標籤，必須明確指定具體的語意化版本號（如 `v0.2.1`）。
> - 容器埠口請務必綁定到 `127.0.0.1:12123`，防止繞過反向代理直接存取裸埠口。

---

## 3. 設定檔 `app/config.yaml`

使用 `cat <<'EOF'` 產生設定檔，並設定容器唯讀權限：

```bash
cd ~/Ecoku

cat <<'EOF' > app/config.yaml
site:
  port: 12123
  # 日誌始終輸出到 stdout；指定普通檔案路徑時，處理程序內額外輪轉儲存日誌檔案
  log_path: "/var/log/ecoku/ecoku.log"
  # 信任的反代 IP 或 CIDR。生產若透過 Caddy 反代，填入 Docker 容器閘道 (如 172.18.0.1/32)
  # 為空表示所有訪客共用一個全域限流桶。嚴禁配置 0.0.0.0/0
  trusted_proxies: []

client:
  static_dir: "/app/client"

rate_limit:
  window_seconds: 60
  comment_submit: 5      # 評論提交頻控（次/窗口）
  comment_list: 60       # 評論讀取頻控（次/窗口）
  comment_delete: 30     # 評論刪除頻控
  admin_login: 5         # 管理員登入頻控
  notification_test: 5   # 通知測試發送頻控

notifications:
  # 資料庫敏感欄位加密主金鑰對應的環境變數名稱
  encryption_key_env: "ECOKU_NOTIFICATION_ENCRYPTION_KEY"
  # 實例對外公網規範 URL（用於拼裝郵件中的回覆連結）
  instance_public_url: "https://ecoku.example.com"

database:
  sqlite:
    path: "/data/ecoku.sqlite3"

admin:
  enabled: true
  static_dir: "/app/admin"
  username_env: "ECOKU_ADMIN_USERNAME"
  password_hash_env: "ECOKU_ADMIN_PASSWORD_HASH"
  token_key_env: "ECOKU_ADMIN_TOKEN_KEY"
  token_ttl_minutes: 480 # 管理員會話有效期 8 小時
  allowed_origins:
    # 允許存取管理後台的精確 Origin
    - "https://ecoku.example.com"
EOF

# 設定所屬權與權限，確保容器內非 root 使用者 (10001) 擁有唯讀權限
sudo chown 10001:10001 app/config.yaml
sudo chmod 640 app/config.yaml
```

---

## 4. 環境變數與金鑰產生 `ecoku.env`

建立 `ecoku.env` 檔案。可透過下列命令自動產生高強度隨基金鑰並追加至環境變數中。

該流程具備**等冪性**：各項目若已存在會自動跳過，重複執行不會覆蓋；隨基金鑰在終端機**無須回顯**；密碼雜湊採用互動式不可見輸入產生；環境變數值若帶有特殊符號（如 bcrypt 中的 `$` 及 base64 中的字元）均自動以單引號包覆，防止被 shell 或 Compose 錯誤插值：

```bash
cd ~/Ecoku

# 1. 建立敏感環境變數檔案並賦予安全權限（僅目前使用者可讀寫）
touch ecoku.env
chmod 600 ecoku.env

# 2. 寫入通用預設變數（已存在則自動跳過）
grep -q "^GIN_MODE=" ecoku.env || echo "GIN_MODE='release'" >> ecoku.env
grep -q "^TZ=" ecoku.env || echo "TZ='Asia/Shanghai'" >> ecoku.env
grep -q "^ECOKU_ADMIN_USERNAME=" ecoku.env || echo "ECOKU_ADMIN_USERNAME='admin'" >> ecoku.env

# 3. 互動式輸入管理員密碼，產生 Bcrypt 雜湊並寫入（密碼輸入不回顯，已存在則自動跳過）
if ! grep -q "^ECOKU_ADMIN_PASSWORD_HASH=" ecoku.env; then
  read -rsp '輸入管理員密碼: ' ADMIN_PASS; echo
  HASH=$(printf '%s\n' "$ADMIN_PASS" | sudo docker run --rm -i --entrypoint /app/ecoku-server "git.via.moe/dejavu/ecoku:v0.2.1" hash-password)
  unset ADMIN_PASS
  echo "ECOKU_ADMIN_PASSWORD_HASH='$HASH'" >> ecoku.env
fi

# 4. 自動產生 64 位元十六進位管理員 Token 簽章金鑰（無終端機回顯，已存在則自動跳過）
if ! grep -q "^ECOKU_ADMIN_TOKEN_KEY=" ecoku.env; then
  echo "ECOKU_ADMIN_TOKEN_KEY='$(openssl rand -hex 32)'" >> ecoku.env
fi

# 5. 自動產生 32 位元組 Base64 主加密金鑰（用於通知與驗證碼憑據加密，無終端機回顯，已存在則自動跳過）
if ! grep -q "^ECOKU_NOTIFICATION_ENCRYPTION_KEY=" ecoku.env; then
  echo "ECOKU_NOTIFICATION_ENCRYPTION_KEY='$(openssl rand -base64 32)'" >> ecoku.env
fi
```

---

## 5. 啟動與驗證

```bash
cd ~/Ecoku

# 驗證 Compose 配置語法
sudo docker compose config --quiet

# 拉取映像檔並後台啟動
sudo docker compose pull
sudo docker compose up -d

# 檢查容器狀態與執行日誌
sudo docker compose ps
sudo docker compose logs --tail=100 -f ecoku
```

### 健康檢查驗證

```bash
curl -fail http://127.0.0.1:12123/api/health
# 預期輸出: {"code":200,"message":"success","data":{"status":"healthy","timestamp":...}}
```

接下來，請配置前端 [反向代理](/zh-hant/self-hosting/reverse-proxy) 終止 HTTPS 並完成公網轉發，或造訪 [管理後台配置](/zh-hant/self-hosting/admin) 註冊站點與博主身分。

---

## 6. 歷史評論匯入（可選）

如果您之前使用的是 Twikoo 評論系統，可以在目前實例完成全新部署後，將原有歷史評論遷移至 Ecoku。

> [!IMPORTANT]
> - **僅限全新初始部署階段**：Twikoo 評論匯入命令（`import-twikoo`）**僅支援匯入到已註冊且零評論的目標站點**。
> - 若目標站點已有新評論寫入，系統為確保樹狀階層關係、父子引用約束與評論 ID 連續性，將**嚴格拒絕匯入**。
> - 詳細匯入步驟、脫敏預檢與欄位對齊說明，請參閱 [Twikoo 評論匯入](/zh-hant/self-hosting/twikoo)。
