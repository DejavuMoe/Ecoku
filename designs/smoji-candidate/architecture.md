# Ecoku Smoji architecture

Status: **approved adjunct**. Production implementation remains limited to
the Smoji controls and contracts described here; it does not authorize other
comment or administration design changes.

## 1. Product boundary

Smoji is an optional per-site presentation feature. Ecoku does not bundle packs,
proxy images, upload stickers, maintain a pack marketplace, or turn comments into
general rich text.

When enabled, the site configuration contains one public `manifestUrl`. The browser
loads that URL only when a visitor first opens a picker. Pack images remain on the
operator-selected origin. HTML and ordinary Markdown in comments remain literal text.

Disabling Smoji removes picker triggers and renders stored Smoji markers as literal
text. It also prevents new Smoji markers from being accepted for that site.

## 2. Site configuration and public API

Proposed persisted site fields:

```text
smoji_enabled      boolean not null default false
smoji_manifest_url text not null default ''
```

The public comment-list response adds only:

```json
{
  "formConfig": {
    "smoji": {
      "enabled": true,
      "manifestUrl": "https://cdn.example.test/ecoku/smoji.json"
    }
  }
}
```

The URL is public by design. It must never contain credentials, tokens, cookies, or
other secrets. The server does not fetch it, which keeps an operator-provided URL out
of the server-side request path and avoids introducing an SSRF surface. Admin save validation accepts absolute
HTTPS URLs; HTTP is allowed only for loopback development hosts. Query strings and
fragments are rejected so operators cannot accidentally publish bearer material.

## 3. `smoji.json` v1

V1 is one document: no catalog indirection, HTML fragments, CSS class names,
regular expressions, template strings, or executable fields.

```json
{
  "version": 1,
  "packs": [
    {
      "id": "cats",
      "label": "猫猫",
      "items": [
        {
          "id": "wave",
          "label": "挥手",
          "src": "./cats/wave.webp"
        }
      ]
    }
  ]
}
```

Contract:

- top-level keys: `version`, `packs`;
- pack keys: `id`, `label`, `items`;
- item keys: `id`, `label`, `src`;
- IDs match `^[a-z0-9][a-z0-9_-]{0,63}$` and are unique in their scope;
- labels contain 1–40 Unicode code points and are always inserted with `textContent`;
- `src` is relative to the manifest or an absolute URL with the same origin;
- no more than 32 packs, 300 items per pack, or 2,000 items total;
- the decoded response is at most 256 KiB and must be JSON, not JSONP;
- unknown keys reject the document in v1 instead of silently changing behavior.

Same-origin assets keep the server-side trust rule small. A future version may add
an explicit asset-origin allowlist, but v1 does not infer trust from manifest data.

## 4. Stored comment marker

Selecting an item inserts a self-contained, version-1 marker at the textarea caret:

```text
![smoji:挥手](https://cdn.example.test/ecoku/cats/wave.webp)
```

The URL is resolved to an absolute URL before insertion. This deliberately stores
the selected direct link instead of only `:pack/item:` so historical comments do not
depend on a mutable manifest retaining every ID forever.

The marker grammar is intentionally narrower than Markdown:

```text
![smoji:<label>](<absolute-url>)
```

- label: 1–40 code points; `]`, control characters, and newlines are forbidden;
- URL: absolute HTTPS (or loopback HTTP in development), no credentials, fragment,
  whitespace, `(`, or `)`; at most 2,048 code points;
- URL origin must equal the configured manifest origin;
- the full marker counts toward the existing comment length limit;
- malformed or disallowed markers make submission fail with a content error.

This is not a general Markdown renderer. Text outside recognized markers becomes text
nodes. A recognized marker becomes an `img` created through DOM APIs with an empty
decorative `alt`, an accessible wrapper named from the label, `loading="lazy"`,
`decoding="async"`, and `referrerpolicy="no-referrer"`. `innerHTML` is never used.

The server must apply the same parser on submission so a custom client cannot inject
an arbitrary tracking origin. Admin comment management and notification bodies use
`[表情：挥手]`, never remote HTML or embedded images.

## 5. Browser loading lifecycle

1. Comment list loads normally. If Smoji is disabled, no trigger or network request exists.
2. If enabled, root and dynamically created reply composers receive a picker trigger.
3. The first trigger activation starts one deduplicated manifest request per SDK instance.
4. Fetch uses CORS, `credentials: "omit"`, `referrerPolicy: "no-referrer"`, an 8-second
   timeout, response-size limit, and strict v1 validation.
5. The picker renders only the active pack. Switching packs replaces the grid.
6. Selecting an item inserts at the current selection, dispatches `input`, returns focus
   to the textarea, and closes the panel.
7. Parsed data is cached only in memory. Normal HTTP caching headers remain effective;
   Ecoku does not add localStorage, IndexedDB, cookies, or a service worker cache.
8. Destroying Ecoku aborts pending requests and removes all picker listeners and DOM.

Loading and validation errors stay inside the picker with a retry action. Comment input,
plain-text rendering, captcha, submission, sorting, and pagination remain usable.

## 6. Privacy, availability, and operator responsibility

Direct loading means the manifest and image host can observe visitor IP address, request
time, and browser network metadata. `no-referrer` suppresses the article URL but cannot
hide the connection itself. The admin UI must say this plainly and recommend an origin
controlled by the site operator.

Ecoku does not guarantee third-party pack availability, content stability, licensing,
or cache behavior. Operators are responsible for permission to use the assets. Changing
the manifest origin can make old markers invalid; the UI should warn before saving such
a change. A remote manifest cannot run script or supply HTML, but it can still change
which images visitors see in the picker.

## 7. Deliberate exclusions for v1

- bundled packs or images;
- server-side fetching, proxying, transcoding, or caching;
- OwO compatibility or conversion;
- search, favorites, recent items, upload, reactions, or management previews;
- arbitrary asset origins, per-pack URLs, nested categories, custom item sizes, or CSS;
- rendering Smoji in email or Telegram notifications.

## 8. Expected implementation scope after approval

- transactional SQLite migration for the two site fields;
- site admin DTO/validation and site form controls;
- public form configuration and submit-time marker validation;
- client loader/parser, root and reply picker lifecycle, safe segmented rendering;
- approved-prototype regression tests plus server/client behavior tests;
- internal constraints, self-hosting, integration, locale, examples, changelog, and
  deployment-contract documentation updates required by repository policy.
