# Twikoo 取り込み

Ecoku には、Twikoo からエクスポートした JSON データを移行するための CLI ツールが付属しています。

---

## 前提条件
- 対象サイトは登録済みで、コメント数が **0 件** であること。
- 通知メールや Telegram 通知は一切送信されません。

---

## 実行方法

```bash
# 1. ドライラン（検証）
sudo docker compose run --rm --no-deps ecoku \
  ecoku-server import-twikoo \
  --site-id=blog \
  --file=/data/twikoo.json \
  --dry-run

# 2. 本番取り込み
sudo docker compose run --rm --no-deps ecoku \
  ecoku-server import-twikoo \
  --site-id=blog \
  --file=/data/twikoo.json

# 3. ファイルの削除とサービス起動
rm -f ~/Ecoku/data/twikoo.json
sudo docker compose up -d
```
