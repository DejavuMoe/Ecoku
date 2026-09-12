# 汎用 HTML と Loader の組み込み

Ecoku には約 2KB の超軽量非同期ローダー `ecoku-loader.js` が用意されています。HTML 内で `data-*` 属性を宣言するだけで、ローダーが非同期でコア SDK とスタイルシートを読み込み、コメント欄をマウントします。

---

## クイックスタート例

ページ内のコメント欄を表示させたい場所に以下の HTML を配置します：

```html
<!-- コメント欄コンテナシェル -->
<section
  id="ecoku-comments"
  class="ecoku-shell"
  data-ecoku-comments
  data-server-url="https://ecoku.example.com"
  data-site-id="blog"
  data-page-key="/posts/hello-world/"
  data-page-title="こんにちは世界"
  data-page-size="10"
  data-theme="auto"
>
  <!-- エラー状態と再試行ボタンコンテナ (初期状態は非表示) -->
  <div class="ecoku-loader" data-ecoku-loader hidden>
    <p class="ecoku-loader-status" data-ecoku-status></p>
    <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>コメントを再読み込み</button>
  </div>
  <!-- 実際のマウント先 DOM -->
  <div id="ecoku-mount" data-ecoku-mount></div>
</section>

<!-- ローダースクリプトの非同期読み込み -->
<script src="https://ecoku.example.com/client/ecoku-loader.js" defer></script>
```

---

## HTML `data-*` 属性仕様

| 属性名 | 必須 | 型 | 仕様と説明 |
| :--- | :---: | :--- | :--- |
| `data-server-url` | **はい** | String | Ecoku バックエンドサービスの絶対 HTTPS アドレス（例: `https://ecoku.example.com`）。 |
| `data-site-id` | **はい** | String | 管理コンソールで作成したサイトの一意な識別子。 |
| `data-page-key` | **はい** | String | 現在のページの**安定したサイト内相対パス**（1〜512文字、例: `/posts/hello-world/`）。完全な URL やクエリ/フラグメントを含めてはなりません。 |
| `data-page-title` | いいえ | String | 現在の記事タイトル（最大200文字）。メール通知での表示に使用されます。 |
| `data-page-size` | いいえ | Number | ルートコメントの 1 ページあたり表示件数（1〜100 の整数、既定 `10`）。 |
| `data-theme` | いいえ | String | テーマモード：`auto`（システム連動、既定）、`light`（ライト）、`dark`（ダーク）。 |
| `data-css-url` | いいえ | String | カスタム CSS URL。絶対 URL、相対パス、または `none` を指定して内蔵スタイルの注入を無効化できます。詳細は [カスタム CSS](/ja/integration/custom-css) を参照。 |

---

## 仕組みとメリット

1. **描画を一切ブロックしない高速起動**：`ecoku-loader.js` はわずか約 2KB であり、`defer` 属性によりブログの初回描画を妨げません。
2. **サイレントローディング**：読み込み中に邪魔なスケルトンや「読み込み中…」スピナーを表示せず、準備が整い次第スムーズにマウントします。
3. **耐障害性と対話的再試行**：ネットワーク瞬断等でコア SDK の読み込みがタイムアウト（既定 12 秒）または失敗した場合、`.ecoku-loader` が自動起動し再試行ボタンを表示します。
4. **スタイルの自動注入**：`data-css-url` を明示しない限り、SDK 初期化時に最適化されたインラインスタイルが自動挿入されるため、外部 `<link rel="stylesheet">` の追加は不要です。

---

## UMD 直接組み込み（ローダー不使用）

ライフサイクルを `<script>` タグで完全に手動制御したい場合は、UMD ビルドを直接利用できます：

```html
<!-- 1. スタイルシートの読み込み -->
<link rel="stylesheet" href="https://ecoku.example.com/client/ecoku.css">

<!-- 2. マウント先コンテナ -->
<div id="ecoku-mount"></div>

<!-- 3. コア UMD スクリプト -->
<script src="https://ecoku.example.com/client/ecoku.umd.js"></script>

<!-- 4. インスタンスの初期化 -->
<script>
  const comments = new Ecoku({
    container: '#ecoku-mount',
    serverURL: 'https://ecoku.example.com',
    siteId: 'blog',
    pageKey: window.location.pathname,
    pageTitle: document.title,
    pageSize: 10,
    theme: 'auto',
    cssURL: 'none' // 外部 link で読み込み済みであることを伝え、重複注入を防止
  })

  comments.init().catch(console.error)
</script>
```
