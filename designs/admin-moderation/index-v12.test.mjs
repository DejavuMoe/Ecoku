import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, "index-v12.html"), "utf8");

const checks = [
  ["批准稿标题", /评论管理 · 验证方式/],
  ["默认跟随系统配色", /<html lang="zh-CN" data-theme="auto">/],
  ["浅色与深色 color-scheme", /name="color-scheme" content="light dark"/],
  ["深色纸张 token", /html\[data-theme="dark"\][\s\S]*--paper: rgb\(26, 29, 32\)[\s\S]*--surface: rgb\(34, 38, 42\)[\s\S]*--ink: rgb\(242, 236, 226\)/],
  ["系统衬线栈", /--serif: "Noto Serif SC", "Noto Serif CJK SC", "Songti SC", "STSong", serif;/],
  ["不使用 OPPO 衬线", /OPPO Serif SC/],
  ["沿用四项管理导航", /评论管理[\s\S]*站点管理[\s\S]*通知设置[\s\S]*>安全</],
  ["实例级范围", /同时用于访客评论和管理员登录，不按站点分开/],
  ["三种互斥提供方", /value="off"[\s\S]*value="turnstile"[\s\S]*value="cap"/],
  ["Turnstile 保留", /Cloudflare Turnstile[\s\S]*turnstile-sitekey[\s\S]*turnstile-secret/],
  ["Cap 自托管字段", /cap-instance-url[\s\S]*cap-sitekey[\s\S]*cap-secret/],
  ["Cap Secret 不回显", /id="cap-secret" type="password"[\s\S]*placeholder="已设置，输入新值以更换"/],
  ["移除重复卡片标题", /机器人验证|captcha-title|settings-head/],
  ["移除卡片提示文案", /每次只启用一种方式；切换后保留另一种方式已经保存的配置/],
  ["运维恢复说明不进管理界面", /captcha disable|服务器恢复说明|recovery-note/],
  ["不做自动降级文案", /自动降级|自动切换|故障时改用/],
  ["Cap 登录完整状态", /login-cap-idle[\s\S]*login-cap-solving[\s\S]*login-cap-solved[\s\S]*login-cap-failed/],
  ["Turnstile 登录仍存在", /login-turnstile/],
  ["关闭验证登录仍存在", /login-off/],
  ["Cap 端点尾斜杠", /data-cap-api-endpoint="https:\/\/cap\.example\.com\/d9256640cb53\/"/],
  ["Cap 中文状态", /点击进行真人验证[\s\S]*正在验证…[\s\S]*验证已完成[\s\S]*验证失败，请重试/],
  ["Cap 可访问名称", /data-cap-i18n-verify-aria-label[\s\S]*data-cap-i18n-verifying-aria-label[\s\S]*data-cap-i18n-verified-aria-label[\s\S]*data-cap-i18n-required-label[\s\S]*data-cap-i18n-error-aria-label/],
  ["Cap 暖纸张背景", /--cap-background: var\(--surface\)/],
  ["Cap 官方边框与圆角", /--cap-border-color: var\(--line-soft\)[\s\S]*--cap-border-radius: 14px/],
  ["Cap 官方尺寸与间距", /--cap-widget-height: 58px[\s\S]*--cap-widget-width: 260px[\s\S]*--cap-widget-padding: 14px[\s\S]*--cap-gap: 15px/],
  ["Cap 跟随项目字体", /--cap-font: var\(--serif\)/],
  ["Cap 官方复选框几何", /--cap-checkbox-size: 25px[\s\S]*--cap-checkbox-border:[\s\S]*--cap-checkbox-border-radius: 6px[\s\S]*--cap-checkbox-background:/],
  ["Cap 自定义进度环", /--cap-spinner-color:[\s\S]*--cap-spinner-background-color:[\s\S]*--cap-spinner-thickness:/],
  ["Cap 使用 SVG 进度环与状态图标", /cap-progress-ring[\s\S]*cap-checkmark[\s\S]*cap-error-icon/],
  ["Cap 使用官方状态名称", /data-state="verifying"[\s\S]*data-state="done"[\s\S]*data-state="error"/],
  ["Cap 保留官方署名位置", /class="cap-credits"[\s\S]*>Cap<\/span>/],
  ["不再使用文本对勾", />✓</],
  ["响应式提供方布局", /@media \(max-width: 680px\)[\s\S]*\.provider-group \{ grid-template-columns: 1fr; \}/],
  ["批准基线标记", /已批准基线；场景和配色控件不进入生产/],
];

const absent = new Set([
  "不使用 OPPO 衬线",
  "移除重复卡片标题",
  "移除卡片提示文案",
  "运维恢复说明不进管理界面",
  "不做自动降级文案",
  "不再使用文本对勾",
]);
let failed = false;
for (const [label, pattern] of checks) {
  const matched = pattern.test(html);
  const ok = absent.has(label) ? !matched : matched;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failed = true;
}

if (/capjs\.via\.moe|git\.via\.moe/.test(html)) {
  failed = true;
  console.error("FAIL 静态原型不得写入真实域名");
} else {
  console.log("PASS 静态原型仅使用脱敏占位域名");
}

if (/fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|indexedDB|sessionStorage|document\.cookie/.test(html)) {
  failed = true;
  console.error("FAIL 静态原型不应访问生产接口或持久化数据");
} else {
  console.log("PASS 静态原型无生产接口或持久化写入");
}

if (/通知判定预览|评论通知判定|notification-matrix|通知模板预览/.test(html)) {
  failed = true;
  console.error("FAIL 安全页不应展示通知判定或模板预览");
} else {
  console.log("PASS 安全页不展示通知判定或模板预览");
}

if (failed) process.exit(1);
