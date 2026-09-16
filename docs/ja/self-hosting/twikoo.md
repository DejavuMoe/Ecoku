# Twikoo の履歴データのインポート

`import-twikoo` は Twikoo JSON 配列の対応フィールドを Ecoku のプレーンテキストコメントに変換します。対象サイトは登録済みで、墓標を含めコメントが 0 件である必要があります。通知は送信せず、IP、UA、アバター、リアクション、外部ユーザー ID は保持しません。

## フィールドと変換

| JSON | Ecoku |
| :--- | :--- |
| `_id` / `id`、`pid` / `rid` | ID と親子関係を再構築し、直接の親を優先します。欠落、別ページ、解決できない親関係はルートとして保持され、親不明の件数に含まれる場合があります。 |
| `url` | サイト内パスを抽出し、query / fragment を除去します。 |
| `comment` | HTML のテキストを抽出し、script/style を除去します。画像は alt または `[图片]` に変換します。Markdown 構文は解析しません。 |
| `nick` / `mail` / `link` | ニックネーム、非公開メールアドレス、有効な http(s) の投稿者サイトを保存します。 |
| `created` / `updated` | 日時を変換して保存します。 |
| ブロガーフラグ | 対象サイトのニックネームとメール設定から補完します。エクスポートの `is_blogger` は読み取りません。 |

## 1. 事前準備

対象サイトを登録し、[バックアップと復元](./backup)に従って停止中のコールドバックアップを作成・検証してください。バックアップ例は最後にサービスを起動するため、インポート前に再度停止します。以下は元ファイルを一時コピーし、コンテナの UID 10001 に読み取りを許可します。`/path/to/twikoo.json` を元ファイルのパスに置き換え、原本を保持してください。

```bash
cd ~/Ecoku
sudo docker compose down
sudo install -o 10001 -g 10001 -m 600 /path/to/twikoo.json data/twikoo.json
```

## 2. dry-run の実行

`blog` を対象サイト ID に置き換えてください。dry-run はインポートトランザクションを実行後にロールバックし、コメントを永続化しません。ただし CLI 起動時に DB の初期化や移行が実行される場合があり、読み取り専用操作ではありません。

```bash
sudo docker compose run --rm --no-deps ecoku \
  import-twikoo --site=blog --file=/data/twikoo.json --dry-run
```

コメント、ルート、返信、ページ、メール、サイト、親不明の各件数を確認します。無効な JSON や重複 ID などは中止します。解決できない親関係はルートとして保持され、スキップされるわけではありません。

## 3. 本番インポートと後処理

dry-run の結果とバックアップを確認し、停止したまま `--dry-run` を除いた同じコマンドを実行します。インポートトランザクションに失敗すると全体をロールバックします。成功後は今回の一時コピーだけを削除して起動し、対象サイトと履歴コメントを確認します。原本とバックアップは自身の保存方針に従って管理してください。

```bash
(
set -eu
cd ~/Ecoku
sudo docker compose run --rm --no-deps ecoku \
  import-twikoo --site=blog --file=/data/twikoo.json
sudo rm -- data/twikoo.json
sudo docker compose up -d
)
```
