# Custom styles

There are three ways to style the comment section, from the smallest change to the largest:

| Approach | How | Good for |
| --- | --- | --- |
| Default styles + variables | Leave `data-css-url` unset and override `--ecoku-*` variables in your blog's CSS | Most blogs that only want to adjust colors, corner radius, and font size |
| Structural styles | Point `data-css-url` to `/client/ecoku.unstyled.css` | Keeping the layout while writing all colors and decoration yourself |
| Fully custom | `data-css-url="none"` | All styles provided by your blog |

Styles affect only the comment section, not the admin console. The comment section inherits its font from your blog page.

## Adjust the default styles with variables

In your blog's CSS, set variables with the same names on `.ecoku-comments`:

```css
.ecoku-comments {
  --ecoku-accent: #a8412c;
  --ecoku-radius: 8px;
  --ecoku-font-size: 16px;
}
```

The defaults are declared with the zero-specificity `:where(.ecoku-comments)`, so any `.ecoku-comments` rule you write takes effect. You do not need `!important`, and stylesheet load order does not matter.

### Light and dark mode

`data-theme` decides how the comment section picks its colors:

- **`auto` (default)**: the comment section inherits the blog page's `color-scheme`. Color variables first read the blog's variables of the same name (see `var(--theme, …)` and so on in the "Default" column below), so when your blog changes those variables with `light-dark()` or by toggling a class, the comment section changes too. If your blog does not define them, the built-in colors are used according to the system's light/dark preference.
- **`light` / `dark`**: always use the built-in light or dark colors, and stop reading the blog's color variables.

The fallback names of the color variables match the PaperMod theme, so in PaperMod you usually do not need to set anything.

## Variable reference {#variables}

| Variable | Default | Used for |
| --- | --- | --- |
| `--ecoku-theme` | `var(--theme, #f7f4ee)` | Paper background; primary button text |
| `--ecoku-entry` | `var(--entry, #fbf9f5)` | Background of the posting card, sort menu, sticker panel, and error messages |
| `--ecoku-primary` | `var(--primary, #1e1c19)` | Headings, nicknames, input text, primary button background, focus underline |
| `--ecoku-secondary` | `var(--secondary, #6b655b)` | Times, character counts, field labels, text buttons |
| `--ecoku-content` | `var(--content, #35312b)` | Comment body and body input |
| `--ecoku-border` | `var(--border, #cbc3b5)` | Identity field underline, secondary button border, "Reply" (回复) underline |
| `--ecoku-border-soft` | `var(--border-soft, rgb(30 28 25 / 0.12))` | Card outline, thread dividers, reply guide lines |
| `--ecoku-surface-muted` | `var(--surface-muted, #efebe3)` | Sticker cell hover background |
| `--ecoku-code-bg` | `var(--code-bg, #ece7de)` | Not used by the default styles; reserved for custom styles |
| `--ecoku-accent` | Vermilion `#c8553a` mixed with `--ecoku-primary` | Blogger badge, link hover |
| `--ecoku-danger` | `var(--ecoku-accent)` | Form error messages and invalid fields |
| `--ecoku-focus` | `--ecoku-primary` at 40% opacity | Keyboard focus ring; set to `transparent` to hide it |
| `--ecoku-radius` | `6px` | Corner radius of cards, menus, panels, and buttons |
| `--ecoku-radius-sm` | `3px` | Corner radius of menu items, sticker cells, and checkboxes |
| `--ecoku-shadow` | Light two-layer shadow | Sort menu and sticker panel |
| `--ecoku-font-mono` | Maple Mono, falling back to the system monospace font | Times, `[+]` / `[-]`, character counts, page numbers |
| `--ecoku-font-size` | `15px` | Body text and inputs |
| `--ecoku-font-size-small` | `13px` | Metadata, labels, buttons |
| `--ecoku-font-size-title` | `22px` (`20px` on narrow screens) | The "N comments" (N 条评论) heading |

The monospace font uses Maple Mono only if the page has already loaded it; Ecoku does not download fonts. Without it, the font falls back to `ui-monospace`, `SFMono-Regular`, `Menlo`, and `Consolas`, in that order.

On touch devices, input font size is at least 16px, so iOS does not zoom the page on focus.

## Structural styles

`/client/ecoku.unstyled.css` contains layout only: grid, spacing, the sticker panel, verification widget size, collapse button width, and so on. It has no colors, borders, or backgrounds, and does not use `--ecoku-*` variables.

```html
<section
  data-ecoku-comments
  data-css-url="https://ecoku.example.com/client/ecoku.unstyled.css"
  ...
>
```

With the HTML loader, a `<link>` to this stylesheet is inserted into the page automatically. When you use the SDK directly, include it yourself. See [SDK · Styles](./sdk#styles).

## Fully custom

With `data-css-url="none"`, Ecoku neither injects nor loads any styles. The root element of the comment section is `.ecoku-comments`, and all elements use class names prefixed with `ecoku-`. Start by opening `ecoku.unstyled.css` to learn the structure and the states you need to handle (collapsed, hidden, sticker panel, and so on), then build on it.

## Layout details

When you write custom styles, you can follow these conventions of the default styles:

- Reply indentation: 22px per level, 14px on narrow screens (≤ 620px), at most 3 levels. The current level is provided by the `--ecoku-depth` variable (0 to 3) on the element.
- The collapse buttons `[+]` / `[-]` have a fixed width of `3ch`, so the content on the same line does not move when toggling.
- Nickname, time, collapse button, and "Reply" (回复) are on the same line, aligned on the text baseline.
- The Turnstile widget is no wider than 300px; the Cap widget stays at 260×58px.
