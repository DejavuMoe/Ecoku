# Plain thread comments prototype

Approved design history for Ecoku's no-avatar, plain-text comment surface.
`index-v17.html` is the current approved production baseline: it keeps v16's
behavior (including the off / Turnstile / self-hosted Cap choice) and restyles the
default surface in the paper-and-ink language of the Hugo blog, with overridable
tokens and a colour scheme inherited from the host. `index-v16.html` remains the
previous approved baseline.

## Direction

- Twikoo-like identity row: nickname, email, optional website.
- Hacker News-like discussion density: muted metadata, whitespace indentation,
  inline reply links, and compact [-] / [+] thread collapse controls.
- No avatar, reactions, Markdown toolbar, preview mode, rich media, or comment
  cards.
- User comment content is inserted with textContent. HTML and Markdown remain
  visible plain text and are never interpreted as markup.
- Deleted comments keep a small tombstone so descendant replies retain context.
- Top-level sorting does not detach replies from their parent thread.

## Production binding

The production browser SDK is mapped in `ui-contract.json`. Revision 2 makes the
Hugo host page authoritative for typography and color: the comment root inherits
the parent font and maps its component tokens to PaperMod's `--theme`, `--entry`,
`--primary`, `--secondary`, `--content`, `--border`, `--border-soft`, and
`--surface-muted` variables. It does not import Blog paths into the SDK.

Tracked integration references:

- `examples/hugo-papermod/layouts/_partials/comments.html`
- `examples/hugo-papermod/assets/css/extended/ecoku.css`（可选，仅加载前外壳）
- the runtime-hosted `/client/ecoku-loader.js` and `/client/ecoku.umd.js`

Revision 2 replaced the heavy global focus ring with field-local focus
treatment, changed the near-black submit button to a paper-surface action,
shortened the composer guidance to “纯文本，邮箱不会公开。”, and replaced the
browser-native sort popup with a keyboard-operable themed menu.

Revision 3 is the approved current direction:

- the heading contains only the dynamic “xx 条评论” count;
- sorting uses the concise “最新评论” and “最早评论” labels;
- each root thread owns one full-width divider while child comments rely on
  indentation and spacing;
- comment spacing is compact enough for long threads without becoming crowded;
- the standalone “链接” label is removed while the timestamp remains the
  comment permalink;
- a visitor nickname becomes an external link only when its website uses an
  allowed `http` or `https` URL, with `nofollow ugc noopener noreferrer`;
- semantic nesting reaches six levels while visual indentation stops after the
  third step; levels four through six retain an explicit parent label;
- deterministic fixtures provide 54 records: 52 approved public comments in
  12 complete root threads, plus one pending and one rejected non-public record;
- pagination reveals complete root threads in three batches rather than cutting
  a reply tree in the middle.

Revision 3 files are split for easier review:

- `index-v3.html` — stable HTML shell;
- `styles-v3.css` — Hugo-aligned component and responsive styles;
- `fixtures-v3.js` — sanitized deterministic data covering depths one to six;
- `prototype-v3.js` — rendering and interaction behavior;
- `prototype-v3.test.mjs` — dependency-free fixture and static contract tests.

Run the deterministic checks with:

```text
node designs/plain-thread-comments/prototype-v3.test.mjs
```

Revision 4 retains that thread behavior and defines the production form
configuration contract:

- nickname and comment content are always required;
- email and website requirements are selected per registered site;
- the requirement summary updates without adding “可选” inside an input;
- the textarea placeholder is configurable with the approved fallback;
- the compact privacy copy is “邮箱不会公开；留下后便于站长联系。”;
- optional blank values are omitted while malformed non-empty values remain invalid.

Revision 5 is a review candidate that keeps the approved revision 4 form and
changes only the newly confirmed sorting and collapse details:

- the redundant visible “排序” label is removed while the trigger keeps an
  accessible “评论排序：…” name;
- the site default shown on first load is “最新评论”, while visitors may still
  switch to “最早评论”;
- expanded and collapsed controls use the same 29 × 29 geometry and matching
  monospace bracket/operator proportions.

Run its checks with:

```text
node designs/plain-thread-comments/prototype-v5.test.mjs
```

Revision 6 is the approved predecessor to revision 7. It incorporates the detailed form,
thread-density and empty-page feedback without changing the approved plain-text
thread model:

- removes the requirement summary and privacy guidance from the public form;
- places “回复” immediately after the timestamp and further tightens vertical
  spacing while preserving root-thread dividers;
- previews a per-site comment limit from 1 through 10000, defaulting to 1000,
  with Unicode code-point counting so a CJK character counts as one;
- previews a per-site two-line empty-state message directly below the composer,
  with no card, border, background or decoration.

Run its checks with:

```text
node designs/plain-thread-comments/prototype-v6.test.mjs
```

Revision 7 keeps the revision 6 form contract and adds compact equal-height
thread/leaf controls, bottom-left reply actions, linked parent mentions,
absolute UTC+8 timestamps, subtle descendant guide lines and reusable
root-thread pagination. Run its deterministic checks with:

```text
node designs/plain-thread-comments/prototype-v7.test.mjs
```

Revision 8 is the current approved and implemented baseline. It keeps revision
7's thread density and pagination, and fixes the visitor reply flow:

- selecting “回复” opens an inline identity-and-content composer on that exact
  comment, so an unidentified visitor cannot accidentally create a root comment;
- root and reply composers share one identity, while every reply still submits
  the selected parent ID;
- a successful submission stores the identity for seven days in encrypted
  IndexedDB data scoped to the Ecoku server and site;
- no “记住我” checkbox or clear button is shown, and localStorage, cookies and
  URLs never receive the private identity;
- switching away from a non-empty reply draft requires confirmation.

Run its checks with:

```text
node designs/plain-thread-comments/prototype-v8.test.mjs
```

Revision 9 is the current approved visual tightening of revision 8
composer, list chrome and service error. Behavior is unchanged:

- nickname, email and website fields use a shorter 32px control height;
- the root composer places the character count on the left edge of the
  comment box, still on the same row as the publish button;
- the root submit label is “发布”, with a smaller pill button;
- “回复” is smaller and more muted than comment body copy;
- the comment count sits left below the composer, and the sort control sits
  right below the publish button; both stay within the 32px / 12px publish size;
- the service-unavailable block uses the same warm paper surface and thin
  soft border as the composer, with no saturated info tint.

Run its checks with:

```text
node designs/plain-thread-comments/prototype-v9.test.mjs
```

Revision 10 is the approved production baseline on top of revision 9. It keeps the compact composer
and count/sort placement, and changes thread chrome:

- “xx 条评论” uses a larger heading size while the sort trigger stays 32px;
- the sort menu separates “最新评论” and “最早评论”;
- root and reply textareas share a seven-line default height, smaller
  placeholder type, and vertical resize;
- the inline reply composer has no “回复某某” heading; identity summary and
  “更换” remain when a saved identity is present;
- thread collapse is a Hacker News-like `[+]` / `[-]` after the timestamp, with no
  square controls and no leaf placeholder; when folded, `已折叠 N 条回复`
  follows the toggle and the reply action is hidden;
- “回复” is a quiet underlined text action in the same meta flow, not a pill
  button and not pinned to the far right; meta items share an 8px gap and
  baseline alignment; nested parent hints use `@昵称` so they are not confused
  with the reply action;
- the inline reply composer submit label is “回复”, matching the header action;
- timestamps use `YYYY-MM-DD HH:mm` in Maple Mono (falling back to system
  monospace); hover text is English IANA plus offset, for example
  `Asia/Singapore UTC+8`. Production should read the container `TZ` (Compose
  default = server timezone).

Run its checks with:

```text
node designs/plain-thread-comments/prototype-v10.test.mjs
```

Revision 11 is the approved production baseline on top of revision 10:

- the inline reply composer reuses the root comment card: same 16px padding,
  14px radius, identity field grid, message-field textarea, and footer with the
  character count on the left; 取消 and 回复 are the same 32px pills as 发布;
- `[+]` / `[-]` share a fixed 16px width so toggling does not shift the meta row;
- comments whose nickname exactly matches the configured blogger show a
  customizable badge after the name, default `[博主]`, with a quiet teal; an empty
  badge hides the mark. Public pages never show the blogger email.

Run its checks with:

```text
node designs/plain-thread-comments/prototype-v11.test.mjs
```

Revision 16 is the approved CAPTCHA-provider layer on top of revision 15:

- the server selects off, Cloudflare Turnstile, or self-hosted Cap for both root and reply composers;
- Cap keeps the official 260 × 58px geometry, 14px radius, 25px checkbox, SVG progress/success/error states, and lower-right credit;
- only Ecoku color tokens and the inherited host font are customized;
- unverified or failed challenges block submission, and a consumed token resets after every attempted request;
- provider/failure controls remain prototype-only.

Run its checks with:

```text
node designs/plain-thread-comments/prototype-v16.test.mjs
```

Revision 17 is the approved production baseline. It restyles the default surface in the
paper-and-ink language of the Hugo blog. Behavior, copy, thread density and the
approved interaction model are unchanged:

- `styles-v17.css` is standalone and mirrors the production sheet section by section;
  it no longer layers overrides on the v3–v16 chain;
- default tokens are declared at zero specificity (`:where()`), so a host rule on the
  comment root always wins; colours still fall back from the PaperMod names;
- `auto` no longer declares `color-scheme`, so host `light-dark()` tokens follow the
  host's manual toggle instead of the operating system; only forced `light` / `dark`
  declare a scheme;
- new tokens: accent, danger, radius (6px / 3px), shadow, mono font and a three-step
  type scale (13 / 15 / 22px, title 20px on narrow screens); the default cinnabar accent
  is mixed with the ink colour so it darkens on paper and lightens in dark mode;
- the composer is one sheet: identity fields become ruled lines that darken to ink on
  focus, and the seven-line textarea sits directly on the sheet with no inner box;
- one solid ink action (发布 / 回复); 表情, 预览 and 取消 are quiet text buttons; the
  sort control is a text trigger with a hairline menu; hover only changes text colour;
- the blogger badge, link hovers and form errors use the accent; timestamps, fold
  toggles, the character count and page status use the mono font;
- descendant guides become solid hairlines, the deleted tombstone drops synthesized
  italics, and the preview reads as a quoted block;
- Cap keeps its official 260 × 58px geometry and follows only the radius and colour
  tokens; touch devices type at 16px or larger to avoid iOS focus zoom;
- the prototype adds the production 表情 and 预览 tools using local fixtures only.

Run its checks with:

```text
node designs/plain-thread-comments/prototype-v17.test.mjs
```

## Review states

- Light and dark themes.
- Empty/ready composer validation.
- Plain-text top-level comment and reply insertion.
- Nested thread collapse and expansion.
- Oldest/newest top-level sorting.
- Root-thread previous/next pagination.
- Service unavailable and retry recovery.
- Desktop at 1280x900 and mobile at 390x844.

Status: `index-v17.html` is the approved production comment baseline and is bound
to `packages/client/src/style.css`. Preview-only
provider/failure toggles must not enter the SDK; production reads the provider from
the server's public form configuration.
