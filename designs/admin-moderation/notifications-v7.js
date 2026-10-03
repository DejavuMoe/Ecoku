// Ecoku 通知模板 v7（已批准）：在 v6 上把邮件页眉换成已批准的「區」印章。
// 仅供原型预览与原型测试使用，不进入运行时；服务端 server/notifications 按同一结构渲染。
// 颜色、圆角与字体取自评论区 v17 / 管理端「纸与墨」token，邮件客户端不支持 color-mix，
// 强调色按 oklab 预先换算为 hex。Telegram 部分与 v6 相同。
//
// 印章以内嵌 PNG 随邮件发送（multipart/related，Content-ID）：Gmail、Outlook 不显示 SVG，
// data: URI 会被拦截，远程图片会在收件人打开邮件时向实例暴露其 IP 与打开时间。
// PNG 由 designs/brand/ecoku-mark-mono.svg 以朱砂 #b8472f、84×84 渲染，刻线透明，
// 浅色与深色邮件都透出卡片底色；页眉按 28×28 显示。图片只作装饰（alt 为空），字标 Ecoku 保留为文字。

export const tokens = {
  light: {
    paper: "#f7f4ee",
    surface: "#fbf9f5",
    ink: "#1e1c19",
    inkSoft: "#35312b",
    muted: "#6b655b",
    line: "#cbc3b5",
    lineSoft: "rgba(30,28,25,0.12)",
    wash: "#efebe3",
    accent: "#9a4733",
  },
  dark: {
    paper: "#1a1816",
    surface: "#211f1c",
    ink: "#eee8dd",
    inkSoft: "#d3ccbf",
    muted: "#a29a8c",
    line: "#4b453d",
    lineSoft: "rgba(238,232,221,0.12)",
    wash: "#26231f",
    accent: "#d57c64",
  },
};

// 页眉印章：服务端以内嵌附件发送，HTML 只引用 Content-ID。
export const markImage = {
  cid: "ecoku-mark",
  filename: "ecoku-mark.png",
  contentType: "image/png",
  source: "../brand/ecoku-mark-email.png",
  pixels: 84,
  size: 28,
};

export const fonts = {
  sans: "-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei UI','Microsoft YaHei','Noto Sans CJK SC','Source Han Sans SC','Noto Sans SC','Helvetica Neue',Arial,sans-serif",
  mono: "ui-monospace,'SF Mono','Cascadia Mono',Menlo,Consolas,monospace",
  wordmark: "Georgia,'Times New Roman',serif",
};

const L = tokens.light;
const D = tokens.dark;

// 深色规则单独导出，预览页可以在不依赖系统设置的情况下强制套用。
export const darkRules = [
  `.email-body,.email-outer{background-color:${D.paper}!important}`,
  `.email-shell{background-color:${D.surface}!important;border-color:${D.lineSoft}!important}`,
  `.email-copy{color:${D.ink}!important}`,
  `.email-soft{color:${D.inkSoft}!important}`,
  `.email-muted{color:${D.muted}!important}`,
  `.email-accent{color:${D.accent}!important}`,
  `.email-rule{border-color:${D.lineSoft}!important}`,
  `.email-wash{background-color:${D.wash}!important}`,
  `.email-frame{border-color:${D.line}!important}`,
  `.email-button{background-color:${D.ink}!important}`,
  `.email-button-link{color:${D.paper}!important}`,
].join("");

const narrowRules = [
  ".email-pad{padding-right:22px!important;padding-left:22px!important}",
  ".email-title{font-size:22px!important;line-height:30px!important}",
  ".email-meta-label{width:64px!important}",
].join("");

const SMOJI_MARKER = /!\[smoji:([^\]\r\n]+)\]\((https?:\/\/[^()\s]+)\)/g;

export function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&#34;")
    .replace(/'/g, "&#39;");
}

function textHTML(value) {
  return escapeHTML(value.replace(/\r\n?/g, "\n")).replace(/\n/g, "<br>");
}

export function smojiText(label) {
  return `[表情：${label.trim()}]`;
}

function originOf(value) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

// 仍属于站点当前表情包清单来源的标记渲染为图片，其余只保留文字标签。
export function contentHTML(content, site, resolveImage = (src) => src) {
  let html = "";
  let cursor = 0;
  for (const match of content.matchAll(SMOJI_MARKER)) {
    html += textHTML(content.slice(cursor, match.index));
    const label = smojiText(match[1]);
    if (site.smojiOrigin && originOf(match[2]) === site.smojiOrigin) {
      html += `<img src="${escapeHTML(resolveImage(match[2]))}" alt="${escapeHTML(label)}" height="28" style="height:28px;width:auto;max-width:72px;border:0;vertical-align:middle;">`;
    } else {
      html += escapeHTML(label);
    }
    cursor = match.index + match[0].length;
  }
  return html + textHTML(content.slice(cursor));
}

export function plainContent(content) {
  return content.replace(SMOJI_MARKER, (_, label) => smojiText(label)).replace(/\r\n?/g, "\n");
}

function truncate(value, maximum) {
  const runes = Array.from(value);
  return runes.length <= maximum ? value : `${runes.slice(0, maximum - 1).join("")}…`;
}

function singleLine(value) {
  return value.replace(/\s+/g, " ").trim();
}

export function siteName(site) {
  return site.name.trim() || site.domain;
}

export function pageTitle(comment) {
  return comment.pageTitle.trim() || "这篇文章";
}

// 主题只在有真实文章标题时附加标题，避免出现“：这篇文章”。
export function subjectWithTitle(base, comment) {
  const title = singleLine(comment.pageTitle);
  return title ? `${base}：${truncate(title, 60)}` : base;
}

function authorHTML(comment, site) {
  let html = `<strong class="email-copy" style="color:${L.ink};font-weight:bold;">${escapeHTML(comment.username)}</strong>`;
  if (comment.isBlogger && site.bloggerBadge.trim()) {
    html += ` <span class="email-accent" style="color:${L.accent};font-size:12px;">${escapeHTML(site.bloggerBadge.trim())}</span>`;
  }
  return html;
}

function authorText(comment, site) {
  return comment.isBlogger && site.bloggerBadge.trim() ? `${comment.username} ${site.bloggerBadge.trim()}` : comment.username;
}

function metaSection(rows) {
  const body = rows.map(({ label, value, mono }) => {
    const font = mono ? `font-family:${fonts.mono};font-size:13px;` : "font-size:14px;";
    return `<tr><td class="email-muted email-meta-label" width="72" valign="top" style="width:72px;padding:4px 0;color:${L.muted};font-size:13px;line-height:20px;">${escapeHTML(label)}</td>` +
      `<td class="email-copy" valign="top" style="padding:4px 0;color:${L.ink};${font}line-height:20px;word-break:break-word;overflow-wrap:anywhere;">${value}</td></tr>`;
  }).join("");
  return `<tr><td class="email-pad" style="padding:20px 36px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">${body}</table></td></tr>`;
}

// 被回复的旧评论用浅底，本次新内容用细线框：一眼能分清语境与正文。
function quoteSection(caption, content, primary) {
  const box = primary
    ? `class="email-frame" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border:1px solid ${L.line};border-radius:6px;border-collapse:separate;"`
    : `class="email-wash" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:6px;border-collapse:separate;background-color:${L.wash};"`;
  const text = primary
    ? `class="email-copy" style="padding:16px 18px;color:${L.ink};font-size:15px;line-height:26px;word-break:break-word;overflow-wrap:anywhere;"`
    : `class="email-soft" style="padding:14px 18px;color:${L.inkSoft};font-size:14px;line-height:24px;word-break:break-word;overflow-wrap:anywhere;"`;
  return `<tr><td class="email-pad" style="padding:22px 36px 0;">` +
    `<p class="email-muted" style="margin:0 0 8px;color:${L.muted};font-size:13px;line-height:20px;word-break:break-word;overflow-wrap:anywhere;">${caption}</p>` +
    `<table ${box}><tr><td ${text}>${content}</td></tr></table></td></tr>`;
}

function paragraphSection(content) {
  return `<tr><td class="email-pad email-soft" style="padding:20px 36px 0;color:${L.inkSoft};font-size:15px;line-height:26px;">${content}</td></tr>`;
}

export function renderEmailDocument(doc) {
  const { cid, size } = markImage;
  const seal = `<img src="cid:${cid}" width="${size}" height="${size}" alt="" style="display:block;width:${size}px;height:${size}px;border:0;outline:none;text-decoration:none;">`;
  const header = `<tr><td class="email-pad email-rule" style="padding:20px 32px;border-bottom:1px solid ${L.lineSoft};">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;"><tr>` +
    `<td width="${size + 10}" valign="middle" style="width:${size + 10}px;line-height:0;font-size:0;">${seal}</td>` +
    `<td class="email-copy" valign="middle" style="color:${L.ink};font-family:${fonts.wordmark};font-size:18px;font-weight:bold;line-height:24px;letter-spacing:0.005em;">Ecoku</td>` +
    `<td class="email-muted" align="right" valign="middle" style="color:${L.muted};font-size:12px;line-height:18px;word-break:break-word;">${escapeHTML(doc.siteName)}</td>` +
    `</tr></table></td></tr>`;
  const hero = `<tr><td class="email-pad" style="padding:28px 32px 4px;">` +
    `<p class="email-accent" style="margin:0 0 10px;color:${L.accent};font-size:12px;font-weight:bold;letter-spacing:0.08em;line-height:18px;">${escapeHTML(doc.label)}</p>` +
    `<h1 class="email-title email-copy" style="margin:0;color:${L.ink};font-family:${fonts.sans};font-size:25px;font-weight:700;line-height:32px;letter-spacing:-0.01em;word-break:break-word;">${escapeHTML(doc.heading)}</h1></td></tr>`;
  const action = doc.action
    ? `<tr><td class="email-pad" style="padding:28px 36px 36px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;"><tr>` +
      `<td class="email-button" align="center" bgcolor="${L.ink}" style="border-radius:6px;background-color:${L.ink};">` +
      `<a class="email-button-link" href="${escapeHTML(doc.action.url)}" style="display:inline-block;padding:11px 22px;border-radius:6px;color:${L.surface};font-family:${fonts.sans};font-size:14px;font-weight:bold;line-height:20px;text-decoration:none;">${escapeHTML(doc.action.label)}</a>` +
      `</td></tr></table></td></tr>`
    : `<tr><td style="padding:0 0 36px;"></td></tr>`;
  const footer = `<tr><td class="email-pad email-muted email-rule" style="padding:18px 36px 22px;border-top:1px solid ${L.lineSoft};color:${L.muted};font-size:12px;line-height:19px;word-break:break-word;">${escapeHTML(doc.footer)}</td></tr>`;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">` +
    `<title>${escapeHTML(doc.title)}</title>` +
    `<style>@media only screen and (max-width:620px){${narrowRules}}@media (prefers-color-scheme:dark){${darkRules}}</style></head>` +
    `<body class="email-body" style="margin:0;padding:0;background-color:${L.paper};color:${L.ink};font-family:${fonts.sans};-webkit-text-size-adjust:100%;">` +
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${escapeHTML(doc.preheader)}</div>` +
    `<table class="email-outer" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;background-color:${L.paper};"><tr><td align="center" style="padding:32px 12px;">` +
    `<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->` +
    `<table class="email-shell" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border:1px solid ${L.lineSoft};border-radius:6px;border-collapse:separate;background-color:${L.surface};font-family:${fonts.sans};">` +
    header + hero + doc.sections.join("") + action + footer +
    `</table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
}

function footerFor(name) {
  return `此邮件由 ${name} 系统发送，请勿直接回复本邮件。`;
}

function preheaderFor(comment) {
  return truncate(`${comment.username}：${singleLine(plainContent(comment.content))}`, 90);
}

function plainBlocks(lines) {
  return lines.filter((line) => line !== null).join("\n");
}

// 博主通知：新评论与新回复共用一个结构，回复时多一段被回复评论。
export function renderBloggerEmail({ site, comment, parent, time, url }, resolveImage) {
  const name = siteName(site);
  const heading = parent ? `您在 ${name} 上有新回复` : `您在 ${name} 上有新评论`;
  const verb = parent ? "的回复" : "的评论";
  const sections = [metaSection([
    { label: "文章", value: escapeHTML(pageTitle(comment)) },
    { label: "发布时间", value: escapeHTML(time), mono: true },
  ])];
  if (parent) sections.push(quoteSection(`${authorHTML(parent, site)} 的评论`, contentHTML(parent.content, site, resolveImage), false));
  sections.push(quoteSection(`${authorHTML(comment, site)} ${verb}`, contentHTML(comment.content, site, resolveImage), true));
  const text = plainBlocks([
    heading, "",
    `文章：${pageTitle(comment)}`,
    `发布时间：${time}`, "",
    ...(parent ? [`${authorText(parent, site)} 的评论：`, plainContent(parent.content), ""] : []),
    `${authorText(comment, site)} ${verb}：`, plainContent(comment.content), "",
    `查看原文：${url}`, "",
    "——", footerFor(name),
  ]);
  return {
    subject: subjectWithTitle(heading, comment),
    text,
    inline: [markImage],
    html: renderEmailDocument({
      title: heading, preheader: preheaderFor(comment), siteName: name,
      label: `${parent ? "新回复" : "新评论"} · #${comment.id}`, heading, sections,
      action: { label: "查看原文", url }, footer: footerFor(name),
    }),
  };
}

export function renderReplyEmail({ site, comment, parent, time, url }, resolveImage) {
  const name = siteName(site);
  const heading = `你在 ${name} 的评论收到了回复`;
  const sections = [
    metaSection([
      { label: "文章", value: escapeHTML(pageTitle(comment)) },
      { label: "回复时间", value: escapeHTML(time), mono: true },
    ]),
    quoteSection("你的评论", contentHTML(parent.content, site, resolveImage), false),
    quoteSection(`${authorHTML(comment, site)} 的回复`, contentHTML(comment.content, site, resolveImage), true),
  ];
  const text = plainBlocks([
    heading, "",
    `文章：${pageTitle(comment)}`,
    `回复时间：${time}`, "",
    "你的评论：", plainContent(parent.content), "",
    `${authorText(comment, site)} 的回复：`, plainContent(comment.content), "",
    `查看回复：${url}`, "",
    "——", footerFor(name),
  ]);
  return {
    subject: subjectWithTitle(heading, comment),
    text,
    inline: [markImage],
    html: renderEmailDocument({
      title: heading, preheader: preheaderFor(comment), siteName: name,
      label: "回复通知", heading, sections,
      action: { label: "查看回复", url }, footer: footerFor(name),
    }),
  };
}

export function renderTestEmail() {
  const heading = "Ecoku 测试邮件";
  const body = "收到这封邮件，说明当前 SMTP 设置可以正常投递。";
  return {
    subject: heading,
    text: `${heading}\n\n${body}`,
    inline: [markImage],
    html: renderEmailDocument({
      title: heading, preheader: body, siteName: "", label: "测试邮件", heading,
      sections: [paragraphSection(escapeHTML(body))], action: null,
      footer: "此邮件由 Ecoku 发送，请勿直接回复本邮件。",
    }),
  };
}

// Telegram 使用 parse_mode=HTML。被回复的旧评论放进 blockquote，新内容保持正文。
// 各字段先截断再转义，即使每个字符都占两个 UTF-16 单位也不超过 4096。
export const telegramBudget = { site: 100, title: 200, author: 80, parentAuthor: 40, badge: 16, parent: 400, content: 1000 };

function telegramAuthor(comment, site, budget) {
  let value = `<b>${escapeHTML(truncate(comment.username, budget))}</b>`;
  if (comment.isBlogger && site.bloggerBadge.trim()) value += ` ${escapeHTML(truncate(site.bloggerBadge.trim(), telegramBudget.badge))}`;
  return value;
}

export function renderTelegram({ site, comment, parent, time, url }) {
  const name = truncate(siteName(site), telegramBudget.site);
  const heading = parent ? `您在 ${name} 上有新回复` : `您在 ${name} 上有新评论`;
  const lines = [
    `<b>${escapeHTML(heading)}</b>`,
    `文章：${escapeHTML(truncate(pageTitle(comment), telegramBudget.title))}`,
    `发布时间：${escapeHTML(time)}`,
    "",
  ];
  if (parent) {
    lines.push(`${telegramAuthor(parent, site, telegramBudget.parentAuthor)} 的评论：`);
    lines.push(`<blockquote>${escapeHTML(truncate(plainContent(parent.content), telegramBudget.parent))}</blockquote>`);
  }
  lines.push(`${telegramAuthor(comment, site, telegramBudget.author)} ${parent ? "的回复" : "的评论"}：`);
  lines.push(escapeHTML(truncate(plainContent(comment.content), telegramBudget.content)));
  lines.push("", `<a href="${escapeHTML(url)}">查看原文</a>`);
  return lines.join("\n");
}

// 评论被删除后，已发出的 Telegram 消息改写为这段文字，不再保留昵称和正文。
export function renderTelegramRetracted({ site, comment, parent }) {
  const name = truncate(siteName(site), telegramBudget.site);
  const heading = parent ? `您在 ${name} 上有新回复` : `您在 ${name} 上有新评论`;
  return [
    `<b>${escapeHTML(heading)}</b>`,
    `文章：${escapeHTML(truncate(pageTitle(comment), telegramBudget.title))}`,
    "",
    "<i>这条评论已被删除，通知内容已移除。</i>",
  ].join("\n");
}

// ---- 脱敏 fixture ----

const blog = { name: "Dejavu's Blog", domain: "blog.example.com", bloggerBadge: "[博主]", smojiOrigin: "https://static.example.com" };
const wave = "![smoji:挥手](https://static.example.com/smoji/cats/wave.svg)";
const thanks = "![smoji:谢谢](https://static.example.com/smoji/paper/thanks.svg)";
const article = "https://blog.example.com/guides/sqlite-backup";

export const fixtureImages = {
  "https://static.example.com/smoji/cats/wave.svg": "../smoji-candidate/fixtures/cat-wave.svg",
  "https://static.example.com/smoji/paper/thanks.svg": "../smoji-candidate/fixtures/paper-thanks.svg",
};

export const scenarios = {
  comment: {
    label: "新评论",
    site: blog,
    comment: { id: 1041, username: "林峤", isBlogger: false, pageTitle: "SQLite 备份与恢复指南", content: `备份步骤很清楚。${wave}\n是否可以补充一下停服后怎样校验备份文件完整性？` },
    time: "2026/09/29 10:18 (UTC+8)",
    url: `${article}#ecoku-comment-1041`,
  },
  reply: {
    label: "新回复",
    site: blog,
    parent: { username: "青崖", isBlogger: false, content: "这套迁移流程是否也适合评论数量较多的站点？" },
    comment: { id: 1042, username: "木泽", isBlogger: false, pageTitle: "SQLite 备份与恢复指南", content: `可以。建议先在备份副本上验证迁移时间，再安排停服窗口。${thanks}` },
    time: "2026/09/29 11:02 (UTC+8)",
    url: `${article}#ecoku-comment-1042`,
  },
  visitor: {
    label: "访客收到回复",
    site: blog,
    parent: { username: "青崖", isBlogger: false, content: "这套迁移流程是否也适合评论数量较多的站点？" },
    comment: { id: 1043, username: "站长", isBlogger: true, pageTitle: "SQLite 备份与恢复指南", content: "适合。评论较多时，建议先在副本上计时，再决定停服窗口。" },
    time: "2026/09/29 12:40 (UTC+8)",
    url: `${article}#ecoku-comment-1043`,
  },
  long: {
    label: "长内容",
    site: { ...blog, smojiOrigin: "https://static.example.com" },
    parent: { username: "一位名称较长的访客", isBlogger: false, content: "博主怎么切换地区配置文件啊，我找到的教程都不适用，而且也有人说桥接不用改地区。" },
    comment: {
      id: 522,
      username: "D:\\Forgejo\\Blog\\content\\posts\\windows-ai-dev-environment",
      isBlogger: false,
      pageTitle: "在 Windows 上搭建以 WSL2 为构建运行时、Windows 为源码权威的 AI 辅助开发环境：从目录约定、工具链隔离到 Docker 与 Playwright 的完整实践",
      content: `恩山论坛和张大妈上面有教程，因为我没有跨运营商和地区 ![smoji:在忙勿扰](https://cdn.other.example/smoji/busy.webp)\nabcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz`,
    },
    time: "2026/09/29 23:59 (UTC+8)",
    url: "https://blog.example.com/posts/windows-ai-dev-environment#ecoku-comment-522",
  },
  fallback: {
    label: "名称回落",
    site: { name: "", domain: "notes.example.test", bloggerBadge: "", smojiOrigin: "" },
    comment: { id: 7, username: "初七", isBlogger: false, pageTitle: "", content: "站点名称留空时，标题与页脚使用站点域名；文章标题为空时显示“这篇文章”。" },
    time: "2026/09/29 08:05 (UTC+8)",
    url: "https://notes.example.test/notes/domain-fallback#ecoku-comment-7",
  },
};
