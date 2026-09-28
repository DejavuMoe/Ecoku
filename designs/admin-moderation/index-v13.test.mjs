import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, "index-v13.html"), "utf8");
const css = fs.readFileSync(path.join(here, "styles-v13.css"), "utf8");
const js = fs.readFileSync(path.join(here, "prototype-v13.js"), "utf8");
const all = `${html}\n${css}\n${js}`;

const present = [
  ["默认跟随系统配色", html, /<html lang="zh-CN" data-theme="auto">/],
  ["浅色与深色 color-scheme", html, /name="color-scheme" content="light dark"/],
  ["评论区 v17 纸张 token", css, /--paper: #f7f4ee;[\s\S]*--surface: #fbf9f5;[\s\S]*--ink: #1e1c19;/],
  ["评论区 v17 深色 token", css, /@media \(prefers-color-scheme: dark\)[\s\S]*html\[data-theme="auto"\][\s\S]*--paper: #1a1816;[\s\S]*--ink: #eee8dd;/],
  ["朱砂强调色与评论区一致", css, /--accent: color-mix\(in oklab, #c8553a 75%, var\(--ink\)\)/],
  ["系统 CJK 与英文字体栈", css, /--sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans CJK SC"/],
  ["评论区圆角 token", css, /--radius: 6px;[\s\S]*--radius-sm: 3px;/],
  ["四项管理导航", html, /评论管理[\s\S]*站点管理[\s\S]*通知设置[\s\S]*>安全</],
  ["站点切换位于评论管理", html, /class="queue-head">\s*<div id="site-picker"/],
  ["只有已发布与已删除", html, /data-status="published">已发布[\s\S]*data-status="deleted">已删除/],
  ["墓碑删除与彻底删除", js, /墓碑删除[\s\S]*彻底删除[\s\S]*仍有回复，不能彻底删除/],
  ["查看原评论锚点", js, /ecoku-comment-\$\{c\.id\}/],
  ["详情字段", js, /私有邮箱[\s\S]*访客网站[\s\S]*文章标题[\s\S]*页面 key[\s\S]*父评论/],
  ["加载、空与失败状态", js, /skeleton-row[\s\S]*无法连接到 Ecoku，请检查网络后重试。[\s\S]*当前没有/],
  ["站点表单字段完整", html, /site-id[\s\S]*site-url[\s\S]*site-name[\s\S]*site-origins[\s\S]*site-sort[\s\S]*site-email-required[\s\S]*site-website-required[\s\S]*site-placeholder[\s\S]*site-limit[\s\S]*site-empty[\s\S]*smoji-enabled[\s\S]*smoji-manifest-url[\s\S]*blogger-nickname[\s\S]*blogger-email[\s\S]*blogger-passphrase[\s\S]*blogger-badge/],
  ["站点表单关键说明", html, /每行一个完整来源[\s\S]*中文、日文、韩文与其他 Unicode 字符均按一个字符计数[\s\S]*可能向该站点暴露访客 IP[\s\S]*仅用于通知去重与历史评论回填，不会公开[\s\S]*留空则不显示/],
  ["邮件通知字段完整", html, /email-server[\s\S]*email-port[\s\S]*email-encryption[\s\S]*email-user[\s\S]*email-password[\s\S]*email-sender[\s\S]*email-recipients/],
  ["只有 SSL/TLS 与 STARTTLS", html, /value="tls"[\s\S]*value="starttls"/],
  ["Telegram 字段完整", html, /telegram-token[\s\S]*telegram-targets/],
  ["收件人分隔说明", html, /按 Enter、逗号或换行添加多个邮箱[\s\S]*按 Enter、逗号或换行添加；支持用户、群组、频道 ID/],
  ["密钥不回显", html, /id="email-password"[^>]*type="password"[\s\S]*id="telegram-token"[^>]*type="password"[\s\S]*id="turnstile-secret"[^>]*type="password"[\s\S]*id="cap-secret"[^>]*type="password"/],
  ["实例级验证范围", html, /同时用于访客评论和管理员登录，不按站点分开/],
  ["三种互斥提供方", html, /value="off"[\s\S]*value="turnstile"[\s\S]*value="cap"/],
  ["Cap 登录状态", js, /点击进行真人验证[\s\S]*正在验证…[\s\S]*验证已完成[\s\S]*验证失败，请重试/],
  ["Cap 官方尺寸", css, /--cap-widget-height: 58px;[\s\S]*--cap-widget-width: 260px;/],
  ["Cap 端点尾斜杠", html, /data-cap-api-endpoint="https:\/\/cap\.example\.com\/d9256640cb53\/"/],
  ["会话过期提示", js, /管理会话已过期，请重新登录。/],
  ["退出失败提示", html, /退出失败，请重试。/],
  ["窄屏详情返回", js, /评论列表/],
  ["减少动态效果", css, /prefers-reduced-motion: reduce/],
  ["原型控件标记", html, /class="scenario-controller"[^>]*data-prototype-only="true"/],
];

const absent = [
  ["不使用系统衬线正文栈", css, /"Songti SC"|"STSong"|"Noto Serif SC"/],
  ["不加载网络字体", all, /@font-face|fonts\.googleapis|@import url/],
  ["无审核流程", all, /待审核|批准所选|拒绝所选|审核方式/],
  ["无普通用户、Count 或管理密钥", all, /用户注册|>Count<|management key|站点管理密钥/],
  ["无通知判定与模板预览", all, /通知判定预览|评论通知判定|notification-matrix|通知模板预览|\/admin\/templates\//],
  ["无不加密选项", html, /value="none"|不加密/],
  ["无运维恢复说明", all, /captcha disable|服务器恢复说明/],
  ["无假禁用的回复通知复选框", html, /type="checkbox" checked disabled/],
  ["无真实域名", all, /dejavu\.moe|via\.moe|gmail\.com/],
  ["无网络与持久化", all, /fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|indexedDB|sessionStorage|document\.cookie/],
  ["不使用 innerHTML 注入评论原文", js, /innerHTML = c\.content|innerHTML = comment\.content/],
];

let failed = false;
for (const [label, source, pattern] of present) {
  const ok = pattern.test(source);
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failed = true;
}
for (const [label, source, pattern] of absent) {
  const ok = !pattern.test(source);
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
