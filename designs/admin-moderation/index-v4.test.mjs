import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(directory, "index-v4.html"), "utf8");

assert.match(
  html,
  /name="comment-sort" checked>最新评论<\/label><label class="radio-label"><input type="radio" name="comment-sort">最早评论/,
  "site settings should default to newest comments while offering both approved choices"
);
assert.match(html, /const publicComment = comment\.status !== "pending";/, "pending comments must not receive a public anchor");
assert.match(html, /`#ecoku-comment-\$\{comment\.id\}`/, "public comments should deep-link to their stable SDK anchor");
assert.match(html, /publicComment \? "查看原评论" : "打开原页面"/, "the source action should explain whether it opens a comment or only its page");
assert.match(html, /email-admin-notification-v4\.html/, "notification preview links should stay inside the design project");
assert.match(html, /email-reply-notification-v4\.html/, "reply notification preview should stay available");
assert.match(html, /telegram-notification-v4\.html/, "Telegram preview should stay available");

for (const file of [
  "email-admin-notification-v4.html",
  "email-reply-notification-v4.html",
  "telegram-notification-v4.html"
]) {
  assert.ok(fs.existsSync(path.join(directory, file)), `${file} should exist`);
}

console.log("admin moderation v4 static contract tests passed");
