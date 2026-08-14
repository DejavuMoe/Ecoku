import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, "index-v6.html"), "utf8");

const checks = [
  ["三种博主身份场景", /sites-blogger-configured[\s\S]*sites-blogger-empty[\s\S]*sites-blogger-validation/],
  ["博主身份字段", /inputRow\("博主昵称", "blogger-name"[\s\S]*inputRow\("博主邮箱", "blogger-email"/],
  ["双字段联合校验", /博主昵称与邮箱需同时填写/],
  ["私有身份提示", /仅用于私有身份匹配，不会公开/],
  ["沿用已批准管理端导航", /评论管理[\s\S]*站点管理[\s\S]*通知设置/],
  ["响应式站点布局", /@media \(max-width: 1023px\)/],
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

if (/fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|indexedDB/.test(html)) {
  failed = true;
  console.error("FAIL 静态原型不应访问生产接口或持久化数据");
} else {
  console.log("PASS 静态原型无生产接口或持久化写入");
}

if (/通知判定预览|评论通知判定|notification-matrix/.test(html)) {
  failed = true;
  console.error("FAIL 不应在站点表单展示通知判定规则");
} else {
  console.log("PASS 通知判定规则未作为界面文案展示");
}

if (failed) process.exit(1);
