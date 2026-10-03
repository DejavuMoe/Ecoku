import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, "index-v16.html"), "utf8");
const css = fs.readFileSync(path.join(here, "styles-v16.css"), "utf8");
const js = fs.readFileSync(path.join(here, "prototype-v16.js"), "utf8");
const brand = ["ecoku-mark.svg", "favicon.svg", "ecoku-mark-mono.svg", "app-icon.svg"].map((f) => fs.readFileSync(path.join(here, "../brand", f), "utf8")).join("\n");
const all = `${html}\n${css}\n${js}`;

const SEAL_GLYPH = /M53\.5 12\.6H12\.6v38\.8h40\.9[\s\S]*x="30\.55" y="19\.7" width="10\.3" height="8\.9"[\s\S]*x="19\.7" y="35\.4" width="12\.6"[\s\S]*x="39\.1" y="35\.4" width="12\.6"/;

const present = [
  ["默认跟随系统配色", html, /<html lang="zh-CN" data-theme="auto">/],
  ["浅色与深色 color-scheme", html, /name="color-scheme" content="light dark"/],
  ["评论区 v17 纸张 token", css, /--paper: #f7f4ee;[\s\S]*--surface: #fbf9f5;[\s\S]*--ink: #1e1c19;/],
  ["评论区 v17 深色 token", css, /@media \(prefers-color-scheme: dark\)[\s\S]*html\[data-theme="auto"\][\s\S]*--paper: #1a1816;[\s\S]*--ink: #eee8dd;/],
  ["朱砂强调色与评论区一致", css, /--accent: color-mix\(in oklab, #c8553a 75%, var\(--ink\)\)/],
  ["印章朱砂色（浅色与深色）", css, /--seal: #b8472f;[\s\S]*--seal: #c55a40;/],
  ["系统 CJK 与英文字体栈", css, /--sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans CJK SC"/],
  ["评论区圆角 token", css, /--radius: 6px;[\s\S]*--radius-sm: 3px;/],
  ["favicon 使用品牌稿", html, /rel="icon" href="\.\.\/brand\/favicon\.svg"/],
  ["品牌印章与品牌文件同形", `${html}\n${brand}`, SEAL_GLYPH],
  ["四项管理导航", html, /data-view-link="comments">评论<[\s\S]*data-view-link="sites">站点<[\s\S]*data-view-link="notifications">通知<[\s\S]*data-view-link="security">安全</],
  ["页边栏与正文栏共用网格", css, /\.layout \{[^}]*grid-template-columns: var\(--margin-w\) minmax\(0, 1fr\)/],
  ["实例级页面标注范围", html, /id="view-notifications"[\s\S]*class="scope">实例设置<[\s\S]*id="view-security"[\s\S]*class="scope">实例设置</],
  ["评论按日期分组", js, /"今天"[\s\S]*"昨天"[\s\S]*class="day layout"/],
  ["删除在评论旁确认", js, /^(?=[\s\S]*class="entry-confirm" role="alertdialog")(?=[\s\S]*墓碑删除这条评论？)(?=[\s\S]*彻底删除这条墓碑？)/],
  ["键盘快捷键", js, /^(?=[\s\S]*k === "j")(?=[\s\S]*k === "k")(?=[\s\S]*k === "o")(?=[\s\S]*k === "Delete")(?=[\s\S]*k === "Escape")/],
  ["有改动才出现保存栏", html, /id="savebar" class="savebar in-main"[^>]*hidden/],
  ["离开前确认放弃修改", html, /放弃未保存的修改？[\s\S]*离开后，本页的修改不会保存。/],

  // v16: fewer rules.
  ["登录卡片保留评论区行式字段", css, /\.rule \{[^}]*border-bottom: 1px solid var\(--line\)/],
  ["设置字段改为输入框", css, /\.input \{[^}]*border: 1px solid var\(--line\);[^}]*border-radius: var\(--radius\);[^}]*background: var\(--surface\)/],
  ["只读值显示为文字", css, /\.input\[readonly\] \{[^}]*border-color: transparent;[^}]*background: transparent/],
  ["只在节与节之间画线", css, /\.doc-section \{ padding: 30px 0 34px; \}[\s\S]*\.doc-section \+ \.doc-section, \.doc \+ \.doc > \.doc-section:first-child \{ border-top: 1px solid var\(--line-soft\); \}/],
  ["日期之间画线，评论之间留白", css, /\.day \+ \.day \{ border-top: 1px solid var\(--line-soft\); \}[\s\S]*\.entry \+ \.entry \{ margin-top: 8px; \}/],
  ["文字操作平时不加下划线", css, /\.quiet-link \{[^}]*text-decoration-color: transparent;/],
  ["正文中的链接保留下划线", css, /\.help a \{[^}]*text-decoration-color: var\(--line\)/],
  ["验证方式以底色标出所选", css, /\.option-row:has\(input:checked\) \{ background: var\(--wash\); \}/],
  ["测试发送与新增站点是按钮", html, /id="new-site-button" class="button button-small"[\s\S]*id="email-test" class="button button-small"[\s\S]*id="telegram-test" class="button button-small"/],
  ["SMTP 服务器与端口同行", html, /class="host-pair">[\s\S]*id="email-server"[\s\S]*class="port-group"><label class="setting-label" for="email-port">端口<\/label>/],
  ["窄屏标签在控件上方", css, /@media \(max-width: 859px\)[\s\S]*\.setting \{ grid-template-columns: minmax\(0, 1fr\); row-gap: 6px; \}/],
  ["触屏控件加高", css, /@media \(pointer: coarse\)[\s\S]*--control: 42px;[\s\S]*font-size: max\(16px, 1em\)/],

  // v16: one input per item.
  ["三个多值字段使用逐项列表", html, /id="site-origins" data-list="origins"[\s\S]*id="email-recipients" data-list="email"[\s\S]*id="telegram-targets" data-list="telegram"/],
  ["每项有删除按钮与添加按钮", js, /class="row-remove"[^`]*data-remove-row[\s\S]*class="list-add"[^`]*data-add-row/],
  ["Enter 进入下一项而不是提交", js, /event\.key === "Enter" && !event\.isComposing[\s\S]*event\.preventDefault\(\);[\s\S]*insertRows\(key, i \+ 1, \[""\]\)/],
  ["空项按退格删除", js, /event\.key === "Backspace" && !t\.value && values\.length > 1/],
  ["上下方向键在项之间移动", js, /event\.key === "ArrowDown"[\s\S]*event\.key === "ArrowUp"/],
  ["粘贴多行逐项拆分", js, /split\(\/\[\\s,，;；\]\+\/\)[\s\S]*已添加 \$\{added\} 项/],
  ["离开该项后才提示错误", js, /addEventListener\("focusout"[\s\S]*S\.committed\[item\.key\]\[item\.i\] = true/],
  ["来源可一键修正", js, /只填来源，不含路径[\s\S]*fix: u\.origin[\s\S]*改为 \$\{esc\(issue\.fix\)\}/],
  ["缺少协议时给出修正（本机用 http）", js, /localhost\|127\\\.0\\\.0\\\.1\)\$\/\.test\(guess\.hostname\) \? "http" : "https"[\s\S]*缺少协议/],
  ["重复项提示保存时合并", js, /与第 \$\{first \+ 1\} 项重复，保存时合并/],
  ["来源上限 32 项", js, /max: 32[\s\S]*已达上限 \$\{cfg\.max\} 项/],
  ["Telegram 用户名给出明确提示", js, /不支持 @用户名，请填写数字 ID/],
  ["空项不算修改", js, /parts\.push\(JSON\.stringify\(filled\(FORM_LISTS\[key\]\)\)\)/],
  ["每项错误分别计数", js, /countErrors[\s\S]*typeof v === "number"/],
  ["列表必填说明", html, /至少填写一个允许来源[\s\S]*至少填写一个收件人[\s\S]*至少填写一个接收目标/],
  ["列表操作说明", html, /按 Enter 添加下一项，可一次粘贴多行[\s\S]*按 Enter 添加下一项，可一次粘贴多行[\s\S]*按 Enter 添加下一项/],

  // Fields the production console already has.
  ["评论区语言为单选", html, /name="site-i18n" value="zh-CN"><span class="lang" lang="zh-CN">简体中文[\s\S]*value="zh-Hant"><span class="lang" lang="zh-Hant">繁體中文[\s\S]*value="en"><span class="lang" lang="en">English/],
  ["SDK 可以覆盖评论区语言", html, /接入 SDK 时传入 <code>i18n<\/code> 可以覆盖此设置/],
  ["Smoji 图片来源", html, /id="smoji-image-origin"[\s\S]*留空时与清单同源[\s\S]*图片来源无效；请填写 HTTPS 来源，不含路径/],
  ["站点表单字段完整", html, /site-id[\s\S]*site-url[\s\S]*site-name[\s\S]*site-origins[\s\S]*site-i18n[\s\S]*site-sort[\s\S]*site-email-required[\s\S]*site-website-required[\s\S]*site-placeholder[\s\S]*site-limit[\s\S]*site-empty[\s\S]*smoji-enabled[\s\S]*smoji-manifest-url[\s\S]*smoji-image-origin[\s\S]*blogger-nickname[\s\S]*blogger-email[\s\S]*blogger-passphrase[\s\S]*blogger-badge/],
  ["邮件通知字段完整", html, /email-server[\s\S]*email-port[\s\S]*email-encryption[\s\S]*email-user[\s\S]*email-password[\s\S]*email-sender[\s\S]*email-recipients/],
  ["密钥不回显", html, /id="email-password"[^>]*type="password"[\s\S]*id="telegram-token"[^>]*type="password"[\s\S]*id="turnstile-secret"[^>]*type="password"[\s\S]*id="cap-secret"[^>]*type="password"/],
  ["三种互斥提供方", html, /value="off"[\s\S]*value="turnstile"[\s\S]*value="cap"/],
  ["减少动态效果", css, /prefers-reduced-motion: reduce/],
  ["原型控件标记", html, /class="scenario-controller"[^>]*data-prototype-only="true"/],
];

const absent = [
  ["不再使用逐行横线", all, /ruled-paper|repeating-linear-gradient/],
  ["不再使用 chip 输入", all, /chip-field|addChips|按 Enter、逗号或换行添加/],
  ["实例设置前不加短横线", css, /\.scope::before/],
  ["端口前不加竖线", css, /rule-label-inline|border-left: 1px solid var\(--line-soft\)/],
  ["评论之间不再画线", css, /\.entry \+ \.entry \{[^}]*border-top/],
  ["页底不再画线", css, /\.doc:last-of-type \.doc-section:last-child \{[^}]*border-bottom/],
  ["评论区语言不用原生下拉", html, /<select id="site-i18n"/],
  ["不使用系统衬线正文栈", css, /"Songti SC"|"STSong"|"Noto Serif SC"/],
  ["不加载网络字体", all, /@font-face|fonts\.googleapis|@import url/],
  ["无审核流程", all, /待审核|批准所选|拒绝所选|审核方式/],
  ["无普通用户、Count 或管理密钥", all, /用户注册|>Count<|management key|站点管理密钥/],
  ["无通知判定与模板预览", all, /通知判定预览|评论通知判定|notification-matrix|通知模板预览|\/admin\/templates\//],
  ["无不加密选项", html, /value="none"|不加密/],
  ["不展示接口没有的博主标记", js, /is_blogger|isBlogger/],
  ["无真实域名", `${all}\n${brand}`, /dejavu\.moe|via\.moe|gmail\.com|s3-cdn\.zsh\.moe/],
  ["无网络与持久化", all, /fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|indexedDB|sessionStorage|document\.cookie/],
  ["评论正文经过转义", js, /\$\{c\.content\}/],
  ["列表值经过转义", js, /value="\$\{value\}"/],
];

let failed = false;
for (const [label, source, pattern] of present) {
  const ok = pattern.test(source);
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failed = true;
}
for (const [label, source, pattern] of absent) {
  const ok = !pattern.test(source);
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
