import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  scenarios, tokens, fonts, darkRules, telegramBudget,
  renderBloggerEmail, renderReplyEmail, renderTestEmail, renderTelegram, renderTelegramRetracted,
} from "./notifications-v6.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (name) => fs.readFileSync(path.join(here, name), "utf8");
const emailPage = read("email-notification-v6.html");
const telegramPage = read("telegram-notification-v6.html");
const renderer = read("notifications-v6.js");

const comment = renderBloggerEmail(scenarios.comment);
const reply = renderBloggerEmail(scenarios.reply);
const visitor = renderReplyEmail(scenarios.visitor);
const long = renderBloggerEmail(scenarios.long);
const fallback = renderBloggerEmail(scenarios.fallback);
const testEmail = renderTestEmail();
const emails = [comment, reply, visitor, long, fallback, testEmail];
const allHTML = emails.map((message) => message.html).join("\n");
const telegramReply = renderTelegram(scenarios.reply);
const telegramLong = renderTelegram(scenarios.long);
const retracted = renderTelegramRetracted(scenarios.reply);

// 最坏情况：每个字符都是占两个 UTF-16 单位的表情，且所有字段都超过预算。
const emoji = (count) => "😀".repeat(count);
const worst = renderTelegram({
  site: { name: emoji(300), domain: "x.test", bloggerBadge: emoji(80), smojiOrigin: "" },
  parent: { username: emoji(200), isBlogger: true, content: emoji(3000) },
  comment: { id: 1, username: emoji(200), isBlogger: true, pageTitle: emoji(500), content: emoji(5000) },
  time: "2026/09/29 23:59 (UTC+14)",
  url: "https://x.test/" + "a".repeat(3000),
});
const visibleUnits = worst.replace(/<a href="[^"]*">/g, "").replace(/<[^>]+>/g, "").replace(/&[a-z#0-9]+;/g, "x").length;

const present = [
  ["纸墨浅色 token", allHTML, new RegExp(`background-color:${tokens.light.paper}[\\s\\S]*background-color:${tokens.light.surface}`)],
  ["纸墨深色 token", darkRules, new RegExp(`${tokens.dark.paper}[\\s\\S]*${tokens.dark.surface}[\\s\\S]*${tokens.dark.ink}`)],
  ["朱砂强调色（oklab 换算）", allHTML, /color:#9a4733/],
  ["深色跟随系统", allHTML, /@media \(prefers-color-scheme:dark\)/],
  ["系统 CJK 无衬线字体栈", fonts.sans, /'Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei UI','Microsoft YaHei','Noto Sans CJK SC'/],
  ["正文与标题使用无衬线栈", allHTML, /<body[^>]*font-family:-apple-system[\s\S]*<h1[^>]*font-family:-apple-system/],
  ["字标使用 Georgia", allHTML, /font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:bold;line-height:24px;letter-spacing:0\.005em;">Ecoku</],
  ["6px 圆角卡片与按钮", allHTML, /class="email-shell"[^>]*border-radius:6px[\s\S]*class="email-button"[^>]*border-radius:6px/],
  ["墨色主按钮", allHTML, /class="email-button" align="center" bgcolor="#1e1c19"/],
  ["表格布局与 MSO 容器", allHTML, /<!--\[if mso\]><table role="presentation" width="600"/],
  ["预览摘要", comment.html, /display:none;max-height:0;[^>]*>林峤：备份步骤很清楚。\[表情：挥手\]/],
  ["语言与字符集", allHTML, /<html lang="zh-CN"><head><meta charset="utf-8">/],
  ["新评论标题", comment.html, /<h1[^>]*>您在 Dejavu&#39;s Blog 上有新评论<\/h1>/],
  ["主题附带文章标题", comment.subject, /^您在 Dejavu's Blog 上有新评论：SQLite 备份与恢复指南$/],
  ["新回复主题附带文章标题", reply.subject, /^您在 Dejavu's Blog 上有新回复：SQLite 备份与恢复指南$/],
  ["访客主题附带文章标题", visitor.subject, /^你在 Dejavu's Blog 的评论收到了回复：SQLite 备份与恢复指南$/],
  ["长标题在主题中截断", long.subject, /^您在 Dejavu's Blog 上有新回复：.{59}…$/u],
  ["新回复包含文章与时间", reply.html, /文章<\/td>[\s\S]*SQLite 备份与恢复指南[\s\S]*发布时间<\/td>[\s\S]*font-family:ui-monospace[\s\S]*2026\/09\/29 11:02 \(UTC\+8\)/],
  ["被回复评论使用浅底", reply.html, /青崖<\/strong> 的评论<\/p><table class="email-wash"/],
  ["新内容使用细线框", reply.html, /木泽<\/strong> 的回复<\/p><table class="email-frame"/],
  ["博主标志", visitor.html, /站长<\/strong> <span class="email-accent"[^>]*>\[博主\]<\/span> 的回复/],
  ["同源表情渲染为图片", comment.html, /<img src="https:\/\/static\.example\.com\/smoji\/cats\/wave\.svg" alt="\[表情：挥手\]" height="28"/],
  ["非清单来源表情显示标签", long.html, /地区 \[表情：在忙勿扰\]<br>abcdef/],
  ["换行转为 br", comment.html, /\[表情：挥手\]"[^>]*><br>是否可以补充/],
  ["长昵称可换行", long.html, /word-break:break-word;overflow-wrap:anywhere;">[^<]*<strong[^>]*>D:\\Forgejo\\Blog/],
  ["名称回落为域名", fallback.html, /您在 notes\.example\.test 上有新评论[\s\S]*此邮件由 notes\.example\.test 系统发送，请勿直接回复本邮件。/],
  ["空标题显示这篇文章，主题不追加", fallback.subject + fallback.html, /^您在 notes\.example\.test 上有新评论<[\s\S]*这篇文章/],
  ["评论锚点", comment.html + visitor.html, /#ecoku-comment-1041[\s\S]*#ecoku-comment-1043/],
  ["纯文本版本结构", reply.text, /^您在 Dejavu's Blog 上有新回复\n\n文章：SQLite 备份与恢复指南\n发布时间：2026\/09\/29 11:02 \(UTC\+8\)\n\n青崖 的评论：\n[\s\S]*木泽 的回复：\n[\s\S]*\[表情：谢谢\]\n\n查看原文：https:\/\/blog\.example\.com\/guides\/sqlite-backup#ecoku-comment-1042\n\n——\n此邮件由 Dejavu's Blog 系统发送，请勿直接回复本邮件。$/],
  ["测试邮件", testEmail.html, /测试邮件[\s\S]*Ecoku 测试邮件[\s\S]*收到这封邮件，说明当前 SMTP 设置可以正常投递。/],
  ["Telegram 被回复评论用引用块", telegramReply, /<b>青崖<\/b> 的评论：\n<blockquote>这套迁移流程是否也适合评论数量较多的站点？<\/blockquote>\n<b>木泽<\/b> 的回复：\n/],
  ["Telegram 表情为文字标签", telegramReply, /\[表情：谢谢\]/],
  ["Telegram 文章与时间", telegramReply, /^<b>您在 Dejavu&#39;s Blog 上有新回复<\/b>\n文章：SQLite 备份与恢复指南\n发布时间：2026\/09\/29 11:02 \(UTC\+8\)\n/],
  ["Telegram 原文链接", telegramReply, /<a href="https:\/\/blog\.example\.com\/guides\/sqlite-backup#ecoku-comment-1042">查看原文<\/a>$/],
  ["Telegram 撤回文案", retracted, /<i>这条评论已被删除，通知内容已移除。<\/i>$/],
  ["预览页引用共享渲染", emailPage + telegramPage, /from "\.\/notifications-v6\.js"[\s\S]*from "\.\/notifications-v6\.js"/],
  ["预览页可切换深色与手机宽度", emailPage, /data-scheme="dark"[\s\S]*data-width="narrow"[\s\S]*data-part="text"/],
];

const absent = [
  ["不再使用 v5 蓝灰强调色与旧底色", allHTML + renderer, /rgb\(43,\s*91,\s*113\)|rgb\(42,\s*83,\s*108\)|#2a536c|rgb\(243,\s*239,\s*231\)/],
  ["正文不以 Arial 开头", allHTML, /font-family:Arial/],
  ["标题不用衬线", allHTML, /<h1[^>]*Georgia/],
  ["不使用 CSS grid 或浮动", allHTML, /display:grid|float:/],
  ["不依赖 pre-wrap 换行", allHTML, /white-space:pre-wrap/],
  ["不出现 smoji 原始标记", allHTML + telegramReply + telegramLong, /!\[smoji:/],
  ["撤回后不保留昵称与正文", retracted, /木泽|可以。建议/],
  ["无审核入口与管理字段", allHTML + telegramReply, /审核|管理后台|页面 key|IP|User-Agent/],
  ["无真实域名", allHTML + renderer + emailPage + telegramPage, /dejavu\.moe|via\.moe|gmail\.com/],
  ["不加载网络字体", allHTML + emailPage + telegramPage, /@font-face|fonts\.googleapis|@import url/],
  ["无网络与持久化", renderer + emailPage + telegramPage, /fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|indexedDB|sessionStorage|document\.cookie/],
];

let failed = false;
const report = (label, ok) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failed = true;
};
for (const [label, source, pattern] of present) report(label, pattern.test(source));
for (const [label, source, pattern] of absent) report(label, !pattern.test(source));
report("Telegram 最坏情况不超过 4096 个 UTF-16 单位", visibleUnits <= 4096);
report("Telegram 预算与服务端一致", telegramBudget.content === 1000 && telegramBudget.parent === 400);
if (failed) process.exit(1);
