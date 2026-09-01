# 自訂 CSS 與 Design Tokens

使用標準 CSS 變數自訂評論區樣式。

---

## 核心 Design Tokens

```css
:root {
  --ecoku-theme: rgb(250, 249, 245);
  --ecoku-entry: rgb(252, 251, 247);
  --ecoku-primary: rgb(20, 20, 19);
  --ecoku-secondary: rgb(96, 91, 82);
  --ecoku-content: rgb(58, 54, 44);
  --ecoku-border: rgb(150, 143, 132);
  --ecoku-border-soft: rgba(20, 20, 19, 0.14);
  --ecoku-focus: #0d9488;
}

@media (prefers-color-scheme: dark) {
  :root {
    --ecoku-theme: rgb(26, 29, 32);
    --ecoku-entry: rgb(34, 38, 42);
    --ecoku-primary: rgb(242, 236, 226);
    --ecoku-secondary: rgb(188, 181, 169);
    --ecoku-content: rgb(216, 209, 197);
    --ecoku-border: rgb(109, 114, 120);
    --ecoku-border-soft: rgba(242, 236, 226, 0.14);
    --ecoku-focus: #2dd4bf;
  }
}
```

---

## 3ch 摺疊按鈕等寬保障
`.ecoku-collapse-button` 嚴格使用 `width: 3ch` 與 `font-variant-numeric: tabular-nums`，杜絕摺疊切換時的版面抖動。
