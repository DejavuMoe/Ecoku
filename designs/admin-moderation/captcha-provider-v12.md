# CAPTCHA provider v12 review notes

Status: **approved implementation baseline**. The v12/v16 prototypes define the production security settings, login, and public comment CAPTCHA surfaces; comment revision 17 later restyled the public Cap frame to follow the Ecoku radius and colour tokens while keeping its official 260 × 58px geometry.

The current approved baselines remain:

- admin site configuration: `index-v11.html`;
- admin security and login: `index-v12.html`;
- public comments: `../plain-thread-comments/index-v17.html`.

## Product model

Robot verification remains instance-level and protects both visitor comment submission and administrator login. The administrator chooses exactly one active mode:

1. `off` — no CAPTCHA; existing request-rate limits remain active;
2. `turnstile` — the existing Cloudflare Turnstile behavior;
3. `cap` — a self-hosted Cap Standalone instance.

There is no automatic fallback between providers. A provider timeout, malformed response, unavailable service, or invalid token fails closed. Silent fallback would let an attacker reduce protection by making the selected provider unreachable.

Turnstile and Cap configuration are retained independently while inactive. Switching providers therefore does not erase either secret, but only the selected provider is exposed in the public non-secret form/login configuration and only that provider verifies the next token.

## Proposed administrator fields

Turnstile retains:

- Sitekey;
- Secret key (write-only; reads return only `secret_set`).

Cap adds:

- instance URL, normalized to one absolute HTTPS URL without credentials, query, or fragment;
- public Site key;
- Secret key (write-only; reads return only `secret_set`).

Repository examples use `https://cap.example.com`; an operator supplies the actual deployment URL only in the running instance. Cap's dashboard `ADMIN_KEY` is never accepted by Ecoku and must not be confused with the per-site Secret key.

## Public and request contracts

The implementation should replace provider-specific branching in the UI with one tagged public challenge configuration. It may temporarily retain `turnstileSitekey` as a compatibility field, but secrets never enter a public DTO.

New clients should submit one generic `captchaToken` field for administrator login and comment submission. The server may accept the legacy `turnstileToken` only for Turnstile compatibility and must reject ambiguous requests that send conflicting token fields.

Cap's browser endpoint is:

```text
https://<CAP_INSTANCE>/<SITE_KEY>/
```

The endpoint must keep its trailing slash. Ecoku's server verifies the single-use token exactly once by sending JSON to:

```text
POST https://<CAP_INSTANCE>/<SITE_KEY>/siteverify
Content-Type: application/json

{
  "secret": "<CAP_SITE_SECRET>",
  "response": "<SINGLE_USE_TOKEN>"
}
```

Only `{"success": true}` succeeds. The token and Secret key are never logged. A token obtained for a request is reset after any attempted submission because Cap tokens are single-use even when the business request later fails.

Primary upstream contracts:

- <https://trycap.dev/guide/widget>
- <https://trycap.dev/guide/standalone/>
- <https://trycap.dev/guide/>

## Browser assets and styling

The intended integration loads the Cap Widget and WASM from the operator's Standalone asset server, which the deployment pins independently:

```text
https://<CAP_INSTANCE>/assets/widget.js
https://<CAP_INSTANCE>/assets/cap_wasm_bg.wasm
```

`window.CAP_CUSTOM_WASM_URL` must be set before the Widget script loads. Both the admin login and public comment form use the Widget's documented i18n attributes and public CSS custom properties. The prototypes retain Cap's official 260 × 58px geometry, 14px radius, 25px checkbox, SVG progress/check/error states, and lower-right credit; only the color and font tokens are mapped to Ecoku. The comment SDK inherits the host font, while admin uses the approved system-serif stack.

The production CSP change must be narrowly derived from the normalized active Cap origin and verified in a real browser. Cap uses cross-origin fetches, WebAssembly, blob-backed Web Workers, and an instrumentation iframe; its nonce hooks (`CAP_CSS_NONCE` and `CAP_SCRIPT_NONCE`) must be used where the host has a strict CSP. Do not add `*`, blanket `unsafe-inline`, or blanket `unsafe-eval` merely to silence CSP errors.

The Cap Standalone CORS allowlist must include the Ecoku admin origin and every site origin that renders the comment Widget. Ecoku does not broaden or remotely manage Cap's CORS settings.

## Server-side recovery path

The recovery path must not depend on the unavailable CAPTCHA or on a browser session. The proposed CLI is:

```text
ecoku-server captcha disable
```

The documented Compose workflow will:

1. stop the Ecoku service so there is no second SQLite writer;
2. make a cold database backup;
3. run the one-shot command with the same configuration and data mount;
4. start Ecoku and check health;
5. log in without a challenge, then repair or switch the provider in the admin UI.

The command transactionally sets verification to `off`, increments the settings revision, preserves both providers' URLs, public keys, and encrypted secrets, checkpoints SQLite, and prints no credentials. A read-only `captcha status` command may report only `off`, `turnstile`, or `cap` plus whether each secret is set.

An environment-variable bypass is intentionally not proposed: it is easy to leave enabled, can mask the stored state, and creates two competing configuration sources.

This recovery command and its operational explanation belong in the self-hosting documentation, not in the production administrator interface.

## Database migration

Runtime implementation requires schema **v6**. The published v1-v5 migration files and history remain unchanged.

The proposed v6 migration performs an in-place, transactional evolution:

1. rename `turnstile_settings` to `captcha_settings` without deleting its single row;
2. add a `provider` column constrained to `turnstile` or `cap`, defaulting to `turnstile` so existing enabled installations remain enabled as Turnstile;
3. retain the existing `enabled`, Turnstile Sitekey, encrypted Secret, revision, and timestamps;
4. add Cap instance URL, Site key, and encrypted Secret columns;
5. append the v6 `schema_migrations` record only after every statement succeeds.

`enabled = 0` represents public mode `off` while the provider value and both providers' credentials remain stored. Migration fixtures must cover both an enabled and disabled v5 Turnstile row. There is no down migration, automatic database replacement, configuration deletion, or backup deletion.

## Security checks required before implementation is accepted

- Cap URL parsing and outbound requests must prevent credential-bearing URLs, query/fragment confusion, redirect-based destination changes, and unintended SSRF to loopback, link-local, metadata, or private network targets. The supported production path is public HTTPS.
- The verifier must use a bounded timeout, bounded response body, explicit JSON content type, no automatic retry of a single-use token, and a strict `success === true` check.
- Admin and public DTOs must expose only the active provider's non-secret data.
- Cap, Turnstile, and generic CAPTCHA tokens must never appear in logs, URLs, cookies, local storage, IndexedDB identity records, or error bodies.
- Existing Turnstile behavior, request limiting, plain-text comment rules, and administrator in-memory sessions remain intact.
- The administrator should test the newly selected provider in a second/private browser session while the current authenticated session remains open. The server CLI remains the final recovery path if the provider later fails or its data is lost.

## Implementation mapping

1. add the v6 migration and migration fixtures;
2. introduce a provider-neutral server package and encrypted settings API;
3. add Cap verification and the stopped-service recovery CLI;
4. update public/login DTOs and generic token handling;
5. integrate both Widget adapters and Cap styles in the client and admin packages;
6. update CSP generation and self-hosting/host-page CSP documentation;
7. update `docs/product/constraints.md`, `docs/operations/self-hosting.md`, the root `README.md`, public examples, and `[Unreleased]` in `CHANGELOG.md`;
8. leave full client/admin/Go verification to Woodpecker CI, while adding the required migration fixtures locally without running the CI-covered suite.
