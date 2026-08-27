# 自定义 CSS

未设置 `data-css-url` / `css_url` 时，SDK 向页面**内联**默认评论区样式。只有需要贴合站点设计或完全自控外观时，才改这个选项。

## 选项

| 值 | 行为 |
| --- | --- |
| 不设置 | SDK 内联默认样式 |
| `/client/ecoku.css`（或绝对 URL） | 加载完整样式表；不再内联默认样式 |
| `/client/ecoku.unstyled.css` | 仅布局；颜色与字体由站点提供 |
| `none` 或 `-` | 不加载 Ecoku 样式；站点负责全部 `.ecoku-comments` 样式 |

地址可以是根相对路径或完整 `http(s)` URL。用 UMD 且自行 `<link>` 样式时，初始化须传 `cssURL: 'none'`。

## 外壳样式（可选）

下面的 CSS 只影响加载前外壳、失败状态与重试按钮，不替代评论内容样式：

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

`var(--primary)` 等为 PaperMod 变量；其他主题请换成自己的色值。

## 步骤

1. 把外壳 CSS（如需要）写入主题样式并发布。
2. 在 HTML 设 `data-css-url`，或在 Hugo 设 `css_url`。
3. 使用 `unstyled` 时补充 `.ecoku-comments` 的颜色与边框；使用 `none` 时还要提供布局。
4. 检查浅色、深色、窄屏与失败重试。

接入示例见 [通用 HTML](/integration/html) 与 [Hugo PaperMod](/integration/hugo)。
