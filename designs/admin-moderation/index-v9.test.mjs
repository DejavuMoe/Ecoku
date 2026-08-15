import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, "index-v9.html"), "utf8");

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
  ["站点密钥与密钥字段", /站点密钥[\s\S]*密钥/],
  ["密钥不回显明文", /界面不回显明文/],
  ["三种小组件模式", /托管[\s\S]*非交互式[\s\S]*不可见/],
  ["托管为推荐", /badge: "推荐"/],
  ["不可见隐私条款提示", /Turnstile 隐私补充条款/],
  ["域名列表提示", /管理端来源和所有评论站点来源/],
  ["登录页场景", /login-managed[\s\S]*login-noninteractive[\s\S]*login-invisible/],
  ["登录标题", /管理员登录/],
  ["未启用验证场景", /login-off/],
  ["验证失败场景", /login-failed/],
];

let failed = false;
for (const [label, pattern] of checks) {
  if (!pattern.test(html)) {
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
