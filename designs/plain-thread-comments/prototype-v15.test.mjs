import fs from "node:fs";
import path from "node:path";

const base = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1"));
const html = fs.readFileSync(path.join(base, "index-v15.html"), "utf8");
const css = fs.readFileSync(path.join(base, "styles-v15.css"), "utf8");
const embed = fs.readFileSync(path.join(base, "prototype-v15-embed.js"), "utf8");
const stacked = [
  fs.readFileSync(path.join(base, "styles-v10.css"), "utf8"),
  fs.readFileSync(path.join(base, "styles-v15.css"), "utf8")
].join("\n");

const checks = [
  [html.includes('href="styles-v15.css"'), "v15 样式入口"],
  [html.includes("prototype-v13.js"), "沿用 v13 评论渲染"],
  [html.includes("prototype-v14-reply.js"), "沿用 v14 回复身份逻辑"],
  [html.includes("prototype-v15-embed.js"), "接入外壳状态脚本"],
  [!html.includes("正在加载评论"), "去掉正在加载评论文案"],
  [!html.includes(">正在加载<"), "条数标题不再写正在加载"],
  [html.includes(">0 条评论<"), "条数标题初始为空数量而非加载中"],
  [html.includes('id="loader-fail-toggle"'), "可预览加载失败外壳"],
  [html.includes('id="unconfigured-toggle"'), "可预览尚未配置"],
  [html.includes("评论服务尚未配置。"), "保留尚未配置文案"],
  [html.includes("重新加载评论"), "失败态保留重新加载"],
  [embed.includes("评论服务初始化失败，请稍后重试。"), "失败文案由脚本填入"],
  [!embed.includes("正在加载评论"), "脚本不写加载中文案"],
  [css.includes(".comment-section .composer-textarea"), "评论框提高优先级以覆盖 inherit"],
  [css.includes("font-size: 15px"), "输入与正文同为 15px"],
  [css.includes("line-height: 1.65"), "输入与正文行高一致"],
  [css.includes("color: var(--content)"), "输入与正文同为正文色"],
  [stacked.includes(".comment-copy") && css.includes(".comment-copy"), "与已发布正文共用规则"],
  [html.includes("这篇指南把安装、激活和后续维护拆开以后，查阅起来轻松很多。"), "根评论框预填与正文相同的句子便于对照"]
];

const failed = checks.filter(([ok]) => !ok);
for (const [ok, label] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
if (failed.length) process.exit(1);
