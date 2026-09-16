# JavaScript SDK リファレンス

`ecoku` パッケージは、モダンなフロントエンド開発環境（Vite / Webpack / Next.js / Nuxt / Astro / SvelteKit / React / Vue 3）向けの公式 TypeScript / JavaScript SDK を提供します。

---

## 1. インストール

```bash
# npm を使用
npm install ecoku

# pnpm を使用
pnpm add ecoku

# yarn を使用
yarn add ecoku
```

---

## 2. コンストラクターと設定オプション

```typescript
import Ecoku, { type EcokuConfig } from 'ecoku'

const options: EcokuConfig = {
  container: '#comments',
  serverURL: 'https://ecoku.example.com',
  siteId: 'blog',
  pageKey: '/posts/example/',
}
const ecoku = new Ecoku(options)
```

### `EcokuConfig` 設定プロパティ一覧

| プロパティ名 | 型 | 必須 | 既定値 | 制約および説明 |
| :--- | :--- | :---: | :---: | :--- |
| `container` | `string \| HTMLElement` | **はい** | — | マウント対象コンテナのセレクター文字列（例: `#comments`）または DOM 要素の参照。 |
| `serverURL` | `string` | **はい** | — | Ecoku サーバーの絶対 HTTPS アドレス（例: `https://ecoku.example.com`）。 |
| `siteId` | `string` | **はい** | — | サイトの一意な識別子（正規表現 `/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/` に一致）。 |
| `pageKey` | `string` | **はい** | — | サイト内相対パス識別子（1〜512文字、例: `/posts/my-first-post/`）。 |
| `pageTitle` | `string` | いいえ | `""` | 記事タイトル（最大200文字）。メール通知等で表示されます。 |
| `pageSize` | `number` | いいえ | `10` | ルートコメントの 1 ページあたり表示件数（1〜100 の整数）。 |
| `theme` | `'auto' \| 'light' \| 'dark'` | いいえ | `'auto'` | テーマモード。`'auto'` は `prefers-color-scheme` に自動連動します。 |
| `cssURL` | `string` | いいえ | `""` | カスタム CSS URL。`'none'` を指定すると内蔵インラインスタイルの注入を停止します。 |

---

## 3. インスタンスメソッド一覧

### `init(options?: EcokuConfig): Promise<void>`
コメントシステムを初期化してマウントします。
- 設定の妥当性を検証し、内部の `WeakMap` により単一の DOM コンテナが複数の Ecoku インスタンスに同時にマウントされるのを防ぎます。
- ブラウザの IndexedDB に保存された 7 日間有効な訪問者認証情報を自動復号・復元します。
- 最初のページのコメントとサーバー設定を取得して描画します。

### `reload(): Promise<void>`
現在の並べ替え順序を維持したまま、表示中のページのコメントを再取得して再描画します。

### `setPageKey(newPageKey: string, pageTitle?: string): Promise<void>`
SPA（シングルページアプリケーション）の画面遷移時に、コメント対象ページを動的に切り替えます。
- `newPageKey` が現在と同じ場合、暗黙的に `reload()` を実行します。
- 新しいページの場合、以前のページの保留中ネットワークリクエストを `AbortController` で中止し、返信フォームを閉じ、ページネーションとフォームをリセットした上で、新しいページの第 1 ページを読み込みます。

### `destroy(): void`
インスタンスを完全に破棄します。
- DOM コンテナとインスタンスのバインドを解除します。
- 進行中のすべての Fetch リクエストを中止します。
- CAPTCHA ウィジェットおよびグローバルイベントリスナーを解除します。
- コメント欄によって生成された DOM ツリーを消去します。

### `isInitialized(): boolean`
インスタンスが正常にマウントされ、かつ破棄されていない状態かどうかを示す真偽値を返します。

---

## 4. フレームワーク別実装例

### Vue 3 Composition API

```vue
<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import Ecoku from 'ecoku'

const route = useRoute()
const mountEl = ref<HTMLElement | null>(null)
let ecokuInstance: Ecoku | null = null

onMounted(async () => {
  if (!mountEl.value) return
  ecokuInstance = new Ecoku({
    container: mountEl.value,
    serverURL: 'https://ecoku.example.com',
    siteId: 'blog',
    pageKey: route.path,
    pageTitle: document.title,
    theme: 'auto',
  })
  await ecokuInstance.init()
})

// SPA 遷移時にページキーを監視して切り替え
watch(() => route.path, (newPath) => {
  ecokuInstance?.setPageKey(newPath, document.title)
}, { flush: 'post' })

onUnmounted(() => {
  ecokuInstance?.destroy()
  ecokuInstance = null
})
</script>

<template>
  <div ref="mountEl" class="comments-wrapper"></div>
</template>
```

### React Hooks

```tsx
import React, { useEffect, useRef } from 'react'
import Ecoku from 'ecoku'

interface CommentProps {
  pageKey: string
  pageTitle?: string
}

export const CommentBox: React.FC<CommentProps> = ({ pageKey, pageTitle }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<Ecoku | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const ecoku = new Ecoku({
      container: containerRef.current,
      serverURL: 'https://ecoku.example.com',
      siteId: 'blog',
      pageKey,
      pageTitle,
      theme: 'auto',
    })

    ecoku.init().catch(console.error)
    instanceRef.current = ecoku

    return () => {
      ecoku.destroy()
      instanceRef.current = null
    }
  }, [pageKey])

  return <div ref={containerRef} />
}
```


第2引数に新しい記事タイトルを渡します。省略時は旧タイトルを消去します。ルートと記事タイトル更新後に呼び出してください。直接 SDK では空でない `cssURL` はインライン CSS 注入を止めるだけなので、ホスト側で `<link rel="stylesheet">` を追加します。自動追加はホスト型 loader のみです。
