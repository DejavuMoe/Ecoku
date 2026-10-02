# HTML で埋め込む

記事テンプレートに HTML とスクリプトを 1 つずつ置くだけで、どの静的サイトにもコメント欄を表示できます。スクリプト `ecoku-loader.js` は自分の Ecoku インスタンスが提供し、HTML の属性を読み取ってコメントウィジェットを自動で読み込みます。

始める前に、管理画面で[サイトを登録](../self-hosting/admin#sites)し、ブログのオリジンをそのサイトの許可オリジンに追加してあることを確認してください。

## 埋め込みコード

次のコードを記事テンプレートのコメント欄の位置に置き、3 か所の値を置き換えます。

- `data-server-url`：自分の Ecoku のアドレス
- `data-site-id`：管理画面で登録したサイト ID
- `data-page-key`、`data-page-title`：テンプレート変数で現在の記事のパスとタイトルを出力します

```html
<section
  id="ecoku-comments"
  class="ecoku-shell"
  data-ecoku-comments
  data-server-url="https://ecoku.example.com"
  data-site-id="blog"
  data-page-key="/posts/hello-world/"
  data-page-title="こんにちは、世界"
  data-page-size="10"
  data-theme="auto"
>
  <div class="ecoku-loader" data-ecoku-loader hidden>
    <p class="ecoku-loader-status" data-ecoku-status></p>
    <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>コメントを再読み込み</button>
  </div>
  <div id="ecoku-mount" data-ecoku-mount></div>
</section>
<script src="https://ecoku.example.com/client/ecoku-loader.js" defer></script>
```

外側の要素の中にある `data-ecoku-*` 付きの 4 つの要素は、すべて残してください。`data-ecoku-mount` はコメント欄をマウントする位置で、残りの 3 つは読み込みに失敗したときにエラーメッセージと再試行ボタンを表示するためのものです。ボタンの文字は自由に変えられます。

## 属性

| 属性 | 必須 | 説明 |
| --- | :---: | --- |
| `data-server-url` | はい | Ecoku のアドレス（例：`https://ecoku.example.com`）。`http://` または `https://` で始まる完全なアドレスでなければなりません。 |
| `data-site-id` | はい | 管理画面で登録したサイト ID。 |
| `data-page-key` | はい | 現在の記事のページキー。サイト内の相対パスで、最大 512 文字、`?` や `#` は含められません。後述を参照してください。 |
| `data-page-title` | いいえ | 記事のタイトル。通知メールに表示されます。200 文字を超えた部分は切り捨てられます。 |
| `data-page-size` | いいえ | 1 ページに表示するルートコメントの数。1～100、デフォルトは 10。無効な値を指定した場合は 10 として扱います。 |
| `data-theme` | いいえ | `auto`（デフォルト）、`light`、`dark` のいずれか。`auto` はページのライト / ダーク設定に従います。 |
| `data-css-url` | いいえ | デフォルトのスタイルを置き換えます。[カスタムスタイル](./custom-css)を参照してください。 |

## ページキーを選ぶ

ページキーはコメントがどの記事に属するかを決めるもので、[一度使ったら変更しないでください](../guide/concepts#page-key)。通常は記事のサイト内パスを使います。主なジェネレーターでの書き方：

::: v-pre
| ジェネレーター | `data-page-key` の値 |
| --- | --- |
| Hugo | `{{ .RelPermalink }}` |
| Hexo | `<%- url_for(page.path) %>` |
| Jekyll | `{{ page.url }}` |
| Astro | `{Astro.url.pathname}` |
| VitePress | カスタムテーマで `useRoute().path` を読み取り、[SDK](./sdk) で埋め込みます |
:::

上記は参考です。ブラウザで生成された HTML を見て、完全な URL ではなく `/posts/hello-world/` のような安定したパスが出力されていることを確認してください。

## 読み込みの流れ

1. ページの解析が終わると、ローダーが外側の要素の属性を読み取ります。`data-server-url`、`data-site-id`、`data-page-key` のいずれかがない場合や、4 つの `data-ecoku-*` 子要素のどれかが欠けている場合は、**何も表示せずにスキップ**し、ページには何も現れません。
2. ローダーは自分と同じディレクトリから `ecoku.umd.js` を読み込み、コメント欄を初期化します。読み込み中に「読み込み中」のような文字は表示しません。
3. スクリプトの読み込みと初期化のいずれかの段階が 12 秒を超えた場合、または失敗した場合は、エラーメッセージと「コメントを再読み込み」ボタンを表示し、訪問者はクリックして再試行できます。

1 つのページに複数の外側要素を置くことができ、それぞれが独立して初期化されます。

## 自分でホストしたローダーを使う

`ecoku-loader.js` を自分の CDN に置き、`<script src>` だけを変更することもできます。ローダーは**同じディレクトリ**から `ecoku.umd.js` を読み込むので、2 つのファイルは一緒に置き、Ecoku をアップグレードするときは両方を更新してください。

## ブログのページの CSP

ブログでコンテンツセキュリティポリシー（CSP）を設定している場合は、次を許可する必要があります。

- `script-src` と `connect-src`：Ecoku のオリジン（例：`https://ecoku.example.com`）
- デフォルトのスタイルは `<style>` 要素として注入されます。CSP でインラインスタイルを許可していない場合は、`data-css-url` を `https://ecoku.example.com/client/ecoku.css` にして外部スタイルシートを使い、`style-src` でそのオリジンを許可してください。
- CAPTCHA を有効にしている場合は、検証サービスも許可する必要があります。[CAPTCHA · コンテンツセキュリティポリシー](../self-hosting/captcha#csp)を参照してください。
- [Smoji スタンプ](./smoji)が有効な場合、`connect-src` で一覧のオリジン、`img-src` で画像のオリジンを許可してください。別々にホストする場合はそれぞれ設定します。[一覧と画像のホスティング](./smoji#hosting)を参照してください。

## ローダーを使わない場合

UMD ファイルを直接読み込み、初期化のタイミングを自分で制御することもできます。

```html
<link rel="stylesheet" href="https://ecoku.example.com/client/ecoku.css">
<div id="ecoku-mount"></div>
<script src="https://ecoku.example.com/client/ecoku.umd.js"></script>
<script>
  const comments = new Ecoku({
    container: '#ecoku-mount',
    serverURL: 'https://ecoku.example.com',
    siteId: 'blog',
    pageKey: '/posts/hello-world/',
    pageTitle: 'こんにちは、世界',
    cssURL: 'https://ecoku.example.com/client/ecoku.css',
  })
  comments.init().catch(console.error)
</script>
```

UMD ファイルはグローバル変数 `Ecoku` を登録します。上の例では `<link>` でスタイルを読み込み、`cssURL` で SDK にデフォルトのスタイルを注入しないよう伝えています。この 2 か所を取り除くと、SDK が自分でスタイルを注入します。設定項目とメソッドは [JavaScript SDK](./sdk) を参照してください。
