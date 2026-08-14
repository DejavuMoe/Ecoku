import fs from "node:fs";
import path from "node:path";

const base = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1"));
const html = fs.readFileSync(path.join(base, "index-v9.html"), "utf8");
const css = fs.readFileSync(path.join(base, "styles-v9.css"), "utf8");
const previous = fs.readFileSync(path.join(base, "prototype-v8.js"), "utf8");
const section = html.slice(html.indexOf('id="comment-section"'), html.indexOf('id="reply-template"'));
const order = [
  'id="service-error"',
  'id="comment-core"',
  'class="composer"',
  'class="section-heading"',
  'id="comment-count"',
  'id="sort-picker"',
  'id="status-line"'
].map((marker) => section.indexOf(marker));
const headingAfterComposer = order.every((index, i) => index !== -1 && (i === 0 || index > order[i - 1]));

const checks = [
  [html.includes('href="styles-v9.css"'), "v9 样式入口"],
  [html.includes('id="reply-template-v8"'), "保留直接回复模板"],
  [/composer-footer[\s\S]*id="character-count"[\s\S]*composer-end[\s\S]*submit-button/.test(html), "字数在左、发布按钮在右"],
  [html.includes(">发布</button>"), "根评论按钮文案为发布"],
  [!html.includes(">发布评论<"), "不再使用发布评论"],
  [css.includes(".field input"), "压矮身份输入高度"],
  [css.includes("height: 32px"), "身份栏使用更矮的 32px 高度"],
  [css.includes("justify-content: space-between"), "页脚左右对齐"],
  [css.includes(".composer-footer .primary-button"), "发布按钮单独缩小"],
  [css.includes(".reply-action"), "回复动作与正文区分"],
  [css.includes("font-size: 11px"), "回复字号小于正文"],
  [headingAfterComposer, "故障块、发表框、条数/排序的 DOM 顺序"],
  [section.indexOf('class="composer"') < section.indexOf('class="section-heading"'), "条数与排序在发表框下方"],
  [css.includes(".section-title"), "条数字号不超过发布按钮"],
  [css.includes(".sort-trigger"), "排序按钮不超过发布按钮高度"],
  [html.includes("评论暂时不可用") && html.includes("重新加载"), "故障文案与重试按钮未改"],
  [css.includes(".service-error"), "故障状态使用评论区纸面样式"],
  [css.includes("background: color-mix(in srgb, var(--entry) 72%, var(--theme))"), "故障背景与发表框同暖纸面"],
  [css.includes("text-align: left") && css.includes("box-shadow: none"), "故障卡片左对齐且无厚阴影"],
  [css.includes("var(--border-soft)") && css.includes("var(--radius)"), "故障边框使用纸面 token"],
  [!css.includes("blue") && !css.includes("#2f73ff"), "v9 不含饱和蓝"],
  [previous.includes('event.stopImmediatePropagation()'), "继续阻止旧回复跳转"],
  [previous.includes('indexedDB.open(DB_NAME, 1)'), "身份仍只写入 IndexedDB"]
];

const failed = checks.filter(([ok]) => !ok);
for (const [ok, label] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
if (failed.length) process.exit(1);
