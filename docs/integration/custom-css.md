# 自定义样式

评论区的样式有三种用法，按改动程度从小到大：

| 方式 | 怎么做 | 适合 |
| --- | --- | --- |
| 默认样式 + 变量 | 不设 `data-css-url`，在博客 CSS 中覆盖 `--ecoku-*` 变量 | 大多数博客，只想调颜色、圆角、字号 |
| 结构样式 | `data-css-url` 指向 `/client/ecoku.unstyled.css` | 想保留布局，颜色和装饰全部自己写 |
| 完全自定义 | `data-css-url="none"` | 所有样式都由博客提供 |

样式只影响评论区，与管理后台无关。评论区的字体继承博客页面。

## 用变量调整默认样式

在博客的 CSS 中，给 `.ecoku-comments` 写同名变量即可：

```css
.ecoku-comments {
  --ecoku-accent: #a8412c;
  --ecoku-radius: 8px;
  --ecoku-font-size: 16px;
}
```

默认值是用零优先级的 `:where(.ecoku-comments)` 声明的，你写的任何 `.ecoku-comments` 规则都会生效，不需要 `!important`，也不受样式表加载顺序影响。

### 明暗模式

`data-theme` 决定评论区如何选择配色：

- **`auto`（默认）**：评论区继承博客页面的 `color-scheme`。颜色变量优先读取博客定义的同名变量（见下表“默认值”一列中的 `var(--theme, …)` 等），所以博客用 `light-dark()` 或切换类名改变这些变量时，评论区会一起变。博客没有定义这些变量时，按系统的浅色/深色偏好使用内置配色。
- **`light` / `dark`**：固定使用内置的浅色或深色配色，不再读取博客的颜色变量。

颜色变量的回退名称与 PaperMod 主题一致，因此在 PaperMod 中通常无需任何设置。

## 变量一览 {#variables}

| 变量 | 默认值 | 用于 |
| --- | --- | --- |
| `--ecoku-theme` | `var(--theme, #f7f4ee)` | 纸面底色；主按钮文字 |
| `--ecoku-entry` | `var(--entry, #fbf9f5)` | 发表卡片、排序菜单、表情面板、错误提示的底色 |
| `--ecoku-primary` | `var(--primary, #1e1c19)` | 标题、昵称、输入文字、主按钮底色、聚焦下划线 |
| `--ecoku-secondary` | `var(--secondary, #6b655b)` | 时间、字数、字段标签、文字按钮 |
| `--ecoku-content` | `var(--content, #35312b)` | 评论正文与正文输入框 |
| `--ecoku-border` | `var(--border, #cbc3b5)` | 身份字段下划线、次要按钮边框、“回复”下划线 |
| `--ecoku-border-soft` | `var(--border-soft, rgb(30 28 25 / 0.12))` | 卡片描边、讨论串分隔线、回复引导线 |
| `--ecoku-surface-muted` | `var(--surface-muted, #efebe3)` | 表情格悬停底色 |
| `--ecoku-code-bg` | `var(--code-bg, #ece7de)` | 默认样式未使用，留给自定义样式 |
| `--ecoku-accent` | 朱砂色 `#c8553a` 与 `--ecoku-primary` 混合 | 博主标志、链接悬停 |
| `--ecoku-danger` | `var(--ecoku-accent)` | 表单错误提示与无效字段 |
| `--ecoku-focus` | `--ecoku-primary` 的 40% 透明度 | 键盘焦点框；设为 `transparent` 可隐藏 |
| `--ecoku-radius` | `6px` | 卡片、菜单、面板、按钮圆角 |
| `--ecoku-radius-sm` | `3px` | 菜单项、表情格、复选框圆角 |
| `--ecoku-shadow` | 浅色双层阴影 | 排序菜单与表情面板 |
| `--ecoku-font-mono` | Maple Mono，回退到系统等宽字体 | 时间、`[+]` / `[-]`、字数、页码 |
| `--ecoku-font-size` | `15px` | 正文与输入框 |
| `--ecoku-font-size-small` | `13px` | 元信息、标签、按钮 |
| `--ecoku-font-size-title` | `22px`（窄屏 `20px`） | “N 条评论”标题 |

等宽字体只使用页面已经加载的 Maple Mono，Ecoku 不会下载字体；没有时依次回退到 `ui-monospace`、`SFMono-Regular`、`Menlo`、`Consolas`。

触屏设备上，输入框字号至少为 16px，以免 iOS 在聚焦时放大页面。

## 结构样式

`/client/ecoku.unstyled.css` 只包含布局：网格、间距、表情面板、验证组件尺寸、折叠按钮宽度等，没有任何颜色、边框、背景，也不使用 `--ecoku-*` 变量。

```html
<section
  data-ecoku-comments
  data-css-url="https://ecoku.example.com/client/ecoku.unstyled.css"
  ...
>
```

使用 HTML 加载器时，它会自动在页面中插入这个样式表的 `<link>`；直接使用 SDK 时需要自己引入，见 [SDK · 样式](./sdk#styles)。

## 完全自定义

`data-css-url="none"` 时，Ecoku 不注入也不加载任何样式。评论区的根元素是 `.ecoku-comments`，所有元素都使用 `ecoku-` 前缀的类名。可以先打开 `ecoku.unstyled.css`，了解结构和需要处理的状态（折叠、隐藏、表情面板等），再在此基础上编写。

## 布局细节

写自定义样式时可以参考默认样式的这些约定：

- 回复缩进：每级 22px，窄屏（≤ 620px）14px，最多 3 级。当前层级通过元素上的 `--ecoku-depth` 变量（0～3）提供。
- 折叠按钮 `[+]` / `[-]` 固定宽度 `3ch`，切换时同一行的内容不会移动。
- 昵称、时间、折叠按钮和“回复”在同一行，按文字基线对齐。
- Turnstile 组件宽度不超过 300px；Cap 组件保持 260×58px。
