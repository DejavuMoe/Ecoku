# 自定义样式

评论区的外观有三种改法，从少到多：

| 方式 | 怎么做 | 适合 |
| --- | --- | --- |
| 改变量 | 保持默认样式，在博客 CSS 里覆盖 `--ecoku-*` 变量 | 只想调颜色、圆角、字号 |
| 结构样式 | `data-css-url` 指向 `/client/ecoku.unstyled.css` | 保留布局，颜色和装饰自己写 |
| 完全自定义 | `data-css-url="none"` | 所有样式都由博客提供 |

评论区的字体继承博客页面。这些样式只影响评论区，和管理后台无关。

## 改变量

在博客的 CSS 里给 `.ecoku-comments` 写同名变量：

```css
.ecoku-comments {
  --ecoku-accent: #a8412c;
  --ecoku-radius: 8px;
  --ecoku-font-size: 16px;
}
```

默认值写在零优先级的 `:where(.ecoku-comments)` 里，所以你写的规则总会生效，不需要 `!important`，也不用管样式表的加载顺序。

### 明暗模式 {#theme}

`data-theme`（SDK 里是 `theme`）决定评论区的配色：

- `auto`（默认）：评论区读取博客页面上的同名颜色变量，例如 `--theme`、`--primary`（见下表「默认值」一列），博客切换明暗时评论区一起变。博客没有定义这些变量时，按系统的浅色或深色偏好使用内置配色。
- `light` / `dark`：固定使用内置的浅色或深色配色，不读博客的变量。

这些变量名和 Hugo PaperMod 主题一致，所以在 PaperMod 里通常什么都不用设置。博客的明暗切换不靠这些变量的话（比如 VitePress），把 `--ecoku-*` 映射到博客自己的变量，参考 [VitePress 示例](./sdk#vitepress)。

## 变量一览 {#variables}

| 变量 | 默认值 | 用于 |
| --- | --- | --- |
| `--ecoku-theme` | `var(--theme, #f7f4ee)` | 主按钮文字；Cap 复选框底色 |
| `--ecoku-entry` | `var(--entry, #fbf9f5)` | 发表卡片、排序菜单、表情面板、错误提示的底色 |
| `--ecoku-primary` | `var(--primary, #1e1c19)` | 标题、昵称、输入文字、主按钮底色、聚焦下划线 |
| `--ecoku-secondary` | `var(--secondary, #6b655b)` | 时间、字数、字段标签、文字按钮 |
| `--ecoku-content` | `var(--content, #35312b)` | 评论正文与正文输入框 |
| `--ecoku-border` | `var(--border, #cbc3b5)` | 身份字段下划线、次要按钮边框、「回复」下划线；回复连线默认色的基础 |
| `--ecoku-border-soft` | `var(--border-soft, rgb(30 28 25 / 0.12))` | 卡片描边、讨论串分隔线 |
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
| `--ecoku-font-size-title` | `22px`（窄屏 `20px`） | 「N 条评论」标题 |
| `--ecoku-thread-indent` | `22px`（窄屏 `14px`） | 每级回复的缩进，第四级之后不再增加 |
| `--ecoku-thread-line` | `--ecoku-border` 与 `--ecoku-theme` 混合的不透明色 | 回复连线颜色 |
| `--ecoku-thread-line-width` | `2px` | 回复连线粗细 |
| `--ecoku-thread-x` | `6px`（窄屏 `4px`） | 竖线距父评论作者行起点的距离 |
| `--ecoku-thread-gap` | `5px`（窄屏 `3px`） | 拐角末端与回复作者名之间的空隙 |
| `--ecoku-thread-radius` | `8px`（窄屏 `6px`） | 拐角圆角 |

回复连线只画在第二至第四级回复和父评论之间：每条回复用一个圆角拐角连到自己的作者行，后面还有同级回复时竖线才继续往下。更深的回复不再画线，用「@昵称」标明回复对象。

等宽字体只使用页面已经加载的 Maple Mono，Ecoku 不会下载字体。触屏设备上输入框字号至少 16px，避免 iOS 聚焦时放大页面。

## 结构样式

`/client/ecoku.unstyled.css` 只有布局：网格、间距、表情面板、验证组件尺寸、折叠按钮宽度等，以及必要的重置和无障碍规则，没有配色和装饰。

```html
<section
  data-ecoku-comments
  data-css-url="https://ecoku.example.com/client/ecoku.unstyled.css"
  ...
>
```

HTML 加载器会自动插入这个样式表。直接用 SDK 时要自己引入，见 [SDK · 样式](./sdk#styles)。

## 完全自定义

`data-css-url="none"` 时，Ecoku 不注入也不加载任何样式。评论区根元素是 `.ecoku-comments`，所有元素的类名都以 `ecoku-` 开头。建议从 `ecoku.unstyled.css` 开始改，它列出了需要处理的状态（折叠、隐藏、表情面板等）。

写样式时可以参考默认样式的这些约定：

- 回复缩进每级 22px，窄屏（≤ 620px）14px，最多 3 级。元素上的 `--ecoku-depth`（0～3）给出当前层级。
- 折叠按钮 `[+]` / `[-]` 固定宽度 `3ch`，切换时同一行的内容不会移动。
- 昵称、时间、折叠按钮和「回复」在同一行，按基线对齐。
- Turnstile 组件宽度不超过 300px，Cap 组件为 260×58px。
