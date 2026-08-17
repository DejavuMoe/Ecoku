import fs from "node:fs";
import path from "node:path";

const base = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, "$1"));
const html = fs.readFileSync(path.join(base, "index-v16.html"), "utf8");
const css = fs.readFileSync(path.join(base, "styles-v16.css"), "utf8");
const source = fs.readFileSync(path.join(base, "prototype-v16-captcha.js"), "utf8");

const checks = [
  [html.includes('data-design-status="approved"'), "标明已批准设计基线"],
  [html.includes('href="styles-v16.css"'), "v16 样式入口"],
  [css.includes('@import url("./styles-v15.css")'), "完整继承已批准 v15 基线"],
  [html.includes("prototype-v13.js"), "继续沿用已批准评论渲染"],
  [html.includes("prototype-v14-reply.js"), "继续沿用已批准直接回复"],
  [html.includes("prototype-v15-embed.js"), "继续沿用已批准接入外壳"],
  [html.includes("prototype-v16-captcha.js"), "只叠加验证码提供方原型"],
  [html.includes('id="config-captcha-provider"'), "预览可切换机器人验证方式"],
  [html.includes('<option value="off">关闭</option>'), "保留关闭选项"],
  [html.includes('<option value="turnstile">Cloudflare Turnstile</option>'), "保留 Turnstile 选项"],
  [html.includes('<option value="cap" selected>Cap（自托管）</option>'), "新增自托管 Cap 选项"],
  [html.includes('id="config-turnstile-enabled"'), "保留旧原型 Turnstile 行为兼容层"],
  [html.includes('id="config-turnstile-interact"'), "Turnstile 交互场景仍可预览"],
  [html.includes('id="config-turnstile-cleared"'), "Turnstile Pre-clearance 场景仍可预览"],
  [html.includes('id="config-cap-fail"'), "Cap 服务故障场景可预览"],
  [html.includes('id="root-turnstile"'), "根评论保留验证槽"],
  [html.includes('class="turnstile-slot captcha-slot"'), "根评论和回复共享通用验证槽"],
  [css.includes("width: min(100%, 260px)"), "Cap 使用官方默认宽度"],
  [css.includes("--cap-background:"), "Cap 自定义背景"],
  [css.includes("--cap-border-color:"), "Cap 自定义边框"],
  [css.includes("--cap-border-radius: 14px"), "Cap 使用官方圆角"],
  [css.includes("--cap-widget-height: 58px"), "Cap 使用官方高度"],
  [css.includes("--cap-widget-width: 260px"), "Cap 使用官方组件宽度"],
  [css.includes("--cap-widget-padding: 14px") && css.includes("--cap-gap: 15px"), "Cap 使用官方内边距与间距"],
  [css.includes("--cap-font: inherit"), "Cap 继承宿主字体"],
  [css.includes("--cap-success-color: color-mix") && css.includes("--cap-error-color: color-mix"), "Cap 成功与错误颜色映射 Ecoku token"],
  [css.includes("--cap-checkbox-size: 25px") && css.includes("--cap-checkbox-border-radius: 6px"), "Cap 使用官方复选框几何"],
  [css.includes("--cap-spinner-color: var(--primary)"), "Cap 自定义进度环"],
  [css.includes(".cap-prototype-captcha") && source.includes('createElement("div", "cap-prototype-captcha")'), "Cap 使用官方容器结构"],
  [css.includes("cap-prototype-progress-ring") && source.includes("cap-prototype-progress-ring-circle"), "Cap 使用 SVG 进度环"],
  [source.includes("cap-prototype-checkmark") && source.includes("cap-prototype-error-icon"), "Cap 使用 SVG 状态图标"],
  [source.includes('createElement("span", "cap-prototype-credits", "Cap")'), "Cap 保留官方署名"],
  [source.includes('captcha.dataset.state = "verifying"') && source.includes('captcha.dataset.state = "done"') && source.includes('captcha.dataset.state = "error"'), "Cap 使用官方状态名称"],
  [!source.includes('checkbox.textContent = "✓"') && !source.includes("cap-prototype-spinner"), "不再自造文本对勾或粗糙 spinner"],
  [source.includes('data-cap-api-endpoint", "https://cap.example.com/SITE_KEY/"'), "Cap 端点使用脱敏占位符并保留尾斜杠"],
  [source.includes('data-cap-disable-haptics'), "评论区关闭移动端震动"],
  [source.includes('data-cap-i18n-initial-state'), "Cap 初始状态中文化"],
  [source.includes('data-cap-i18n-verifying-label'), "Cap 验证中状态中文化"],
  [source.includes('data-cap-i18n-solved-label'), "Cap 成功状态中文化"],
  [source.includes('data-cap-i18n-error-label'), "Cap 错误状态中文化"],
  [source.includes('data-cap-i18n-required-label'), "Cap 必填反馈中文化"],
  [source.includes('setCapState(slot, capFailure?.checked ? "error" : "solved")'), "故障场景不会伪造成功"],
  [source.includes('event.stopImmediatePropagation()'), "未验证时阻止评论提交"],
  [source.includes("请完成人机验证后再发布。"), "未验证提交反馈"],
  [source.includes("验证服务暂时不可用，请稍后重试。"), "Cap 故障反馈"],
  [source.includes('window.queueMicrotask(() => setCapState(slot, "idle"))'), "一次提交后重置单次令牌状态"],
  [source.includes("new MutationObserver(syncCapSlots)"), "动态回复框也挂载 Cap"],
  [!source.includes("fetch("), "原型不访问真实 Cap 实例"],
  [!html.includes("正在加载评论"), "继续保持 v15 无加载文案"],
  [html.includes("评论服务尚未配置。"), "继续保留未配置状态"],
];

let failed = false;
for (const [ok, label] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failed = true;
}

if (/capjs\.via\.moe|git\.via\.moe/.test([html, css, source].join("\n"))) {
  failed = true;
  console.error("FAIL 原型不得写入真实域名");
} else {
  console.log("PASS 原型仅使用脱敏占位域名");
}

if (/localStorage|sessionStorage|indexedDB|document\.cookie/.test(source)) {
  failed = true;
  console.error("FAIL 验证原型不得持久化状态");
} else {
  console.log("PASS 验证原型不持久化状态");
}

if (failed) process.exit(1);
