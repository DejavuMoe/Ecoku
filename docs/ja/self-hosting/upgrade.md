# アップグレードと移行

Ecoku は順序付けられたインプレース SQLite スキーママイグレーションを採用しています。

**[v0.1.9](./upgrades/v0.1.9)** への更新準備では、コミットの CI 成功とイメージ公開を先に確認してください。v0.1.8 からは schema v7 のままで、公開読み取りの処理上限と頻度制限が変わります。v0.1.8 に戻す前に、追加した `rate_limit.comment_list` を削除してください。SDK の動作と復元手順はバージョン別ガイドを参照してください。

---

## 手順

1. 対象バージョンのリリースノートを確認し、コールドバックアップを取得。
2. `compose.yaml` の正確なイメージタグを変更（例: `v0.1.8`）。
3. イメージを pull して再起動：
   ```bash
   sudo docker compose pull
   sudo docker compose up -d
   sudo docker compose logs --tail=100 -f ecoku
   curl -f http://127.0.0.1:12123/api/health
   ```

---

## スキーマの変遷

| イメージバージョン | スキーマ | 主な変更点 |
| :--- | :---: | :--- |
| `v0.1.0`〜`v0.1.2` | `v4` | 基本テーブル構成、Turnstile 設定。 |
| `v0.1.3`〜`v0.1.4` | `v5` | `sites.blogger_passphrase_hash`、`comments.is_blogger`、Outbox 分割。 |
| `v0.1.5`〜`v0.1.7` | `v6` | `captcha_settings` に変更し、Cap をサポート。 |
| `v0.1.8` | `v7` | Smoji スタンプ対応。 |
| `v0.1.9` | `v7` | 新規移行なし。公開読み取り上限、ページング、頻度制限、SQLite 再接続時の安全設定。 |

---

## バージョン別移行ガイド

- [v0.1.9](./upgrades/v0.1.9)：2026-08-31。CWE-400 修正と互換性の注意事項
- [v0.1.8](./upgrades/v0.1.8)
- [v0.1.7](./upgrades/v0.1.7)
- [v0.1.6](./upgrades/v0.1.6)
- [v0.1.5](./upgrades/v0.1.5)
- [v0.1.4](./upgrades/v0.1.4)
- [v0.1.3](./upgrades/v0.1.3)
- [v0.1.2](./upgrades/v0.1.2)
- [v0.1.1](./upgrades/v0.1.1)
- [v0.1.0](./upgrades/v0.1.0)
- [以前のバージョン](./upgrades/earlier)
