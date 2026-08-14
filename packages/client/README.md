# Ecoku browser client

`ecoku` is the embeddable TypeScript browser client for the Ecoku self-hosted
comment service. It owns one explicit container and renders the published
plain-text, no-avatar, threaded comment surface.

## Install

```bash
npm install ecoku
```

Version 3 exposes the same default `Ecoku` constructor through ESM, CommonJS,
and a browser UMD global:

```js
// ESM
import Ecoku from 'ecoku'

// CommonJS
const Ecoku = require('ecoku')
```

```html
<script src="https://ecoku.example/client/ecoku.umd.js"></script>
<script>
  const comments = new Ecoku({ /* explicit configuration */ })
</script>
```

The production Ecoku image also exposes `/client/ecoku-loader.js`. Static sites
can use the loader with declarative `data-ecoku-comments` attributes instead of
copying the UMD bundle into each site. See the repository static-site integration
guide for the complete contract.

## Mount a comment surface

```ts
import Ecoku from 'ecoku'

const comments = new Ecoku({
  container: '#comments',
  serverURL: 'https://comments.example.com/',
  siteId: 'docs',
  pageKey: 'guides/windows-11-iot-ltsc',
  pageTitle: 'Windows 11 IoT LTSC 养老指南',
  pageSize: 10,
  theme: 'auto', // auto | light | dark
})

await comments.init()
```

The caller must provide the canonical `pageKey`; `pageTitle` should be the
human-readable article title used by notifications. The SDK never derives either
value from the browser URL. Styles are bundled into the component; CSS custom properties
inherit from the host page.

The server-authoritative site registry controls whether email and website are
required and supplies the comment textarea placeholder. The SDK reads this
safe form configuration from the public comment-list response; it never accepts
management credentials in browser options. Nickname and comment content remain
required for every site.

For a single-page application:

```ts
await comments.setPageKey('guides/another-article')
await comments.reload()
comments.destroy()
```

`apiBaseUrl` remains a deprecated alias for `serverURL`. The former
`ecoku-comment-*` DOM-template protocol is no longer supported; production
integration must provide a dedicated container. This removal is the breaking
change behind the 3.0.0 version. Replace legacy template elements with one empty
container and pass that container together with `serverURL`, `siteId`, and
`pageKey` to the constructor.

## Privacy and security contract

- The browser receives only published comments and public tombstones.
- Email, nickname, and website remain in component memory only and are cleared
  by refresh or component destruction.
- The SDK never accepts a management key, administrator token, client IP,
  forwarding header, user-agent value, location, avatar, analytics endpoint, or
  third-party IP service.
- Comment content is rendered as text. HTML and Markdown are not interpreted.
- Author websites must use `http` or `https` and are rendered with
  `nofollow ugc noopener noreferrer`.

## Development checks

```bash
pnpm run test
pnpm run type-check
pnpm run build
pnpm run test:package
pnpm run validate
```

The package currently has no lint script.
