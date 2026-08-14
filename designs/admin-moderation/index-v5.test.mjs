import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(directory, "index-v5.html"), "utf8");

assert.match(
  html,
  /name="comment-sort" checked>最新评论<\/label><label class="radio-label"><input type="radio" name="comment-sort">最早评论/,
  "site settings should default to newest comments while offering both approved choices"
);
assert.match(html, /#ecoku-comment-\$\{comment\.id\}/, "public comments should deep-link to their stable SDK anchor");
assert.match(html, />查看原评论<\/a>/, "published comments should expose a direct source link");
assert.doesNotMatch(html, /站点域名|site-domain-output|new URL\(siteURLInput\.value\)/, "the derived domain must stay internal rather than appear as a redundant form row");
assert.match(html, /inputRow\("站点名称"/, "site settings should expose the optional display name");
assert.doesNotMatch(html, /审核方式|待审核|批准所选|拒绝所选|moderation-pending|default_status/, "the approved always-published product must not expose moderation workflow controls");
assert.match(html, /评论管理/, "the primary workspace should be presented as comment management");
assert.match(html, /id="site-comment-limit"[^>]*min="1"[^>]*max="10000"/, "site settings should constrain the per-site comment limit");
assert.match(html, /textareaRow\("无评论文案"/, "site settings should expose the empty-comment copy");
assert.match(html, /\.queue-tail\s*\{[^}]*grid-template-columns:[^}]*54px;/s, "queue relation and status columns should stay aligned");
assert.match(html, /\.queue-row:not\(:has\(\.queue-check-wrap\)\) \.queue-item \{ grid-column: 1 \/ -1;/, "non-selectable queues should keep the item across both grid columns");
assert.match(html, /email-blogger-new-comment-v5\.html/, "blogger new-comment email preview should stay available");
assert.match(html, /email-blogger-new-reply-v5\.html/, "blogger new-reply email preview should stay available");
assert.match(html, /email-visitor-reply-v5\.html/, "visitor reply email preview should stay available");
assert.match(html, /email-domain-fallback-v5\.html/, "site-name fallback preview should stay available");
assert.match(html, /telegram-notification-v5\.html/, "Telegram preview should stay available");

for (const file of [
  "email-blogger-new-comment-v5.html",
  "email-blogger-new-reply-v5.html",
  "email-visitor-reply-v5.html",
  "email-domain-fallback-v5.html",
  "telegram-notification-v5.html"
]) {
  assert.ok(fs.existsSync(path.join(directory, file)), `${file} should exist`);
}

for (const file of [
  "email-blogger-new-comment-v5.html",
  "email-blogger-new-reply-v5.html",
  "email-visitor-reply-v5.html",
  "email-domain-fallback-v5.html"
]) {
  const email = fs.readFileSync(path.join(directory, file), "utf8");
  assert.match(email, /<table role="presentation"/, `${file} should use email-safe table layout`);
  assert.doesNotMatch(
    email,
    /<script|打开审核台|审核状态|评论人\s*IP|User-Agent|地区|\/admin\//,
    `${file} should be send-ready and contain no review-console action or excluded metadata`
  );
}

const bloggerComment = fs.readFileSync(path.join(directory, "email-blogger-new-comment-v5.html"), "utf8");
const visitorReply = fs.readFileSync(path.join(directory, "email-visitor-reply-v5.html"), "utf8");
const fallback = fs.readFileSync(path.join(directory, "email-domain-fallback-v5.html"), "utf8");
const telegram = fs.readFileSync(path.join(directory, "telegram-notification-v5.html"), "utf8");
assert.match(bloggerComment, /您在 Dejavu's Blog 上有新评论/, "configured site name should appear in blogger notifications");
assert.match(bloggerComment, />文章<\/td>[\s\S]*SQLite 备份与恢复指南/, "blogger notifications should show the article title rather than the page key");
assert.match(bloggerComment, /此邮件由 Dejavu's Blog 系统发送，请勿直接回复本邮件。/, "blogger notification footer should use the approved sender copy");
assert.match(bloggerComment, /href="https:\/\/blog\.dejavu\.moe\/guides\/sqlite-backup"/, "blogger new-comment email should link to its source page");
assert.match(visitorReply, /你在 Dejavu's Blog 的评论收到了回复/, "visitor reply email should identify the site by display name");
assert.match(visitorReply, /href="https:\/\/blog\.dejavu\.moe\/guides\/sqlite-backup#ecoku-comment-1042"/, "visitor reply email should deep-link to the public reply");
assert.match(fallback, /您在 notes\.example\.test 上有新评论/, "blank site name should visibly fall back to the parsed domain");
assert.match(fallback, /此邮件由 notes\.example\.test 系统发送，请勿直接回复本邮件。/, "domain fallback footer should use the resolved domain as the site name");
assert.match(fallback, /href="https:\/\/notes\.example\.test\//, "domain fallback preview should keep the matching site URL");
assert.doesNotMatch(telegram, /打开审核台|评论人IP|评论人 IP|审核状态|\/admin\//, "Telegram messages should not expose review actions or excluded metadata");
assert.match(telegram, /您在 Dejavu's Blog 上有新评论/, "Telegram notifications should use the same site-aware title wording");
assert.match(telegram, /data-variant="comment"[\s\S]*data-variant="reply"[\s\S]*data-variant="long"[\s\S]*data-variant="fallback"/, "Telegram preview should cover realistic notification variants");

console.log("admin moderation v5 static contract tests passed");
