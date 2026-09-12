# よくある質問とトラブルシューティング

Ecoku の導入、運用、日常の管理で頻出する質問とトラブルの診断・解決策をまとめています。

---

## 1. 認証と権限に関するトラブル

### Q: 管理画面をリロードしたりブラウザを閉じたりすると再ログインが必要になるのはなぜですか？
**A**: これはセキュリティを最重視した Ecoku の意図的な**インメモリセッション設計**によるものです。管理者の Bearer トークンは Vue 実行時のメモリ内にのみ保持され、ブラウザの `localStorage`、`sessionStorage`、Cookie には一切永続化されません。タブを閉じたりリロードしたりするとトークンは即座に破棄されるため、共有端末や複数人で使用する PC でも認証情報漏洩のリスクがありません。

### Q: コンテナ起動時に `permission denied` や SQLite データベース読み書きエラーが発生する
**A**: Ecoku コンテナは非 root ユーザー `10001:10001` で動作します。ホスト側でデータディレクトリおよび設定ファイルの所有者権限を確認・修正してください：
```bash
sudo chown -R 10001:10001 ~/Ecoku/data ~/Ecoku/app/logs ~/Ecoku/app/config.yaml
sudo chmod 750 ~/Ecoku/data ~/Ecoku/app/logs
sudo chmod 640 ~/Ecoku/app/config.yaml
```

---

## 2. ボット対策（CAPTCHA）と緊急復旧

### Q: Turnstile や Cap の設定ミスにより管理画面にログインできなくなった場合はどうすればいいですか？
**A**: 公式の内蔵 CLI 復旧コマンドを使用して、オフラインで CAPTCHA を強制無効化してください：
```bash
sudo docker compose down
sudo docker compose run --rm --no-deps ecoku captcha disable
sudo docker compose up -d
```
起動後、管理者ユーザー名とパスワードで管理画面にログインし、CAPTCHA 設定を正しく修正して保存してください。

### Q: セルフホスト Cap 使用時にブラウザコンソールで CSP (Content Security Policy) エラーが出る
**A**: Ecoku は選択されたプロバイダーに応じて動的に最小限の CSP を生成します。Cap を利用する場合は以下を確認してください：
1. 管理画面のセキュリティ設定で、Cap の**インスタンスアドレスが `https://` で始まっていること**（ローカル開発時は `localhost` HTTP を許容）。
2. Cap の検証エンドポイント（`/<sitekey>/siteverify`）が同一の HTTPS ドメインで提供されていること。
3. Cap クライアントのプローブ（instrumentation）が有効な場合、Ecoku の CSP は必要な `'unsafe-eval'` および WASM 評価を自動的に許可します。

---

## 3. リバースプロキシとレート制限

### Q: 訪問者がコメントを投稿しようとすると頻繁に `429 Too Many Requests` が発生する
**A**: `trusted_proxies` が未設定のため、すべての訪問者が同一のリバースプロキシゲートウェイ IP（例: Docker ゲートウェイ `172.18.0.1`）からのアクセスとみなされ、単一のレート制限枠を全員で共有してしまっていることが原因です。
**解決策**：
1. Docker コンテナのゲートウェイ IP を確認：
   ```bash
   sudo docker inspect ecoku --format '{{range .NetworkSettings.Networks}}{{.Gateway}}{{"\n"}}{{end}}'
   ```
2. `app/config.yaml` の `site.trusted_proxies` にその IP を追加（例: `172.18.0.1/32`）。
3. Caddy または Nginx の設定で `{remote_host}` または `$remote_addr` を用いて `X-Forwarded-For` を**上書き**していることを確認。

---

## 4. メール通知とタイムゾーン

### Q: メール送信テストでタイムアウトやハンドシェイク失敗が発生する
**A**:
- Ecoku は暗号化通信を必須としており、ポート `465`（SSL/TLS 直接接続）または `587`（STARTTLS）のみをサポートします。**平文の 25 番ポートは使用できません**。
- クラウドプロバイダーのセキュリティグループで送信方向の 465 / 587 番ポートが許可されているか確認してください。
- `ecoku.env` の `ECOKU_NOTIFICATION_ENCRYPTION_KEY` が正しく設定されているか確認してください。マスター暗号化鍵が欠落または無効な場合、データベース内のパスワードを復号できません。

### Q: コメント欄の日時表示が現在の現地時間と一致しない
**A**:
- Ecoku の日時は `ecoku.env` の環境変数 `TZ` によって制御されます（例: `TZ=Asia/Tokyo` や `TZ=UTC`）。
- この値は Docker Compose 経由でコンテナに渡され、指定がない場合は `Asia/Shanghai` にフォールバックします。
- `ecoku.env` の `TZ` を変更し、`sudo docker compose restart` を実行すると即座に反映されます。
