import fs from "node:fs";
import path from "node:path";

const base = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1"));
const html = fs.readFileSync(path.join(base, "index-v18.html"), "utf8");
const css = fs.readFileSync(path.join(base, "styles-v18.css"), "utf8");
const v17 = fs.readFileSync(path.join(base, "styles-v17.css"), "utf8");
const source = fs.readFileSync(path.join(base, "prototype-v18-tree.js"), "utf8");

const block = (selector) => {
  let start = css.indexOf(`\n${selector} {`);
  while (start > 0 && css[start - 1] === ",") start = css.indexOf(`\n${selector} {`, start + 1);
  if (start < 0) return "";
  return css.slice(start + 1, css.indexOf("}", start) + 1);
};

const tokens = block(":where(.comment-section)");
const levels = '[data-depth="2"], [data-depth="3"], [data-depth="4"]';
const elbow = block(`.children > .comment-node:is(${levels})::before`);
const trunk = block(`.children > .comment-node:is(${levels}):not(:last-child)::after`);
const shared = css.slice(css.indexOf(`.children > .comment-node:is(${levels})::before,`));

const checks = [
  [html.includes('data-design-status="approved"'), "v18 标为已批准基线"],
  [html.includes('href="styles-v18.css"') && html.includes('src="prototype-v18-tree.js"'), "v18 样式与嵌套脚本入口"],
  [html.indexOf("prototype-v17-paper.js") < html.indexOf("prototype-v18-tree.js"), "沿用 v17 交互，只叠加树形嵌套"],

  [tokens.includes("--ecoku-thread-indent: 22px") && tokens.includes("--ecoku-thread-radius: 8px"), "缩进与拐角半径是可覆盖令牌"],
  [tokens.includes("--ecoku-thread-line: color-mix(in oklab, var(--ecoku-border) 62%, var(--ecoku-theme))"), "连线色由不透明令牌混合，重叠处不加深"],
  [/max-width: 620px\)[\s\S]*?--ecoku-thread-indent: 14px/.test(css), "窄屏缩进收为 14px"],

  [!css.includes("--guide-offset") && !css.includes("> .comment-row::before"), "移除 v17 整段竖向引导线"],
  [css.includes('.comment-node:not([data-depth="1"], [data-depth="2"], [data-depth="3"]) > .comment-row { padding-inline-start: calc(var(--ecoku-thread-indent) * 3); }'), "视觉缩进止于第四级"],
  [!/\.comment-node\[data-depth="\d"\] \.comment-row/.test(css), "缩进只作用于自身行，不误伤嵌套后代"],
  [!/data-depth="5"/.test(css), "第五级及更深不画连线"],

  [elbow.includes("border-bottom:") && elbow.includes("border-end-start-radius: var(--ecoku-thread-radius)"), "圆角拐角连到作者行"],
  [elbow.includes("calc(6px + 23px"), "拐角落在 22px 作者行中线"],
  [trunk.includes("top: 0") && trunk.includes("bottom: 0"), "仅在后面还有同级回复时主干继续"],
  [shared.includes("calc(var(--thread-step) * var(--ecoku-thread-indent) + var(--ecoku-thread-x))"), "竖线落在父级作者行起点"],
  [block(".deleted > .comment-row .comment-author,\n.deleted > .comment-row .comment-copy").includes("color: var(--ecoku-secondary)"), "删除占位的灰字不传染到子回复"],

  [source.includes('children.className = "children"') && source.includes("observe(list, { childList: true })"), "原型按生产结构嵌套 .children"],
  [source.includes("focused.focus({ preventScroll: true })"), "嵌套后还原键盘焦点（折叠按钮）"],
  [!source.includes("fetch(") && !/localStorage|sessionStorage|indexedDB|document\.cookie/.test(source), "嵌套脚本不访问网络、不持久化"],
  [v17.includes("--guide-offset"), "v17 已批准基线保持不变"]
];

let failed = false;
for (const [ok, label] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
