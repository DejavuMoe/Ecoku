# 命令列

映像檔裡的程式是 `/app/ecoku-server`。不帶參數時啟動服務，帶子命令時執行一次性工作後結束。

在部署目錄裡用 `docker compose run`，子命令會使用和服務相同的設定和掛載：

```bash
cd ~/Ecoku
sudo docker compose run --rm --no-deps ecoku <子命令> [参数]
```

::: warning
子命令名稱寫錯時不會報錯，而是照常啟動服務。執行前核對拼寫。
:::

會寫入資料庫的子命令（`admin reset-password`、`captcha disable`、`import-twikoo`），先用 `sudo docker compose stop ecoku` 停掉服務再執行。

除 `healthcheck` 和 `hash-password` 外，子命令都會開啟資料庫。開啟時如果資料庫版本較舊，會先執行遷移，也會做和服務啟動時相同的 [來源檢查](./configuration#reload)。所以剛換了新映像檔、還沒升級資料庫時，先停服冷備份再執行任何子命令。

## healthcheck {#healthcheck}

檢查正在執行的服務是否回應，Compose 的健康檢查用的就是它。v0.6.0 起提供。手動執行：

```bash
sudo docker compose exec -T ecoku /app/ecoku-server healthcheck
```

它請求 `http://127.0.0.1:12123/api/health`，2 秒逾時，回傳 200 時結束碼為 0，否則為 1，成功時沒有輸出。容器內連接埠不是 12123 時加上 `--port=連接埠`。

要用 `exec` 在正在執行的容器裡執行。用 `run` 新開的容器裡沒有執行中的服務，檢查必然失敗。

## admin reset-password {#admin-reset-password}

為管理員帳戶產生一個新的臨時密碼，用於第一次登入或忘記密碼。新實例要先啟動過一次，帳戶才存在。

```bash
(
set -eu
cd ~/Ecoku
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku admin reset-password
sudo docker compose up -d --wait --wait-timeout 120
)
```

命令輸出 `管理员临时密码：…`，同時讓所有已登入的工作階段失效。使用者名稱不變。用臨時密碼登入後，需要重新設定正式密碼，也可以順便修改使用者名稱。

臨時密碼只出現在這次命令的終端輸出裡，`docker compose logs` 裡沒有。提示 `管理员账户尚未初始化` 時，見 [Docker 部署](../self-hosting/docker#temporary-password)。

## captcha status

顯示目前的人機驗證設定，服務執行時也可以執行：

```bash
sudo docker compose run --rm --no-deps ecoku captcha status
```

輸出一行，例如：

```text
provider=turnstile turnstile_secret_set=true cap_secret_set=false
```

## captcha disable {#captcha-disable}

關閉人機驗證。驗證服務出問題、你登不進後台時用它。

```bash
(
set -eu
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku captcha disable
sudo docker compose up -d --wait --wait-timeout 120 ecoku
)
```

已儲存的 Turnstile 和 Cap 設定都會保留，登入後在「安全」頁修好再啟用。已經是關閉狀態時輸出 `CAPTCHA 已处于关闭状态`。

## import-twikoo

把 Twikoo 的 JSON 匯出匯入到一個還沒有評論的站點。完整步驟見 [從 Twikoo 遷移](../self-hosting/twikoo)。

先加 `--dry-run` 預先檢查：

```bash
(
set -eu
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku \
  import-twikoo --site=blog --file=/data/twikoo.json --dry-run
)
```

確認結果後，去掉 `--dry-run` 正式匯入：

```bash
(
set -eu
sudo docker compose stop ecoku
sudo docker compose run --rm --no-deps ecoku \
  import-twikoo --site=blog --file=/data/twikoo.json
sudo docker compose up -d --wait --wait-timeout 120 ecoku
)
```

| 參數 | 說明 |
| --- | --- |
| `--site` | 目標站點 ID，必須已在後台註冊且沒有任何評論（包括已刪除的）。 |
| `--file` | 容器內的檔案路徑。把檔案放進 `data/` 目錄，容器裡的路徑就是 `/data/...`。 |
| `--dry-run` | 完整執行一遍後回滾，只輸出統計，不儲存。 |

成功時最後一行是統計結果：

```text
Twikoo 导入预检通过：评论=128 根评论=90 回复=38 页面=24 邮箱=110 网站=45 缺失父记录=0
Twikoo 导入完成：评论=128 根评论=90 回复=38 页面=24 邮箱=110 网站=45 缺失父记录=0
```

::: details 內測設定：密碼雜湊

## hash-password {#hash-password}

從標準輸入讀取一行密碼，輸出 bcrypt 雜湊（cost 10），只用於仍透過 `ECOKU_ADMIN_PASSWORD_HASH` 注入管理員的舊實例。新實例用不到它。

```bash
read -rsp '管理员密码: ' P; echo
printf '%s\n' "$P" | sudo docker run --rm -i ghcr.io/dejavumoe/ecoku:v0.6.4 hash-password
unset P
```

密碼不能為空，UTF-8 編碼不能超過 72 位元組（bcrypt 的上限），超過時命令報錯並結束。

把輸出寫進 `ecoku.env` 時請加上單引號：

```bash
ECOKU_ADMIN_PASSWORD_HASH='$2a$10$...'
```

然後重建容器使其生效。

:::
