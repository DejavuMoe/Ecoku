# Plain thread comments prototype

Approved design history for Ecoku's no-avatar, plain-text comment surface.
`index-v7.html` is the current approved and implemented production baseline.

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
- `examples/hugo-papermod/assets/css/extended/ecoku.css`
- `examples/hugo-papermod/static/js/ecoku-comments.js`

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

Revision 7 is the current approved and implemented baseline. It keeps the
revision 6 form contract and adds compact equal-height thread/leaf controls,
bottom-left reply actions, linked parent mentions, absolute UTC+8 timestamps,
subtle descendant guide lines and reusable root-thread pagination. Run its
deterministic checks with:

```text
node designs/plain-thread-comments/prototype-v7.test.mjs
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

Status: `index-v7.html` was approved on 2026-08-14 and is implemented in the
browser SDK. Earlier revisions remain historical design evidence only.
