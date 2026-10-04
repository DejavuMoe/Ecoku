# Ecoku browser client

`ecoku` is the embeddable TypeScript browser client for the Ecoku self-hosted
comment service. It owns one explicit container and renders the published
plain-text, no-avatar, threaded comment surface.

## Install

[ecoku is available on npm](https://www.npmjs.com/package/ecoku). Install version 0.3.2:

```bash
npm install --save-exact ecoku@0.3.2
```

SDK versions follow repository release tags. You can also use the SDK served by
your Ecoku instance or build this package from source.

The SDK exposes the same default `Ecoku` constructor through ESM, CommonJS,
and a browser UMD global:

```js
// ESM
import Ecoku from 'ecoku'

// CommonJS
const Ecoku = require('ecoku')
```

```html
<script src="https://ecoku.example.com/client/ecoku.umd.js"></script>
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
  serverURL: 'https://ecoku.example.com/',
  siteId: 'docs',
  pageKey: 'guides/windows-11-iot-ltsc',
  pageTitle: 'Windows 11 IoT LTSC 养老指南',
  pageSize: 10,
  theme: 'auto', // auto | light | dark
  // i18n: 'en', // zh-CN | zh-Hant | en; omit to use the site's language
  // cssURL: 'https://ecoku.example.com/client/ecoku.unstyled.css',
})

await comments.init()
```

The caller must provide the canonical `pageKey`; `pageTitle` should be the
human-readable article title used by notifications. The SDK never derives either
value from the browser URL. Styles are bundled into the component; colour tokens
inherit from the host page and the `auto` theme inherits its `color-scheme`. Default
`--ecoku-*` tokens have zero specificity, so a host rule on `.ecoku-comments` overrides
them. Pass `cssURL` to skip injection and use a host stylesheet instead (`none` skips
without loading a file).

The interface language comes from the `i18n` option, then the site's saved language,
then `zh-CN`. Default placeholder, empty-state and blogger-badge text follow that
language; text the site customized is shown as written.

The server-authoritative site registry controls whether email and website are
required and supplies the comment textarea placeholder. The SDK reads this
safe form configuration from the public comment-list response; it never accepts
management credentials in browser options. Nickname and comment content remain
required for every site.

For a single-page application, call `setPageKey()` after a route change; it loads the first page of the new article itself. `reload()` refreshes the current page, and `destroy()` unmounts the surface:

```ts
await comments.setPageKey('guides/another-article', 'Another article')
await comments.reload()   // refresh the current page when needed
comments.destroy()        // when the host component unmounts
```

`apiBaseUrl` remains a deprecated alias for `serverURL`. The former
`ecoku-comment-*` DOM-template protocol is no longer supported; production
integration must provide a dedicated container. This removal is the breaking
change from the former DOM-template integration.
Replace legacy template elements with one empty
container and pass that container together with `serverURL`, `siteId`, and
`pageKey` to the constructor.

## Privacy and security contract

- The browser receives only published comments and public tombstones.
- Nickname, email, and website are shared by the root and inline reply forms.
  They are encrypted in IndexedDB with a non-extractable AES-GCM key, scoped to
  `serverURL + siteId`, and expire seven days after saving. No identity value is
  written to localStorage, cookies, or URLs; clearing browser site data removes
  it naturally. Unavailable, corrupt, or expired storage falls back to an empty
  identity without blocking comments.
- The SDK never accepts a management key, administrator token, client IP,
  forwarding header, user-agent value, location, avatar, analytics endpoint, or
  third-party IP service.
- The server selects `off`, Cloudflare Turnstile, or a self-hosted Cap instance through public form configuration. The SDK loads only the selected Widget and sends one generic, single-use `captchaToken`; provider Secrets and Siteverify results never enter the browser. Cap Widget/WASM assets come from the configured instance, not a public CDN.
- Comment content is rendered as text. HTML and Markdown are not interpreted.
- Author websites must use `http` or `https` and are rendered with
  `nofollow ugc noopener noreferrer`.

Strict host CSP must allow the selected provider. Turnstile requires `https://challenges.cloudflare.com`; current Cap 3.x instrumentation requires the configured Cap HTTPS Origin in `script-src` and `connect-src`, `worker-src blob:`, `frame-src 'self'`, WebAssembly, and JavaScript `'unsafe-eval'` because its generated sandbox script uses `eval` / `new Function`. Nonce-based Cap instrumentation also uses the same preconfigured `window.CAP_CSS_NONCE` and `window.CAP_SCRIPT_NONCE` before Ecoku loads. Hosts that reject this CSP tradeoff must disable instrumentation for that Cap key or select Turnstile; do not broaden the policy with wildcards or `unsafe-inline`.

## Development checks

```bash
pnpm run test
pnpm run type-check
pnpm run build
pnpm run test:package
pnpm run validate
```

The package currently has no lint script.

The optional second `setPageKey` argument updates the article title; omission clears the old title. Call after the host has updated its route and title. Direct SDK `cssURL` disables inline CSS only; add the corresponding stylesheet with a host `<link rel="stylesheet">`. The hosted loader inserts that link automatically.
