import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const base = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1"));
const html = fs.readFileSync(path.join(base, "index-v8.html"), "utf8");
const css = fs.readFileSync(path.join(base, "styles-v8.css"), "utf8");
const js = fs.readFileSync(path.join(base, "prototype-v8.js"), "utf8");

const checks = [
  [html.includes('id="reply-template-v8"'), "独立回复编辑器模板"],
  [html.includes('name="parentId"'), "回复父评论 ID 锁定字段"],
  [!html.includes("在此设备保存"), "不显示设备记忆选择"],
  [!html.includes("忘记此设备信息"), "不显示手动清除入口"],
  [js.includes('event.stopImmediatePropagation()'), "阻止旧回复跳转流程"],
  [js.includes('window.confirm("当前回复尚未发布'), "非空草稿切换保护"],
  [js.includes('`${SERVER_URL}::${SITE_ID}`'), "身份按服务器与站点隔离"],
  [js.includes('indexedDB.open(DB_NAME, 1)'), "身份只写入 IndexedDB"],
  [js.includes('name: "AES-GCM"'), "AES-GCM 加密"],
  [js.includes("false, [\"encrypt\", \"decrypt\"]"), "不可导出设备密钥"],
  [js.includes("DEVICE_DAYS = 7"), "默认保存 7 天"],
  [js.includes("savedAt + DEVICE_TTL_MS"), "旧期限记录不会绕过 7 天上限"],
  [!js.includes("clearStoredIdentity"), "不主动清除浏览器站点数据"],
  [js.includes("await saveIdentity(currentIdentity())"), "提交后默认保存身份"],
  [js.includes("syncIdentityToRoot"), "根评论与回复共享身份"],
  [js.includes("state.activeCommentId"), "单一活动回复"],
  [css.includes(".reply-identity-grid"), "回复身份表单视觉"],
  [!js.includes("localStorage"), "身份实现未使用 localStorage"]
];

const failed = checks.filter(([ok]) => !ok);
for (const [ok, label] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
if (failed.length) process.exit(1);
