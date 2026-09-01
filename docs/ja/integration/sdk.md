# JavaScript SDK リファレンス

TypeScript およびモダンフロントエンドフレームワーク用 SDK。

---

## インストール

```bash
npm install ecoku
# または
pnpm add ecoku
```

---

## API リファレンス

```typescript
import Ecoku from 'ecoku'

const ecoku = new Ecoku({
  container: '#comments',
  serverURL: 'https://comments.example.com',
  siteId: 'blog',
  pageKey: '/posts/hello-world/',
  pageTitle: 'こんにちは世界',
  theme: 'auto',
})

await ecoku.init()
```

### メソッド
- `init(): Promise<void>`：初期化して描画。
- `reload(): Promise<void>`：現在のページを再取得。
- `setPageKey(newPageKey: string, newPageTitle?: string): Promise<void>`：SPA 遷移時にページを変更。
- `destroy(): void`：インスタンスを破棄。
- `isInitialized(): boolean`：初期化状態を取得。
