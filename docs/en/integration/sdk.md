# JavaScript SDK Reference

The `ecoku` package is available for TypeScript and modern JavaScript frameworks.

---

## Installation

```bash
npm install ecoku
# or
pnpm add ecoku
```

---

## API Reference

```typescript
import Ecoku, { type EcokuConfig } from 'ecoku'

const ecoku = new Ecoku({
  container: '#comments',
  serverURL: 'https://ecoku.example.com',
  siteId: 'blog',
  pageKey: '/posts/hello-world/',
  pageTitle: 'Hello World',
  pageSize: 10,
  theme: 'auto',
  cssURL: '' // or 'none'
})

await ecoku.init()
```

### Methods
- `init(): Promise<void>`: Mounts and loads comments.
- `reload(): Promise<void>`: Re-fetches the current page of comments.
- `setPageKey(newPageKey: string): Promise<void>`: Switches page discussions dynamically in SPAs.
- `destroy(): void`: Unmounts DOM and cleans up controllers and event listeners.
- `isInitialized(): boolean`: Returns current mount status.
