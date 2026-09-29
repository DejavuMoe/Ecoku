# JavaScript SDK

[HTML で埋め込む](./html)方法は、記事ごとに独立したページがある静的サイトに向いています。Vue や React のようなシングルページアプリでは、記事を切り替えてもページが再読み込みされないため、コメント欄も合わせて切り替える必要があります。その場合は SDK を直接使います。

## SDK を入手する

どの Ecoku インスタンスも `/client/ecoku.umd.js` で SDK を提供しており、読み込むとグローバル変数 `Ecoku` が登録されます。

::: info npm パッケージは未公開です
SDK のパッケージ名は `ecoku` ですが、まだ npm に公開されていないため、`npm install ecoku` は使えません。ES モジュールや TypeScript の型定義が必要な場合は、ソースリポジトリの `packages/client` ディレクトリで自分でビルド（`pnpm build`）でき、成果物は `dist/` に出力されます。
:::

シングルページアプリでは、UMD ファイルを必要なときに一度だけ読み込む関数を用意できます。

```js
const ECOKU_URL = 'https://ecoku.example.com'
let ecokuPromise

export function loadEcoku() {
  if (window.Ecoku) return Promise.resolve(window.Ecoku)
  ecokuPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `${ECOKU_URL}/client/ecoku.umd.js`
    script.async = true
    script.onload = () => (window.Ecoku ? resolve(window.Ecoku) : reject(new Error('Ecoku が読み込まれていません')))
    script.onerror = () => {
      ecokuPromise = undefined
      script.remove()
      reject(new Error('Ecoku を読み込めません'))
    }
    document.head.append(script)
  })
  return ecokuPromise
}
```

## コメント欄を作成する

```js
const Ecoku = await loadEcoku()
const comments = new Ecoku({
  container: '#comments',
  serverURL: 'https://ecoku.example.com',
  siteId: 'blog',
  pageKey: '/posts/hello-world/',
  pageTitle: 'こんにちは、世界',
})
await comments.init()
```

### 設定項目

| 設定項目 | 型 | 必須 | デフォルト値 | 説明 |
| --- | --- | :---: | --- | --- |
| `container` | `string \| HTMLElement` | はい | — | マウントする位置。CSS セレクターまたは DOM 要素です。コンテナの既存の内容は置き換えられます。 |
| `serverURL` | `string` | はい | — | Ecoku のアドレス。`http://` または `https://` で始まり、クエリーパラメーターや `#` は含められません。 |
| `siteId` | `string` | はい | — | 管理画面で登録したサイト ID。 |
| `pageKey` | `string` | はい | — | 現在の記事のページキー。1～512 文字。SDK は URL から自動で推測しないので、必ず明示的に渡してください。 |
| `pageTitle` | `string` | いいえ | `''` | 記事のタイトル。通知に表示されます。最大 200 文字。 |
| `pageSize` | `number` | いいえ | `10` | 1 ページあたりのルートコメント数。1～100 の整数。 |
| `theme` | `'auto' \| 'light' \| 'dark'` | いいえ | `'auto'` | 配色。`auto` はページのライト / ダーク設定に従います。 |
| `cssURL` | `string` | いいえ | `''` | 空の場合はデフォルトのスタイルを注入します。何らかの値（スタイルシートのアドレスまたは `'none'`）を指定すると注入を停止します。後述を参照してください。 |

コンストラクターは引数を検証しません。引数が不正な場合は `init()` が `TypeError` を投げます。

古い設定項目 `apiBaseUrl` は `serverURL` の別名で、引き続き使えますが非推奨です。

### スタイル {#styles}

- `cssURL` が空：SDK がコメント欄の中にデフォルトのスタイルを注入します。CSS を別途読み込む必要はありません。
- `cssURL` にスタイルシートのアドレスを指定：SDK は注入しなくなり、そのアドレスを代わりに読み込むことも**しません**。ページに自分で `<link rel="stylesheet">` を追加する必要があります（HTML のローダーは自動で追加しますが、SDK はしません）。
- `cssURL` が `'none'`：スタイルを一切注入せず、見た目は完全に自分の CSS で決まります。

インスタンスが提供する `/client/ecoku.css`（デフォルトのスタイルと同じ）または `/client/ecoku.unstyled.css`（レイアウトのみ）を使えます。詳しくは[カスタムスタイル](./custom-css)を参照してください。

## インスタンスメソッド

### `init(options?)`

コメント欄をマウントし、ブラウザに保存された訪問者情報を復元して、最初のページのコメントを読み込みます。Promise を返します。

- `options` を渡すと、コンストラクターで指定した設定を置き換えます。
- 初期化済みのインスタンスで再度呼び出しても、重複してマウントされることはありません。
- 1 つのコンテナを同時に使えるインスタンスは 1 つだけで、そうでない場合はエラーを投げます。先に古いインスタンスで `destroy()` を呼んでください。

### `setPageKey(pageKey, pageTitle?)`

別の記事のコメント欄に切り替えます。シングルページアプリでルートが変わった後に呼ぶのに向いています。

- ページキーが現在と同じ場合は、コメントを読み込み直すだけです。
- 異なる場合は、進行中のリクエストをキャンセルし、開いている返信欄を閉じ、コメント欄を空にして、新しいページの最初のページを読み込みます。
- **2 つ目の引数には新しい記事のタイトルを渡してください**。省略するとタイトルは前の記事のものを引き継がずに空になります。そうしないと、新しいコメントの通知に誤った記事名が表示されてしまいます。ルートとタイトルの両方が更新されてから呼び出してください。
- ここで渡したタイトルは切り詰められません。200 文字を超えると、サーバーはコメントの投稿を拒否します。

### `reload()`

現在のページのコメントを読み込み直します。並び順は変わりません。

### `destroy()`

コメント欄をアンマウントします。すべてのリクエストをキャンセルし、検証ウィジェットとイベントリスナーを取り除いて、コンテナを空にします。コンポーネントのアンマウント時に呼び出します。

### `isInitialized()`

インスタンスが現在初期化されているかどうかを返します。

## Vue 3

```vue
<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { loadEcoku } from './load-ecoku'

const route = useRoute()
const el = ref(null)
let comments = null

onMounted(async () => {
  const Ecoku = await loadEcoku()
  comments = new Ecoku({
    container: el.value,
    serverURL: 'https://ecoku.example.com',
    siteId: 'blog',
    pageKey: route.path,
    pageTitle: document.title,
  })
  await comments.init()
})

watch(
  () => route.path,
  (path) => comments?.setPageKey(path, document.title),
  { flush: 'post' },
)

onBeforeUnmount(() => {
  comments?.destroy()
  comments = null
})
</script>

<template>
  <div ref="el"></div>
</template>
```

`document.title` は、ルートが切り替わった後に新しい記事のタイトルに更新されている必要があります。タイトルがほかの処理で非同期に設定される場合は、記事データのタイトルを渡すように変更してください。

## React

```jsx
import { useEffect, useRef } from 'react'
import { loadEcoku } from './load-ecoku'

export function Comments({ pageKey, pageTitle }) {
  const el = useRef(null)

  useEffect(() => {
    let comments
    let cancelled = false
    loadEcoku().then((Ecoku) => {
      if (cancelled) return
      comments = new Ecoku({
        container: el.current,
        serverURL: 'https://ecoku.example.com',
        siteId: 'blog',
        pageKey,
        pageTitle,
      })
      comments.init().catch(console.error)
    })
    return () => {
      cancelled = true
      comments?.destroy()
    }
  }, [pageKey, pageTitle])

  return <div ref={el} />
}
```

このコンポーネントは記事が変わるたびに古いインスタンスを破棄して新しいインスタンスを作るので、最も簡単な書き方です。インスタンスを一度だけ作り、`pageKey` が変わったときに `setPageKey(pageKey, pageTitle)` を呼んで、マウントし直す手間を省くこともできます。
