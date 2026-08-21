# 管理画面

`https://comments.example.com/admin/` を、初期化時の管理者で開きます。トークンはページメモリのみ。再読み込みで再ログイン。管理オリジンと公開コメントオリジンは別の許可リストです。

## サイト

| 項目 | 内容 |
| --- | --- |
| サイト ID | 短く安定。作成後は変更不可 |
| サイト URL | 例 `https://blog.example.com`。通知の原文リンクはこの URL と page key から組み立て |
| 名前 | 空なら URL のホスト |
| 許可オリジン | 1 行に Origin 1 つ |
| 既定の並び | `newest` または `oldest` |
| メール / サイト | 必須フラグ。既定はメール必須、サイト任意 |
| プレースホルダ | 最大 80 字 |
| 本文上限 | Unicode code point 1–10000、既定 1000 |
| 空状態 | フォーム下にプレーンテキストで表示 |

コメントは送信と同時に公開。management key は信頼できるサーバ自動化が所属サイトを墓碑削除する用途のみ。新規サイトでは UI に鍵を出しません。そのキーでの一覧/詳細 GET は 403 です。

## ブロガー

ニックネームとメールは両方入れるか両方空。有効化にはパスフレーズ（12–80 文字）が必要。保存は bcrypt のみ。

公開フォームではニックネーム欄にパスフレーズ。サーバが設定ニックネーム・非公開メール・サイト URL に書き換えます。パスフレーズが誤りで訪問者身元もある場合は訪問者として公開。

パスフレーズ保存時、ニックネーム完全一致・メール大小無視で履歴の `is_blogger` を埋めます。

## 通知

インスタンス単位。SMTP、訪問者返信メール、Telegram。テスト送信は別レート制限。SMTP は `tls` / `starttls` のみ。秘密は `ECOKU_NOTIFICATION_ENCRYPTION_KEY`。判定表やテンプレートプレビューは出しません。マトリクスは [機能](/ja/guide/features#通知)。

## ボット対策

セキュリティ頁：オフ / Turnstile / Cap。有効時は一方のみ。コメント送信と管理者ログインの両方。切替で他方の保存設定は消しません。失敗はクローズ。自動降格なし。

### Turnstile

1. Cloudflare でウィジェットを作り、管理ホストと全コメントサイトのホスト名を追加。
2. 管理画面で Turnstile を選び Sitekey / Secret を保存。
3. ウィジェットモードは Cloudflare 側のみ。

Pre-clearance も Cloudflare のみ。プロキシ配下でないなら切ります。コンソールに `aborting clearance redemption` が出ます。

### Cap

Cap の `ADMIN_KEY` は Cap 自身の管理用であり、Ecoku には入れません。

1. Key を作り instrumentation を維持。管理 Origin と各コメント Origin をその Key の CORS に追加。
2. 公開 HTTPS。固定版の `/assets/widget.js` と `/assets/cap_wasm_bg.wasm`。
3. Cap を選び、インスタンス根、Site key、Secret。公開 HTTPS のみ。資格情報、query、fragment、localhost、私網 IP は不可。
4. 別ウィンドウでログインと投稿を確認。トークンは単回。

`v0.1.6` から、Cap が現在の方式のときだけ、その正確な Origin に `'unsafe-eval'` を足します。

`instr_timeout` かつ `/redeem` 429 なら、応答 CSP が現行イメージ由来か確認。Caddy に緩い第二 CSP を足して回避しないでください。

ホスト CSP は [FAQ](/ja/self-hosting/faq#ホスト-csp)。

## ログイン復旧

```bash
set -euo pipefail
cd ~/Ecoku

sudo docker compose down
sudo test ! -e ./data/ecoku.sqlite3-wal
sudo test ! -e ./data/ecoku.sqlite3-shm

umask 077
mkdir -p ./backups
backup_stamp="$(date +%Y%m%d-%H%M%S)"
sudo cp --reflink=auto --preserve=mode,timestamps \
  ./data/ecoku.sqlite3 "./backups/ecoku-before-captcha-disable-${backup_stamp}.sqlite3"
sudo chown "$USER":"$USER" "./backups/ecoku-before-captcha-disable-${backup_stamp}.sqlite3"
chmod 600 "./backups/ecoku-before-captcha-disable-${backup_stamp}.sqlite3"

sudo docker compose run --rm --no-deps ecoku captcha status
sudo docker compose run --rm --no-deps ecoku captcha disable
sudo docker compose up -d
```

CAPTCHA なしで入り、提供元を直して保存。現行の正確なイメージと同一の `./data` を使う。設定表を手で書き換えない。

## タイムゾーン

`TZ` は `ecoku.env` のみ。変更後はコンテナを作り直します。

```bash
printf "\nTZ='Asia/Singapore'\n" >> ecoku.env
sudo chmod 0600 ./ecoku.env
sudo docker compose up -d
```

ホバーは `Asia/Singapore UTC+8` の形。`v0.1.0-rc.7` 以前はこの形式を使いません。
