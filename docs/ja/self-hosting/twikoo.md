# Twikoo 取り込み

Ecoku には、Twikoo からエクスポートした JSON データを移行するための CLI ツールが付属しています。
> [!IMPORTANT]
> **初期デプロイ直後のみ対応**：
> Twikoo コメント取り込みコマンド（`import-twikoo`）は、**管理画面で登録済みかつコメント数が 0 件の初期ターゲットサイトに対してのみ実行可能**です。
> ターゲットサイトに既に新しいコメントが 1 件でも投稿されている場合、ツリー構造・親子参照整合性・コメント ID の連続性を保護するため、システムは**インポートを厳格に拒否**します。

---

## 前提条件
- 対象サイトは登録済みで、コメント数が **0 件** であること。
- 通知メールや Telegram 通知は一切送信されません。

---

## 実行方法

```bash
cd ~/Ecoku

# 1. ドライラン（検証）
sudo docker compose run --rm --no-deps ecoku \
  import-twikoo \
  --site=blog \
  --file=/data/twikoo.json \
  --dry-run

# 2. 本番取り込み
sudo docker compose run --rm --no-deps ecoku \
  import-twikoo \
  --site=blog \
  --file=/data/twikoo.json

# 3. ファイルの削除とサービス起動
rm -f ~/Ecoku/data/twikoo.json
sudo docker compose up -d
```
