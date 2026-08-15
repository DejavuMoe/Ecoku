import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, "index-v10.html"), "utf8");

const checks = [
  ["默认跟随系统配色", /<html lang="zh-CN" data-theme="auto">/],
  ["浅色与深色 color-scheme", /name="color-scheme" content="light dark"/],
  ["深色纸张与评论区对齐", /html\[data-theme="dark"\][\s\S]*--paper: rgb\(26, 29, 32\)[\s\S]*--surface: rgb\(34, 38, 42\)[\s\S]*--ink: rgb\(242, 236, 226\)/],
  ["auto 跟随系统深色", /@media \(prefers-color-scheme: dark\)[\s\S]*html\[data-theme="auto"\][\s\S]*--paper: rgb\(26, 29, 32\)/],
  ["原型可预览三种配色", /<option value="auto" selected>跟随系统<\/option>[\s\S]*<option value="light">浅色<\/option>[\s\S]*<option value="dark">深色<\/option>/],
  ["预览控件标明不进入生产", /生产默认 auto，右下角预览控件不进入管理端/],
  ["第四个导航为安全", /评论管理[\s\S]*站点管理[\s\S]*通知设置[\s\S]*>安全</],
  ["实例级 Turnstile 标题", /Cloudflare Turnstile/],
  ["不分站点说明", /不按站点分开/],
  ["同时用于评论和登录", /访客评论和管理员登录/],
  ["官方 Sitekey 字段", /inputRow\("Sitekey"/],
  ["官方 Secret key 字段", /inputRow\("Secret key"/],
  ["不提供模式卡片", /id="widget-mode-label"/],
  ["不提供 Cloudflare 控制台说明", /Cloudflare 控制台/],
  ["Sitekey 无帮助文案", /公开标识，用于在评论区/],
  ["Secret key 无帮助文案", /仅用于服务端 Siteverify/],
  ["不写 Pre-clearance 说明", /为已验证的访问者跳过将来的安全规则质询/],
  ["登录自动通过场景", /login-auto/],
  ["登录需要勾选场景", /login-interact/],
  ["登录 clearance 跳过场景", /login-skip/],
  ["登录标题", /管理员登录/],
  ["未启用验证场景", /login-off/],
  ["验证失败场景", /login-failed/],
];

const absent = new Set([
  "不提供模式卡片",
  "不提供 Cloudflare 控制台说明",
  "Sitekey 无帮助文案",
  "Secret key 无帮助文案",
  "不写 Pre-clearance 说明",
]);

let failed = false;
for (const [label, pattern] of checks) {
  const matched = pattern.test(html);
  const shouldBeAbsent = absent.has(label);
  if (shouldBeAbsent ? matched : !matched) {
    failed = true;
    console.error(`FAIL ${label}`);
  } else {
    console.log(`PASS ${label}`);
  }
}

if (/fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|indexedDB|sessionStorage/.test(html)) {
  failed = true;
  console.error("FAIL 静态原型不应访问生产接口或持久化数据");
} else {
  console.log("PASS 静态原型无生产接口或持久化写入");
}

if (/通知判定预览|评论通知判定|notification-matrix/.test(html)) {
  failed = true;
  console.error("FAIL 不应展示通知判定规则");
} else {
  console.log("PASS 通知判定规则未作为界面文案展示");
}

if (failed) process.exit(1);
