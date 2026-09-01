# JavaScript SDK 參考

`ecoku` 提供 TypeScript 與現代前端框架整合套件。

---

## 安裝

```bash
npm install ecoku
# 或
pnpm add ecoku
```

---

## API 參考

```typescript
import Ecoku from 'ecoku'

const ecoku = new Ecoku({
  container: '#comments',
  serverURL: 'https://comments.example.com',
  siteId: 'blog',
  pageKey: '/posts/hello-world/',
  pageTitle: '你好，世界',
  theme: 'auto',
})

await ecoku.init()
```

### 方法
- `init(): Promise<void>`：初始化並掛載。
- `reload(): Promise<void>`：重新載入當前頁評論。
- `setPageKey(newPageKey: string, newPageTitle?: string): Promise<void>`：SPA 路由切換時動態切換頁面。
- `destroy(): void`：完全銷毀實例並解綁事件。
- `isInitialized(): boolean`：查詢就緒狀態。
