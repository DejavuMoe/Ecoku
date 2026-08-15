import fs from "node:fs";
import path from "node:path";

const base = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1"));
const html = fs.readFileSync(path.join(base, "index-v10.html"), "utf8");
const css = fs.readFileSync(path.join(base, "styles-v10.css"), "utf8");
const prototypeSource = fs.readFileSync(path.join(base, "prototype-v10.js"), "utf8");

const checks = [
  [html.includes('href="styles-v10.css"'), "v10 样式入口"],
  [html.includes("prototype-v10.js"), "v10 评论渲染入口"],
  [html.includes('id="reply-template-v8"'), "保留直接回复模板"],
  [html.includes('class="composer-textarea"'), "根评论与回复共用输入框类"],
  [html.includes('rows="7"'), "默认七行高度"],
  [!html.includes('class="reply-heading"'), "回复框不再写回复某某"],
  [html.includes('id="config-timezone"'), "预览可改 IANA 时区"],
  [html.includes('value="Asia/Singapore"'), "默认 Asia/Singapore"],
  [css.includes("font-size: 20px"), "条数字号加大"],
  [css.includes("gap: 8px"), "排序选项之间有分隔"],
  [css.includes("1.5em * 7"), "评论框默认七行"],
  [css.includes("resize: vertical"), "允许向下拉高"],
  [css.includes("textarea::placeholder"), "占位符单独缩小"],
  [css.includes("text-decoration: underline"), "回复为带下划线的文本"],
  [css.includes("Maple Mono Normal"), "时间使用博客 Maple Mono 栈"],
  [!css.includes("margin-inline-start: auto"), "回复不贴右对齐"],
  [css.includes('content: none'), "去掉折叠方框伪元素"],
  [css.includes(".collapse-placeholder") && css.includes("display: none"), "叶子不再占方框位"],
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
  [prototypeSource.includes('DEFAULT_TIME_ZONE = "Asia/Singapore"'), "默认服务器时区预览值"]
];

const failed = checks.filter(([ok]) => !ok);
for (const [ok, label] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
if (failed.length) process.exit(1);
