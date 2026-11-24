import fs from "node:fs";
import path from "node:path";

const base = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1"));
const html = fs.readFileSync(path.join(base, "index-v19.html"), "utf8");
const css = fs.readFileSync(path.join(base, "styles-v19.css"), "utf8");
const v18 = fs.readFileSync(path.join(base, "styles-v18.css"), "utf8");

const block = (selector) => {
  const start = css.indexOf(`\n${selector} {`);
  if (start < 0) return "";
  return css.slice(start + 1, css.indexOf("}", start) + 1);
};
const credit = block(".powered-by");

const checks = [
  [html.includes('href="styles-v19.css"'), "原型使用 v19 样式"],
  [/<p class="powered-by">Powered by <a href="https:\/\/ecoku\.zsh\.moe\/" target="_blank" rel="noopener">Ecoku<\/a><\/p>/.test(html), "Powered by Ecoku，Ecoku 链接文档站"],
  [/id="comment-pagination"[\s\S]*?<\/nav>\s*<p class="powered-by">/.test(html), "署名紧随分页之后，不在分页内（单页时仍显示）"],
  [credit.includes("text-align: end"), "署名在评论区右下角"],
  [credit.includes("color: color-mix(in srgb, var(--ecoku-secondary) 70%, transparent)") && credit.includes("font-size: 12px"), "Powered by 比次要色更淡的小字"],
  [block(".powered-by a").includes("color: color-mix(in srgb, var(--ecoku-secondary) 65%, var(--ecoku-primary))"), "Ecoku 比次要色略深，仍浅于正文"],
  [block(".powered-by a:hover").includes("color: var(--ecoku-accent)"), "悬停使用强调色"],
  [!/powered-by/.test(v18), "v18 已批准基线保持不变"],
  [css.replace(/\/\* v19:[\s\S]*?(?=\/\* Touch keyboards)/, "") === v18, "v19 样式只在 v18 上增加署名"],
];

let failed = false;
for (const [ok, label] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
