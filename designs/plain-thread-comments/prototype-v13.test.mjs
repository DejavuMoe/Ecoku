import fs from "node:fs";
import path from "node:path";

const base = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1"));
const html = fs.readFileSync(path.join(base, "index-v13.html"), "utf8");
const css = [
  fs.readFileSync(path.join(base, "styles-v10.css"), "utf8"),
  fs.readFileSync(path.join(base, "styles-v11.css"), "utf8"),
  fs.readFileSync(path.join(base, "styles-v12.css"), "utf8"),
  fs.readFileSync(path.join(base, "styles-v13.css"), "utf8")
].join("\n");
const prototypeSource = fs.readFileSync(path.join(base, "prototype-v13.js"), "utf8");

const checks = [
  [html.includes('href="styles-v13.css"'), "v13 样式入口"],
  [html.includes("prototype-v13.js"), "v13 评论渲染入口"],
  [html.includes('id="reply-template-v8"'), "保留直接回复模板"],
  [html.includes('class="composer-textarea"'), "根评论与回复共用输入框类"],
  [html.includes('class="composer reply-composer reply-composer-v8"'), "回复框复用根评论 composer 外壳"],
  [html.includes('class="identity-grid reply-identity-grid"'), "回复身份行复用根评论字段网格"],
  [html.includes('class="message-field"'), "回复正文使用与根评论相同的输入盒"],
  [html.includes('class="composer-footer reply-toolbar"'), "回复底栏与根评论底栏同结构"],
  [html.includes('rows="7"'), "默认七行高度"],
  [!html.includes('class="reply-heading"'), "回复框不再写回复某某"],
  [html.includes('id="config-timezone"'), "预览可改 IANA 时区"],
  [html.includes('value="Asia/Singapore"'), "默认 Asia/Singapore"],
  [html.includes('id="config-blogger-badge"'), "预览可改博主标志"],
  [html.includes('value="[博主]"'), "默认博主标志为 [博主]"],
  [css.includes("font-size: 20px"), "条数字号加大"],
  [css.includes("gap: 8px"), "排序选项之间有分隔"],
  [css.includes("1.5em * 7"), "评论框默认七行"],
  [css.includes("resize: vertical"), "允许向下拉高"],
  [css.includes("textarea::placeholder"), "占位符单独缩小"],
  [css.includes("text-decoration: underline"), "回复为带下划线的文本"],
  [css.includes("Maple Mono Normal"), "时间使用博客 Maple Mono 栈"],
  [css.includes('content: none'), "去掉折叠方框伪元素"],
  [css.includes(".collapse-placeholder") && css.includes("display: none"), "叶子不再占方框位"],
  [css.includes("width: 16px") && css.includes("min-width: 16px"), "折叠按钮固定等宽"],
  [css.includes("inline-flex") && css.includes("justify-content: center"), "折叠符号居中不抖动"],
  [css.includes(".blogger-badge"), "博主标志样式"],
  [css.includes("#3b6d8c"), "博主标志使用克制区分色"],
  [css.includes("min-height: 32px") && css.includes(".reply-toolbar .primary-button"), "回复按钮高度对齐发布"],
  [prototypeSource.includes('collapsed ? "[+]" : "[-]"'), "折叠为 [+]/[-]"],
  [prototypeSource.indexOf("metaMain.appendChild(time)") < prototypeSource.indexOf('createElement("button", "collapse-button"'), "折叠在时间之后"],
  [prototypeSource.indexOf('createElement("button", "collapse-button"') < prototypeSource.indexOf('folded-summary'), "折叠文案在按钮之后"],
  [prototypeSource.includes("comment-meta-main"), "昵称时间整体居左"],
  [prototypeSource.includes("已折叠 ${replies} 条回复"), "折叠文案跟在按钮后"],
  [prototypeSource.indexOf("folded-summary") < prototypeSource.indexOf('text-action reply-action'), "折叠后隐藏回复动作"],
  [prototypeSource.includes('`@${parent?.author ?? "上级评论"}`'), "深层回复用 @昵称"],
  [html.includes('class="primary-button submit-reply" type="submit">回复</button>'), "回复提交文案为回复"],
  [!html.includes("发布回复"), "回复提交不再写发布回复"],
  [prototypeSource.includes('text-action reply-action'), "回复使用克制文本动作"],
  [!prototypeSource.includes('primary-button reply-action'), "回复不再使用胶囊按钮"],
  [prototypeSource.includes('`${values.year}-${values.month}-${values.day}'), "时间格式为 YYYY-MM-DD"],
  [!prototypeSource.includes("collapse-placeholder"), "不再渲染叶子占位方框"],
  [prototypeSource.includes("timezoneTitle"), "时间悬停为 IANA 加偏移"],
  [prototypeSource.includes('`${timeZone} ${utcOffsetLabel(timeZone)}`'), "英文时区文案格式"],
  [prototypeSource.includes('DEFAULT_TIME_ZONE = "Asia/Singapore"'), "默认服务器时区预览值"],
  [prototypeSource.includes("isBloggerComment"), "博主评论按昵称精确匹配"],
  [prototypeSource.includes("blogger-badge"), "博主标志跟在昵称后"],
  [prototypeSource.includes("settings().bloggerBadge"), "标志文案可配置且可留空"],
  [html.includes('id="config-turnstile-enabled"'), "预览可开关 Turnstile"],
  [html.includes('id="config-turnstile-interact"'), "预览可模拟需要勾选"],
  [html.includes('id="config-turnstile-cleared"'), "预览可模拟 Pre-clearance"],
  [!html.includes('id="config-turnstile-mode"'), "评论区不选择小组件模式"],
  [html.includes('id="root-turnstile"'), "根评论表单有验证槽"],
  [html.includes('class="turnstile-slot"'), "回复表单同样有验证槽"],
  [css.includes(".turnstile-widget"), "小组件外观"],
  [css.includes('data-cleared="true"'), "已有 clearance 时不占布局"],
  [prototypeSource.includes("mountTurnstile"), "按 Cloudflare 判定挂载验证组件"],
  [prototypeSource.includes("turnstileNeedInteraction"), "需要交互时才显示勾选框"],
  [prototypeSource.includes("turnstileCleared"), "Pre-clearance 跳过可见质询"],
  [prototypeSource.includes("请完成验证后再发布"), "未验证时阻止提交"]
];

const failed = checks.filter(([ok]) => !ok);
for (const [ok, label] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
if (failed.length) process.exit(1);
