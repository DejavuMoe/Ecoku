# よくある質問とトラブルシューティング

Ecoku の導入、運用、日常の管理で頻出する質問とトラブルの診断・解決策をまとめています。

---

## 1. 認証と権限に関するトラブル

### Q: 再読み込みやブラウザを開き直してもログインは維持されますか？

管理者セッションは HttpOnly Cookie を使用し、SQLite には認証情報のダイジェストと有効期限のみ保存します。ログインから固定 8 時間で失効し、再読み込みやブラウザを開き直しても有効なセッションを復元します。期限は延長しません。ログアウトはサーバーで現在のセッションを失効させ、失敗時は画面を維持して再試行を案内します。認証情報は JavaScript、localStorage、sessionStorage、URL に保存しません。

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
- Ecoku は `tls` または `starttls` のみを受け付けます。ポートはメール事業者の指定に従ってください（一般的には 465 / 587）。平文 SMTP は非対応です。
- ファイアウォールとクラウドのセキュリティグループで、設定した SMTP ポートへの送信を許可してください。
- `ecoku.env` の `ECOKU_NOTIFICATION_ENCRYPTION_KEY` が正しく設定されているか確認してください。マスター暗号化鍵が欠落または無効な場合、データベース内のパスワードを復号できません。

### Q: コメント欄の日時表示が現在の現地時間と一致しない
**A**:
- Ecoku の日時は `ecoku.env` の環境変数 `TZ` によって制御されます（例: `TZ=Asia/Tokyo` や `TZ=UTC`）。
- この値は Docker Compose 経由でコンテナに渡され、指定がない場合は `Asia/Shanghai` にフォールバックします。
- `ecoku.env` の `TZ` を変更後、`sudo docker compose up -d --force-recreate ecoku` でコンテナを再作成して新しい環境変数を読み込みます。`restart` では環境変数は更新されません。[Docker Compose restart の説明](https://docs.docker.com/reference/cli/docker/compose/restart/)も参照してください。

---

## 5. ドキュメントサイトの CI デプロイ

### Q: ドキュメントの公開ディレクトリはどう設定しますか？

リポジトリの `.woodpecker/docs-deploy.yml` は `master` への push 時に、ドキュメントサーバーの agent で独立してビルド・公開します。公開コンテナには `/var/www/<DOCS_DOMAIN>:/deploy` のみをマウントします。このパスは実ディレクトリとし、Web サーバーの公開ルートを `/var/www/<DOCS_DOMAIN>/html` に設定してください。

Nginx はリポジトリの `deploy/nginx-docs.conf.example` を参考に、ドメインと TLS snippet のプレースホルダーを置き換えてください。旧ディレクトリ構成から移行する場合は `root` パスに `/html` を追加してください。このサイトでは VitePress の `cleanUrls: true` を使用するため、`location /` に `try_files $uri $uri.html $uri/ =404;` を設定し、`/self-hosting/docker` などの拡張子なしのパスを生成済みの `.html` ファイルに対応させます。設定しない場合、直接アクセスや再読み込みで 404 になります。`sudo nginx -t && sudo systemctl reload nginx` で反映します。

```text
/var/www/<DOCS_DOMAIN>/
├── .deploy.lock
├── html -> releases/<commit>-<pipeline>-<rerun>
└── releases/
    └── <commit>-<pipeline>-<rerun>/
```

スクリプトは成果物を検証し、ロック取得後に `html` をアトミックに置換します。古いパイプラインによる新しいバージョンの上書きを防ぎます。切り替えの検証後は現在と直前のバージョンだけを保持し、それ以前のリリースを削除します。失敗または古い公開ジョブでは削除しません。初回は1つ、以降は通常2つを保持し、直前のバージョンへ手動でロールバックできます。削除に失敗した場合は警告を出します。検証対象はローカルファイルとシンボリックリンクで、公開 HTTP のヘルスチェックは含みません。

旧構成から移行する際は、実行中または待機中の公開ジョブがないことを確認し、旧 `/var/www/<DOCS_DOMAIN>` シンボリックリンクを削除して同名の実ディレクトリを作成し、Web サーバーの公開ルートを変更します。旧 `/var/www/.<DOCS_DOMAIN>-releases` を削除する場合は、静的ファイルを残す必要がないことを確認してください。旧公開物を削除すると、新 CI の公開成功と Web 設定の反映までドキュメントサイトは利用できません。コメントサービスとデータベースには影響しません。準備後に新版 CI を push し、旧版の公開ジョブは再実行しないでください。

ローカルの隔離検証には `sh scripts/test-publish-docs.sh` を使用します。`DOCS_DEPLOY_ROOT` はスクリプトの既定値 `/deploy` を変更し、旧 `DOCS_DEPLOY_PARENT` / `DOCS_DEPLOY_SITE` を置き換えます。Ecoku アプリケーションの環境変数ではありません。
