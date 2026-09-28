# 命令列

映像檔的進入點程式是 `/app/ecoku-server`。不帶參數時啟動服務；帶下面的子指令時，執行一次性工作後結束。

在部署目錄中，用 `docker compose run` 以相同的設定和掛載執行子指令：

```bash
cd ~/Ecoku
sudo docker compose run --rm --no-deps ecoku <子命令> [参数]
```

除了 `hash-password` 之外，子指令都會讀取 `app/config.yaml` 並開啟資料庫；如果資料庫版本低於目前的映像檔，還會先執行遷移。請先用 `sudo docker compose down` 停止服務再執行，避免與正在執行的實例同時寫入資料庫。

## hash-password {#hash-password}

從標準輸入讀取一行密碼，輸出 bcrypt 雜湊（cost 10），用於 `ECOKU_ADMIN_PASSWORD_HASH`。不讀取設定，也不存取資料庫，服務執行中也可以使用。

```bash
read -rsp '管理员密码: ' P; echo
printf '%s\n' "$P" | sudo docker run --rm -i git.via.moe/dejavu/ecoku:v0.2.6 hash-password
unset P
```

密碼不能為空，UTF-8 編碼不能超過 72 位元組（bcrypt 的上限），超過時指令會報錯並結束。

把輸出寫進 `ecoku.env` 時請加上單引號：

```bash
ECOKU_ADMIN_PASSWORD_HASH='$2a$10$...'
```

然後重建容器使其生效。

## captcha status

顯示目前的人機驗證設定：

```bash
sudo docker compose run --rm --no-deps ecoku captcha status
```

輸出一行，例如：

```text
provider=turnstile turnstile_secret_set=true cap_secret_set=false
```

## captcha disable {#captcha-disable}

關閉人機驗證。用於驗證服務設定錯誤、導致管理員無法登入後台的情況。

```bash
sudo docker compose down
sudo docker compose run --rm --no-deps ecoku captcha disable
sudo docker compose up -d
```

已儲存的 Turnstile 與 Cap 設定和金鑰都會保留，登入後台後可以直接在「安全」頁修正並重新啟用。如果已經是關閉狀態，會輸出 `CAPTCHA 已处于关闭状态`，不做任何修改。

## import-twikoo

把 Twikoo 匯出的 JSON 匯入到一個沒有任何評論的站點。

```bash
sudo docker compose run --rm --no-deps ecoku \
  import-twikoo --site=blog --file=/data/twikoo.json [--dry-run]
```

| 參數 | 說明 |
| --- | --- |
| `--site` | 目標站點 ID，必須已在後台註冊，且沒有任何評論（包括已刪除的）。 |
| `--file` | 容器內的匯出檔案路徑。檔案需要先放進 `data/` 目錄，容器內的路徑為 `/data/...`。 |
| `--dry-run` | 完整執行一遍匯入後回滾，只輸出統計，不保存評論。 |

成功時輸出統計。預檢顯示「预检通过」，正式匯入顯示「完成」：

```text
Twikoo 导入预检通过：评论=128 根评论=90 回复=38 页面=24 邮箱=110 网站=45 缺失父记录=0
Twikoo 导入完成：评论=128 根评论=90 回复=38 页面=24 邮箱=110 网站=45 缺失父记录=0
```

完整步驟、欄位對應和注意事項見[從 Twikoo 遷移](../self-hosting/twikoo)。
