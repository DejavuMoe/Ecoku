# Docker 部署

生產只支援 Docker Compose + SQLite3。以倉庫根 `compose.yaml` 和 `deploy/` 模板為準，不要為了「對齊文件」改埠或掛載。

## 前提

Linux、Docker Engine、Compose v2、OpenSSL，以及一個指向伺服器的 HTTPS 域名。鏡像使用精確 tag：

```text
git.via.moe/dejavu/ecoku:<VERSION>
```

不要使用 `latest`。建議在普通運維使用者目錄：

```bash
mkdir -p ~/Ecoku/app/logs ~/Ecoku/data ~/Ecoku/backups
cd ~/Ecoku
chmod 700 ./backups
```

```text
Ecoku/
├── app/
│   ├── config.yaml
│   └── logs/
├── backups/
├── compose.yaml
├── data/
└── ecoku.env
```

容器以 UID/GID `10001:10001` 運行。`data/` 保存資料庫與 WAL；升級時原樣保留。

## 複製模板

從你要部署的 Git tag 複製 `compose.yaml` 與 `deploy/config.yaml.example`。服務埠已綁到 `127.0.0.1:12123`，公網只應打到本機反代。保持三個綁定掛載：`./app/config.yaml`、`./app/logs`、`./data`，以及 `env_file: ./ecoku.env`。

`app/config.yaml` 只改公開網址和管理端來源：

```yaml
notifications:
  instance_public_url: "https://comments.example.com"

admin:
  allowed_origins:
    - "https://comments.example.com"
```

其餘與示例保持一致。限流預設使用容器看到的直接連接地址。需要按真實訪客限流時，見 [反向代理](/zh-hant/self-hosting/reverse-proxy)。

## 初始化管理員

密碼不會出現在命令參數、shell 歷史或日誌中：

```bash
ECOKU_IMAGE='git.via.moe/dejavu/ecoku:<VERSION>'

set +x
umask 077

read -rp 'Ecoku 管理员用户名: ' ECOKU_ADMIN_USERNAME
read -rsp '设置管理员密码（输入不会显示）: ' ECOKU_PASSWORD_FIRST
echo
read -rsp '再次输入管理员密码: ' ECOKU_PASSWORD_SECOND
echo

test -n "$ECOKU_ADMIN_USERNAME" || { echo '管理员用户名不能为空'; exit 1; }
test -n "$ECOKU_PASSWORD_FIRST" || { echo '管理员密码不能为空'; exit 1; }
test "$ECOKU_PASSWORD_FIRST" = "$ECOKU_PASSWORD_SECOND" || {
  echo '两次输入的密码不一致'
  unset ECOKU_PASSWORD_FIRST ECOKU_PASSWORD_SECOND
  exit 1
}

ECOKU_ADMIN_PASSWORD_HASH="$(
  printf '%s\n' "$ECOKU_PASSWORD_FIRST" |
    sudo docker run --rm -i --entrypoint /app/ecoku-server \
      "$ECOKU_IMAGE" hash-password
)" || exit 1

ECOKU_ADMIN_TOKEN_KEY="$(openssl rand -hex 32)"
ECOKU_NOTIFICATION_ENCRYPTION_KEY="$(openssl rand -base64 32)"

{
  printf "GIN_MODE='release'\n"
  printf "TZ='Asia/Shanghai'\n"
  printf "ECOKU_ADMIN_USERNAME='%s'\n" "$ECOKU_ADMIN_USERNAME"
  printf "ECOKU_ADMIN_PASSWORD_HASH='%s'\n" "$ECOKU_ADMIN_PASSWORD_HASH"
  printf "ECOKU_ADMIN_TOKEN_KEY='%s'\n" "$ECOKU_ADMIN_TOKEN_KEY"
  printf "ECOKU_NOTIFICATION_ENCRYPTION_KEY='%s'\n" "$ECOKU_NOTIFICATION_ENCRYPTION_KEY"
} > ecoku.env

unset ECOKU_PASSWORD_FIRST ECOKU_PASSWORD_SECOND ECOKU_ADMIN_PASSWORD_HASH
unset ECOKU_ADMIN_TOKEN_KEY ECOKU_NOTIFICATION_ENCRYPTION_KEY ECOKU_IMAGE
```

`TZ` 為 IANA 名稱，控制評論時間顯示，未設定時回退 `Asia/Shanghai`。不要把 `TZ` 寫進 `app/config.yaml`。單引號包裹環境值，避免 Compose 插值 bcrypt 裡的 `$`。

```bash
sudo chown "$USER":10001 ./app/config.yaml
sudo chmod 0640 ./app/config.yaml
sudo chown "$USER":"$USER" ./ecoku.env
sudo chmod 0600 ./ecoku.env
sudo chown -R 10001:10001 ./app/logs ./data
sudo chmod 0750 ./app/logs ./data
sudo docker compose config --quiet
```

## 啟動

```bash
sudo docker compose pull
sudo docker compose up -d
sudo docker compose ps
sudo docker compose logs --tail=100 ecoku

curl --fail http://127.0.0.1:12123/api/health
curl --fail --head http://127.0.0.1:12123/client/ecoku-loader.js
```

健康狀態必須為 `healthy`。空庫會按順序執行全部遷移；未知版本或校驗失敗會拒絕啟動。

日誌在 `sudo docker compose logs -f ecoku`。`log_path` 指向掛載檔案時，行程另寫一份並按約 10MB / 5 份 / 28 天輪轉。不要用 `GIN_MODE=debug` 替代造訪日誌。日誌不含 IP、UA、憑據或評論正文。

`/api/health` 只表示行程可響應，不證明資料庫或遷移已完成。

接下來配置 [反向代理](/zh-hant/self-hosting/reverse-proxy)，然後在 [後台](/zh-hant/self-hosting/admin) 建立站點。
