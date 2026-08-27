import fs from "node:fs";
import path from "node:path";

const base = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1"));
const read = (name) => fs.readFileSync(path.join(base, name), "utf8");
const publicHtml = read("index.html");
const adminHtml = read("admin.html");
const css = read("styles.css");
const source = read("prototype.js");
const architecture = read("architecture.md");
const manifest = JSON.parse(read("smoji.json"));

const checks = [
  [publicHtml.includes('data-design-status="approved"') && adminHtml.includes('data-design-status="approved"'), "两个界面均记录为已批准附加设计"],
  [css.includes('@import url("../plain-thread-comments/styles-v16.css")'), "前台继承已批准 v16 评论区视觉基线"],
  [adminHtml.includes('font-family:') === false && css.includes('"Noto Serif SC"'), "管理端沿用已批准系统衬线栈"],
  [publicHtml.match(/data-smoji-trigger/g)?.length === 2, "根评论与内联回复均提供选择器触发器"],
  [publicHtml.includes('id="smoji-picker-template"') && publicHtml.includes('role="tablist"') && publicHtml.includes('role="tabpanel"'), "选择器具有对话框、标签页与面板语义"],
  [source.includes('addEventListener("click", () => openForTrigger(trigger))') && source.includes("openForTrigger(trigger)") && source.includes("void populatePicker(picker, textarea, trigger)") && source.includes("return manifestPromise"), "清单请求只由选择器打开路径触发"],
  [source.includes('credentials: "omit"') && source.includes('referrerPolicy: "no-referrer"'), "清单请求不带凭据和来源页"],
  [source.includes("262144") && source.includes("8000"), "清单具有 256 KiB 与 8 秒边界"],
  [source.includes("manifestPromise") && source.includes("if (!manifestPromise)"), "多个编辑器共享一次内存加载"],
  [source.includes("exactKeys") && source.includes("validateManifest"), "原型拒绝未知字段并校验 v1 结构"],
  [source.includes('src.origin !== sourceUrl.origin'), "图片限制为清单同源"],
  [source.includes('const marker = `![smoji:${item.label}](${item.src})`'), "选择后插入自包含直链标记"],
  [source.includes("document.createTextNode") && source.includes("document.createElement(\"img\")"), "正文按文本节点和安全图片节点分段渲染"],
  [!source.includes("innerHTML"), "原型不使用 innerHTML 渲染远程数据或评论"],
  [source.includes('image.loading = "lazy"') && source.includes('image.referrerPolicy = "no-referrer"'), "表情图片延迟加载且不发送文章 referrer"],
  [publicHtml.includes("表情包暂时无法加载") && publicHtml.includes("评论仍可使用") === false && source.includes("评论仍可使用"), "加载失败不阻断普通评论"],
  [adminHtml.includes('id="smoji-enabled"') && adminHtml.includes('id="smoji-url"'), "管理端只暴露启用开关和单一清单 URL"],
  [adminHtml.includes("资源服务可能看到访客 IP 和请求时间"), "管理端明确直链隐私代价"],
  [!adminHtml.includes("预览表情") && !adminHtml.includes("测试连接"), "管理端不抓取或预览远程清单"],
  [/server does not fetch it/i.test(architecture) && architecture.includes("SSRF"), "架构明确服务端不抓取远程 JSON"],
  [architecture.includes("Disabling Smoji") && architecture.includes("literal"), "架构定义关闭后的历史标记行为"],
  [architecture.includes("ordinary Markdown") && architecture.includes("literal text"), "除 Smoji 标记外仍保持纯文本"],
  [manifest.version === 1 && Array.isArray(manifest.packs) && manifest.packs.length === 2, "fixture 使用单文档 v1 格式"],
  [manifest.packs.every((pack) => Object.keys(pack).sort().join() === "id,items,label"), "pack 不携带样式或执行字段"],
  [manifest.packs.flatMap((pack) => pack.items).every((item) => Object.keys(item).sort().join() === "id,label,src"), "item 只有 id、label 与直链 src"],
];

let failed = false;
for (const [ok, label] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failed = true;
}

const all = [publicHtml, adminHtml, css, source, architecture, JSON.stringify(manifest)].join("\n");
if (/git\.via\.moe|dejavu\.moe|@dejavu\.moe/.test(all)) {
  failed = true;
  console.error("FAIL 候选原型不得包含真实域名或邮箱");
} else {
  console.log("PASS 候选原型只使用脱敏占位符");
}

if (/localStorage|sessionStorage|indexedDB|document\.cookie/.test(source)) {
  failed = true;
  console.error("FAIL Smoji 原型不得持久化清单或选择历史");
} else {
  console.log("PASS Smoji 清单只在内存中复用");
}

if (failed) process.exit(1);
