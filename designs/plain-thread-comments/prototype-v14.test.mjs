import fs from "node:fs";
import path from "node:path";

const base = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1"));
const html = fs.readFileSync(path.join(base, "index-v14.html"), "utf8");
const css = fs.readFileSync(path.join(base, "styles-v14.css"), "utf8");
const replySource = fs.readFileSync(path.join(base, "prototype-v14-reply.js"), "utf8");
const stacked = [
  fs.readFileSync(path.join(base, "styles-v9.css"), "utf8"),
  fs.readFileSync(path.join(base, "styles-v14.css"), "utf8")
].join("\n");

const checks = [
  [html.includes('href="styles-v14.css"'), "v14 样式入口"],
  [html.includes("prototype-v13.js"), "沿用 v13 评论渲染"],
  [html.includes("prototype-v14-reply.js"), "v14 回复身份逻辑"],
  [!html.includes("reply-heading-row"), "回复框去掉身份摘要行"],
  [!html.includes("身份回复"), "不再写以某某身份回复"],
  [!html.includes(">更换<"), "不再提供更换入口"],
  [!replySource.includes("identity-change"), "回复脚本不再挂更换"],
  [replySource.includes("grid.hidden = identityIsReady()"), "已有身份时只收起身份格"],
  [html.includes('id="root-turnstile"'), "根评论表单有验证槽"],
  [html.includes('class="turnstile-slot"'), "回复表单同样有验证槽"],
  [html.includes('id="config-turnstile-interact"'), "预览可模拟需要勾选"],
  [css.includes(".field input"), "覆盖身份输入字号"],
  [css.includes("font-size: 12px"), "身份输入与标签同为 12px"],
  [css.includes("color: var(--content)"), "身份输入保持正文色"],
  [css.includes("width: min(100%, 300px)"), "Turnstile 槽不超过 300px"],
  [stacked.includes(".field-label") && stacked.includes("font-size: 12px"), "标签仍为 12px"],
  [!html.includes('id="config-turnstile-mode"'), "评论区不选择小组件模式"]
];

const failed = checks.filter(([ok]) => !ok);
for (const [ok, label] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
if (failed.length) process.exit(1);
