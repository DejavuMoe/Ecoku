# 管理画面

インスタンスの `/admin/` を開き、`ECOKU_ADMIN_USERNAME` と対応するパスワードでログインします。管理用 Bearer token は現在のページのメモリにだけあり、閉じたり再読み込みすると再ログインが必要です。

`admin.allowed_origins` はコメントサイトのオリジンとは別です。広い 1 つのオリジンで代用しないでください。

## サイト

| 設定 | 説明 |
| --- | --- |
| ID | 組み込み用の一意な値。作成後は変更不可 |
| サイト URL・名称 | サイトの識別と通知リンクの組み立て |
| Allowed origins | コメント API を呼べる正確な Origin（完全な `https://ドメイン`、パスなし） |
| メール・ウェブサイト | 訪問者フィールドが**必須**かどうか（フィールド自体は表示される） |
| プレースホルダ、長さ上限、空状態、並び順 | フォームと一覧の挙動 |

コメントは投稿後すぐに公開され、審査キューはありません。

### スタンプ

サイトごとにスタンプを有効化し、1 つの `smoji.json` マニフェスト URL を設定できます。本番 URL は HTTPS が必須で、画像はマニフェストと同一オリジンでなければなりません。Ecoku は素材を同梱・プロキシせず、訪問者が初めてピッカーを開いた時だけ動的に読み込みます。直リンク画像は素材ホストに訪問者の IP を伝える可能性があるため、信頼できるホストを使用してください。無効化後も URL は保持され、過去のマーカーはプレーンテキストで表示されます。

management key（YAML で宣言した場合）は、そのサイトの墓碑削除など信頼できるサーバー側操作用であり、ブラウザ組み込み設定ではありません。詳しくは [Docker 導入](./docker#設定)。

## ブロガー身元

ニックネームとメールは両方入力するか、両方空にしてください。有効時は 12–80 文字のパスフレーズも設定します。保存後、その身元に合う過去コメントのブロガー印が埋め戻されます。公開バッジ文言は設定できます。

公開側：パスフレーズ有効時、ブロガーはニックネーム欄にパスフレーズだけ入れればよく、メールやサイトは不要です。パスフレーズが誤りで訪問者身元も埋まっている場合は、通常の訪問者として投稿されます。

## 通知

インスタンス単位の SMTP（TLS / STARTTLS のみ）と Telegram。資格情報は `ECOKU_NOTIFICATION_ENCRYPTION_KEY` で暗号化して SQLite に保存します。管理画面は「設定済み」とだけ示し、判定表やテンプレートプレビューはありません。チャネルを有効にする前に `notifications.instance_public_url` を設定してください。

既定ルール（保存された `is_blogger` 基準）：

| 場面 | 動作 |
| --- | --- |
| 訪問者がルートコメントを投稿 | ブロガーチャネルへ通知 |
| 訪問者が訪問者に返信 | ブロガーチャネルへ通知し、直接の親へメール |
| ブロガーが訪問者に返信 | 直接の親へメールのみ |
| 訪問者がブロガーに返信 | ブロガーチャネルのみ |
| ブロガーがブロガーに返信 | 通知なし |
| 同一メールが自分に返信 | 訪問者返信メールは送らない |

## ボット対策

「セキュリティ」ページでオフ、Cloudflare Turnstile、セルフホスト Cap のいずれか 1 つを選びます。有効時はコメント投稿と管理者ログインの両方を保護し、失敗時は拒否のみで別プロバイダへ自動切替しません。プロバイダ切替では未使用側の保存済み設定は消えません。

### Turnstile

Cloudflare で Widget を作り、Site key と Secret key を入れます。Pre-clearance はサイトが Cloudflare プロキシ経由であることが条件です。`cf_clearance` は Ecoku Siteverify の代わりになりません。

### Cap

Cap Standalone でキーを作り、管理画面 Origin とすべてのコメントサイト Origin をその Key の CORS に追加します。インスタンスは公開 HTTPS で `/assets/widget.js`、`/assets/cap_wasm_bg.wasm`、`/<sitekey>/siteverify` を提供する必要があります。Ecoku にはインスタンス URL、Site key、Secret key を入力します。

管理画面 CSP は現在のプロバイダに合わせて絞られます。Turnstile は Cloudflare、Cap はインスタンス Origin・WASM・Blob Worker を許可。Cap instrumentation には `'unsafe-eval'` が必要な場合があります。受け入れられない場合は instrumentation をオフにするか Turnstile に切り替えてください。

## 検証でログインできないときの復旧

```bash
sudo docker compose down
sudo docker compose run --rm --no-deps ecoku captcha status
sudo docker compose run --rm --no-deps ecoku captcha disable
sudo docker compose up -d
```

ログイン後に検証設定を直し、管理画面で再度有効にしてください。
