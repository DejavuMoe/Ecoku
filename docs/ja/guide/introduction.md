# 概要とシステム構成

Ecoku は、静的ブログやドキュメントサイトのために設計された**セルフホスト対応のマルチサイト純テキストコメントシステム**です。

肥大化した審査キューや複雑なユーザー管理、外部トラッキングサービスを排除し、シングルコンテナ + SQLite3 の極小構成で提供されます。コメントは投稿後、セキュリティ検証を経てその場で公開されます。

---

## 設計思想

- **極小シングルコンテナ**：単一の Go バイナリが REST API、静的管理画面（`/admin/`）、ブラウザ SDK（`/client/`）を同時に提供。データは単一の SQLite3 ファイルで管理。
- **純テキストコミュニケーション**：コメント本文は HTML や Markdown として解釈されず、XSS 攻撃を根本から防止。
- **投稿後即時公開**：手動審査による遅延をなくし、IP レート制限、ブロガー合言葉、最新 CAPTCHA（Turnstile / Cap）で安全性を維持。
- **プライバシー保護**：公開 API はメールアドレス、IP、User-Agent、地域情報を返しません。訪問者情報は IndexedDB に AES-GCM 暗号化で 7 日間のみ保持。
- **トランザクショナルなスキーマ移行**：バージョン管理された SQLite マイグレーション（v1〜v7）により、単一トランザクションで安全にアップグレード。

---

## システム構成概要

```mermaid
flowchart TD
    subgraph Client["🌐 クライアント層 (Browser / Web)"]
        direction LR
        Visitor["📱 ブログ訪問者組み込み<br/>• 2KB 最小非同期ローダー (ecoku-loader.js)<br/>• ネイティブ SDK (ESM / UMD / CJS)<br/>• 資格情報ローカル 7 日間暗号化 (IndexedDB)<br/>• Smoji 軽量テキスト絵文字オンデマンド読込"]
        Admin["💻 管理画面 (/admin/)<br/>• Vue 3 + Pinia + システム明朝体<br/>• メモリ限定 Bearer Token (保存なし)<br/>• マルチサイト設定 / ボット認証管理<br/>• コメント墓標化と物理完全削除"]
    end

    subgraph Edge["🛡️ 境界リバースプロキシ (Reverse Proxy)"]
        Proxy["Caddy / Nginx / CDN<br/>• HTTPS / SSL 証明書自動終端<br/>• 訪問者の実 IP 検証と転送 (偽装防止)<br/>• ローカル TCP 127.0.0.1:12123 への転送"]
    end

    subgraph Runtime["📦 Ecoku 単一コンテナ (10001:10001)"]
        direction TB
        subgraph Core["Go 1.24 HTTP コアエンジン"]
            direction LR
            Engine["⚡ Gin HTTP コアサービス<br/>• プロセス内 IP レート制限 (Rate Limiter)<br/>• 動的 CSP ポリシー (Turnstile / Cap)<br/>• ボット認証 Siteverify リモート検証<br/>• 管理者 Bcrypt 認証とバージョン管理"]
            Outbox["📬 Outbox 非同期通知ワーカー<br/>• 単一インスタンスポーリングと指数バックオフ<br/>• SMTP メール通知 (TLS / STARTTLS)<br/>• Telegram Bot メッセージ配信<br/>• ブロガー合言葉パスワードレス識別"]
        end
        Storage["💾 SQLite3 ストレージエンジン (WAL モード)<br/>• /data/ecoku.sqlite3 (厳格な外部キー · インプレース移行 v1~v7)<br/>• AES-256-GCM 機密情報暗号化 (SMTP / Bot / 認証 Secret)"]
        Core --> Storage
    end

    Visitor -->|HTTPS REST| Proxy
    Admin -->|HTTPS REST| Proxy
    Proxy -->|127.0.0.1:12123| Engine
    Engine -.->|タスク登録| Outbox
```

---

## 適用シナリオと製品境界

### 適している用途

- **複数サイトの統合運用**：単一の Ecoku インスタンスで、複数の独立したドメインやブログに分離されたコメント環境を提供。
- **静的ブログ・ドキュメントサイト**：Hugo、Hexo、Astro、VitePress、Next.js、SvelteKit などのモダンな静的サイトジェネレーターに最適。
- **プライバシーを重視する個人開発者・執筆者**：議論データを自身のサーバー上の SQLite に完全保持し、外部クラウドや商用トラッキングに依存しない。
- **柔軟なボット防御**：インメモリ IP レート制限、Cloudflare Turnstile、セルフホスト型 Cap の間で自在に切り替え可能。

### あえて提供しないもの

極小・堅牢・軽量を維持するため、Ecoku は以下を設計段階から明確に除外しています：

- ❌ **リッチテキスト・Markdown 描画**：コメント本文は純粋なプレーンテキストとして扱われ、HTML やタグは一切解釈されません（厳格な同一生成元の Smoji 絵文字を除く）。
- ❌ **一般ユーザー登録・ログインシステム**：訪問者はアカウント作成不要で、ニックネーム、非公開メール、任意ウェブサイトのみで投稿。
- ❌ **いいね・リアクション・アバター外部取得**：Gravatar や外部 IP 分析サービスへのリクエストを行わず、トラッキングを徹底排除。
- ❌ **事前審査キュー**：レート制限と CAPTCHA を通過したコメントは即座に公開。問題のあるコメントは事後的に墓標化。
- ❌ **MySQL / PostgreSQL サポート**：単一ファイルで完結する SQLite3（WAL モード）の信頼性に特化。

---

## デプロイの流れ

Ecoku コンテナは非 root ユーザー（`10001:10001`）で動作し、内部ループバック `127.0.0.1:12123` のみでリッスンします。

1. **環境の準備**：`compose.yaml`、`app/config.yaml`、`ecoku.env` を配置。
2. **リバースプロキシ設定**：Caddy や Nginx で HTTPS を終端し、ローカルポートへ転送。
3. **管理画面の設定**：`/admin/` にアクセスし、サイト登録、ブロガー合言葉、通知設定を完了。
4. **サイトへの組み込み**：ブログテンプレートに約 2KB の `ecoku-loader.js` を追加。

詳細な手順については [Docker 導入](/ja/self-hosting/docker) をご覧ください。
