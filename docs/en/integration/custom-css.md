# Custom styles

There are three ways to change how the comment section looks, from least to most work:

| Approach | How | Good for |
| --- | --- | --- |
| Variables | Keep the default styles and override `--ecoku-*` variables in your blog's CSS | Adjusting only colors, corner radius and font size |
| Structural styles | Point `data-css-url` to `/client/ecoku.unstyled.css` | Keeping the layout and writing colors and decoration yourself |
| Fully custom | `data-css-url="none"` | All styles provided by your blog |

The comment section inherits its font from your blog page. These styles affect only the comment section, not the admin console.

## Override variables

In your blog's CSS, set variables with the same names on `.ecoku-comments`:

```css
.ecoku-comments {
  --ecoku-accent: #a8412c;
  --ecoku-radius: 8px;
  --ecoku-font-size: 16px;
}
```

The defaults are declared in the zero-specificity `:where(.ecoku-comments)`, so your rules always take effect. You don't need `!important`, and stylesheet load order doesn't matter.

### Light and dark mode {#theme}

`data-theme` (`theme` in the SDK) decides the comment section's colors:

- `auto` (default): the comment section reads color variables of the same name from your blog page, such as `--theme` and `--primary` (see the "Default" column below), so it changes when your blog switches between light and dark. If your blog doesn't define these variables, the built-in colors follow the system's light or dark preference.
- `light` / `dark`: always use the built-in light or dark colors, without reading your blog's variables.

These variable names match the Hugo PaperMod theme, so in PaperMod you usually don't need to set anything. If your blog's light/dark switch doesn't use these variables (VitePress, for example), map `--ecoku-*` to your blog's own variables; see the [VitePress example](./sdk#vitepress).

## Variable reference {#variables}

| Variable | Default | Used for |
| --- | --- | --- |
| `--ecoku-theme` | `var(--theme, #f7f4ee)` | Primary button text; Cap checkbox background |
| `--ecoku-entry` | `var(--entry, #fbf9f5)` | Background of the posting card, sort menu, sticker panel and error messages |
| `--ecoku-primary` | `var(--primary, #1e1c19)` | Headings, names, input text, primary button background, focus underline |
| `--ecoku-secondary` | `var(--secondary, #6b655b)` | Times, character counts, field labels, text buttons |
| `--ecoku-content` | `var(--content, #35312b)` | Comment body and body input |
| `--ecoku-border` | `var(--border, #cbc3b5)` | Identity field underline, secondary button border, **Reply** underline; base of the default reply connector color |
| `--ecoku-border-soft` | `var(--border-soft, rgb(30 28 25 / 0.12))` | Card outline, thread dividers |
| `--ecoku-surface-muted` | `var(--surface-muted, #efebe3)` | Sticker cell hover background |
| `--ecoku-code-bg` | `var(--code-bg, #ece7de)` | Not used by the default styles; reserved for custom styles |
| `--ecoku-accent` | Vermilion `#c8553a` mixed with `--ecoku-primary` | Blogger badge, link hover |
| `--ecoku-danger` | `var(--ecoku-accent)` | Form error messages and invalid fields |
| `--ecoku-focus` | `--ecoku-primary` at 40% opacity | Keyboard focus ring; set to `transparent` to hide it |
| `--ecoku-radius` | `6px` | Corner radius of cards, menus, panels and buttons |
| `--ecoku-radius-sm` | `3px` | Corner radius of menu items, sticker cells and checkboxes |
| `--ecoku-shadow` | Light two-layer shadow | Sort menu and sticker panel |
| `--ecoku-font-mono` | Maple Mono, falling back to the system monospace font | Times, `[+]` / `[-]`, character counts, page numbers |
| `--ecoku-font-size` | `15px` | Body text and inputs |
| `--ecoku-font-size-small` | `13px` | Metadata, labels, buttons |
| `--ecoku-font-size-title` | `22px` (`20px` on narrow screens) | The **N comments** heading |
| `--ecoku-thread-indent` | `22px` (`14px` on narrow screens) | Indent per reply level; stops growing after level four |
| `--ecoku-thread-line` | An opaque mix of `--ecoku-border` and `--ecoku-theme` | Reply connector color |
| `--ecoku-thread-line-width` | `2px` | Reply connector width |
| `--ecoku-thread-x` | `6px` (`4px` on narrow screens) | Distance from the start of the parent's author line to the vertical line |
| `--ecoku-thread-gap` | `5px` (`3px` on narrow screens) | Gap between the end of the elbow and the reply's author name |
| `--ecoku-thread-radius` | `8px` (`6px` on narrow screens) | Elbow corner radius |

Reply connectors are drawn only between a parent and its replies at levels two to four: each reply connects to its own author line with a rounded elbow, and the vertical line continues down only while a later sibling reply follows. Deeper replies draw no line and name the comment they answer with "@name".

"Powered by Ecoku" appears at the bottom right of the comment section once the comment list has loaded; its class is `.ecoku-powered-by`. "Powered by" is lighter than the time and other meta text and "Ecoku" slightly darker; both are derived from `--ecoku-secondary` and `--ecoku-primary` and stay below body-text contrast.

The monospace font uses Maple Mono only if the page has already loaded it; Ecoku doesn't download fonts. On touch devices, input font size is at least 16px, so iOS doesn't zoom the page on focus.

## Structural styles

`/client/ecoku.unstyled.css` contains only layout: grids, spacing, the sticker panel, verification widget sizes, collapse button width and so on, plus the necessary resets and accessibility rules. It has no colors or decoration.

```html
<section
  data-ecoku-comments
  data-css-url="https://ecoku.example.com/client/ecoku.unstyled.css"
  ...
>
```

The HTML loader inserts this stylesheet automatically. When you use the SDK directly, include it yourself; see [SDK · Styles](./sdk#styles).

## Fully custom

With `data-css-url="none"`, Ecoku neither injects nor loads any styles. The comment section's root element is `.ecoku-comments`, and every element's class name starts with `ecoku-`. Start from `ecoku.unstyled.css`; it lists the states you need to handle (collapsed, hidden, sticker panel and so on).

When writing styles, you can follow these conventions from the default styles:

- Replies are indented 22px per level, 14px on narrow screens (≤ 620px), up to 3 levels. `--ecoku-depth` (0 to 3) on the element gives the current level.
- The collapse button `[+]` / `[-]` has a fixed width of `3ch`, so content on the same line doesn't shift when it toggles.
- The name, time, collapse button and **Reply** sit on one line, aligned on the baseline.
- The Turnstile widget is no more than 300px wide; the Cap widget is 260×58px.
