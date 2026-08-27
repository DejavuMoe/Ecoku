# Custom CSS

Without `data-css-url` / `css_url`, the SDK **inlines** the default comment styles into the page. Change this option only when you need to match the site design or fully control appearance.

## Options

| Value | Behavior |
| --- | --- |
| Unset | SDK inlines default styles |
| `/client/ecoku.css` (or absolute URL) | Loads the full stylesheet; default styles are not inlined |
| `/client/ecoku.unstyled.css` | Layout only; colors and fonts come from the site |
| `none` or `-` | Loads no Ecoku styles; the site owns all `.ecoku-comments` styling |

The address may be root-relative or a full `http(s)` URL. With UMD and your own `<link>` stylesheet, initialization must pass `cssURL: 'none'`.

## Shell styles (optional)

The CSS below only affects the pre-load shell, failure state, and retry button—not comment content styles:

```css
.ecoku-shell {
  margin-top: 2.75rem;
  min-height: 8rem;
}

.ecoku-loader {
  padding: 1.25rem 0;
  color: var(--secondary);
}

.ecoku-loader-status {
  margin: 0;
}

.ecoku-loader-retry {
  margin-top: 0.75rem;
  padding: 0.55rem 0.9rem;
  border: 1px solid var(--tertiary);
  border-radius: 0.4rem;
  color: var(--primary);
  background: var(--entry);
  cursor: pointer;
  font: inherit;
}

.ecoku-loader-retry:hover {
  border-color: var(--secondary);
}

.ecoku-loader-retry:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 3px;
}

.ecoku-loader-retry[hidden],
.ecoku-loader[hidden] {
  display: none;
}

@media (max-width: 640px) {
  .ecoku-shell {
    margin-top: 2rem;
  }
}
```

`var(--primary)` and similar are PaperMod variables; other themes should use their own colors.

## Steps

1. Put the shell CSS (if needed) into the theme styles and publish.
2. Set `data-css-url` in HTML, or `css_url` in Hugo.
3. With `unstyled`, add colors and borders for `.ecoku-comments`; with `none`, also provide layout.
4. Check light, dark, narrow viewports, and failure retry.

Integration samples: [Plain HTML](/en/integration/html) and [Hugo PaperMod](/en/integration/hugo).
