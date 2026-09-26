import fs from "node:fs";
import path from "node:path";

const base = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1"));
const html = fs.readFileSync(path.join(base, "index-v17.html"), "utf8");
const css = fs.readFileSync(path.join(base, "styles-v17.css"), "utf8");
const source = fs.readFileSync(path.join(base, "prototype-v17-paper.js"), "utf8");

const block = (selector) => {
  // Match a rule that starts on its own line, so ".collapse-button" never resolves to
  // the tail of a grouped selector such as ".comment-time,\n.collapse-button".
  let start = css.indexOf(`\n${selector} {`);
  while (start > 0 && css[start - 1] === ",") start = css.indexOf(`\n${selector} {`, start + 1);
  if (start < 0) return "";
  return css.slice(start + 1, css.indexOf("}", start) + 1);
};

const tokens = block(":where(.comment-section)");
const lightTokens = block(':where(.comment-section[data-theme="light"])');
const darkTokens = block(':where(.comment-section[data-theme="dark"])');
const template = html.slice(html.indexOf('<template id="reply-template-v8">'));
const rootForm = html.slice(html.indexOf('<form class="composer" id="comment-form"'), html.indexOf("</form>"));

const checks = [
  [html.includes('data-design-status="approved"'), "标明已批准设计基线"],
  [html.includes('href="styles-v17.css"'), "v17 样式入口"],
  [!css.includes("@import"), "独立样式表，不继承 v3–v16 链"],
  [["prototype-v13.js", "prototype-v14-reply.js", "prototype-v15-embed.js", "prototype-v16-captcha.js", "prototype-v17-paper.js"].every((name) => html.includes(name)), "沿用已批准交互，只叠加纸墨工具栏"],
  [html.includes('class="comment-section" id="comment-section" data-theme="auto"'), "评论根节点按 auto 预览"],

  [tokens.includes("--ecoku-theme: var(--theme, #f7f4ee)") && tokens.includes("--ecoku-primary: var(--primary, #1e1c19)"), "颜色仍优先读取 PaperMod 同名变量"],
  [!/color-scheme/.test(tokens), "auto 不声明 color-scheme，继承宿主明暗"],
  [lightTokens.includes("color-scheme: light") && darkTokens.includes("color-scheme: dark"), "强制明暗时才声明 color-scheme"],
  [tokens.includes("--ecoku-accent: color-mix(in oklab, #c8553a 75%, var(--ecoku-primary))"), "朱砂强调色随墨色自动适配明暗"],
  [tokens.includes("--ecoku-danger: var(--ecoku-accent)"), "错误色默认沿用强调色"],
  [tokens.includes("--ecoku-radius: 6px") && tokens.includes("--ecoku-radius-sm: 3px"), "6px / 3px 圆角令牌"],
  [tokens.includes("--ecoku-font-size: 15px") && tokens.includes("--ecoku-font-size-small: 13px") && tokens.includes("--ecoku-font-size-title: 22px"), "字号阶梯令牌"],
  [tokens.includes("--ecoku-font-mono:") && tokens.includes("--ecoku-shadow:") && tokens.includes("--ecoku-focus:"), "等宽字体、浮层阴影与焦点令牌"],
  [block(".comment-section").includes("--ecoku-accent: var(--accent)"), "宿主映射示例写在根节点上"],

  [!/999px/.test(css), "不再使用胶囊圆角"],
  [!/border-radius: 1[0-4]px/.test(css), "不再使用 10–14px 大圆角"],
  [block(".field").includes("border-bottom: 1px solid var(--ecoku-border)") && !block(".field").includes("background"), "身份字段是横线，不是框中框"],
  [block(".field:focus-within").includes("border-bottom-color: var(--ecoku-primary)"), "聚焦时底线加深为墨色"],
  [!block(".field-label").includes("background") && !block(".field-label").includes("border-right"), "字段标签无底色与竖分隔"],
  [block(".message-field textarea").includes("border: 0") && block(".message-field textarea").includes("background: transparent"), "正文区直接写在纸面上"],
  [block(".message-field textarea").includes("calc(16px + 1.75em * 7)"), "保留七行默认高度"],
  [block(".primary-button").includes("background: var(--ecoku-primary)") && block(".primary-button").includes("color: var(--ecoku-theme)"), "唯一的实心墨色主按钮"],
  [block(".primary-button:not(:disabled):hover").includes("opacity: 0.86"), "主按钮悬停只略微变淡"],
  [block(".composer-end .secondary-button,\n.smoji-trigger").includes("border-color: transparent"), "表情、预览、取消是安静的文字按钮"],
  [block(".sort-trigger").includes("color: var(--ecoku-secondary)") && !block(".sort-trigger").includes("border:"), "排序是无边框文字触发器"],
  [!block(".sort-option:hover").includes("background"), "菜单悬停只变文字颜色"],
  [block(".blogger-badge").includes("color: var(--ecoku-accent)"), "博主标记使用朱砂强调色"],
  [block("a.comment-author:hover").includes("var(--ecoku-accent)") && block(".comment-time:hover,\n.collapse-button:hover").includes("var(--ecoku-accent)"), "链接悬停统一为朱砂"],
  [block(".comment-time,\n.collapse-button").includes("font-family: var(--ecoku-font-mono)"), "时间与折叠控件使用等宽字体"],
  [block(".collapse-button").includes("width: 3ch") && block(".collapse-button").includes("flex: 0 0 3ch"), "折叠控件保持 3ch 等宽"],
  [block(".deleted .comment-author,\n.deleted .comment-copy").includes("font-style: normal"), "删除占位不使用伪斜体"],
  [block(".comment-node:not([data-depth=\"1\"]) > .comment-row::before").includes("solid var(--ecoku-border-soft)"), "子评论引导线改为发丝实线"],
  [block(".root-thread").includes("border-bottom: 1px solid var(--ecoku-border-soft)"), "每个根讨论只保留一条分隔线"],
  [block(".composer-preview").includes("border-inline-start: 2px solid var(--ecoku-border)"), "预览按引用块排版"],
  [css.includes(".comment-section :not(input, textarea):focus-visible"), "键盘焦点只画在非文本控件上"],
  [/@media \(pointer: coarse\)[\s\S]*?max\(16px, var\(--ecoku-font-size\)\)/.test(css), "触屏输入不小于 16px，避免 iOS 放大"],
  [/:where\(\.comment-section\) :is\(button, input, textarea\)/.test(css), "元素重置保持低优先级"],
  [css.includes("--cap-widget-width: 260px") && css.includes("--cap-widget-height: 58px") && css.includes("--cap-checkbox-size: 25px"), "Cap 保留官方几何"],
  [css.includes("--cap-border-radius: var(--ecoku-radius)") && css.includes("--cap-background: transparent"), "Cap 只跟随纸墨圆角与底色"],

  [rootForm.includes('class="smoji-trigger"') && rootForm.includes('class="secondary-button preview-trigger"') && rootForm.includes('class="composer-preview"'), "根评论框带表情与预览"],
  [template.includes('class="smoji-trigger"') && template.includes('preview-trigger') && template.includes('class="composer-preview"'), "回复框带表情与预览"],
  [template.indexOf("preview-trigger") < template.indexOf("cancel-reply") && template.indexOf("cancel-reply") < template.indexOf("submit-reply"), "回复工具栏顺序：表情、预览、取消、回复"],
  [source.includes("暂无可预览内容。") && source.includes("![smoji:"), "预览沿用生产文案与表情标记"],
  [source.includes("../smoji-candidate/fixtures/"), "表情只使用本地脱敏素材"],
  [!source.includes("fetch("), "原型不访问网络"]
];

let failed = false;
for (const [ok, label] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failed = true;
}

if (/capjs\.via\.moe|git\.via\.moe|ecoku\.via\.moe|blog\.dejavu\.moe/.test([html, css, source].join("\n"))) {
  failed = true;
  console.error("FAIL 原型不得写入真实域名");
} else {
  console.log("PASS 原型仅使用脱敏占位域名");
}

if (/localStorage|sessionStorage|indexedDB|document\.cookie/.test(source)) {
  failed = true;
  console.error("FAIL 纸墨原型脚本不得持久化状态");
} else {
  console.log("PASS 纸墨原型脚本不持久化状态");
}

if (failed) process.exit(1);
