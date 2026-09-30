import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, "index-v15.html"), "utf8");
const css = fs.readFileSync(path.join(here, "styles-v15.css"), "utf8");
const js = fs.readFileSync(path.join(here, "prototype-v15.js"), "utf8");
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
  ["印章配色经自定义属性进入 use", html, /style="fill: var\(--seal\)"[\s\S]*style="stroke: var\(--seal-cut\)"/],
  ["四项管理导航", html, /data-view-link="comments">评论<[\s\S]*data-view-link="sites">站点<[\s\S]*data-view-link="notifications">通知<[\s\S]*data-view-link="security">安全</],
  ["页边栏与正文栏共用网格", css, /\.layout \{[^}]*grid-template-columns: var\(--margin-w\) minmax\(0, 1fr\)/],
  ["站点切换位于评论与站点页的页边", html, /id="view-comments"[\s\S]*class="in-margin head-margin"><div class="site-switch" data-site-switch>[\s\S]*id="view-sites"[\s\S]*class="in-margin head-margin"><div class="site-switch" data-site-switch>/],
  ["实例级页面标注范围", html, /id="view-notifications"[\s\S]*class="scope">实例设置<[\s\S]*id="view-security"[\s\S]*class="scope">实例设置</],
  ["标题沿用评论区“N 条评论”", html, /id="title-count"[^>]*>506<\/span> <span id="title-noun">条评论</],
  ["只有已发布与已删除", html, /data-status="published">已发布[\s\S]*｜[\s\S]*data-status="deleted">已删除/],
  ["评论区同款分页", html, /‹ 上一页[\s\S]*pager-sep[\s\S]*pager-status[\s\S]*下一页 ›/],
  ["评论按日期分组", js, /"今天"[\s\S]*"昨天"[\s\S]*class="day layout"/],
  ["回复显示父评论并可跳转", js, /class="entry-quote" href="#c-\$\{parent\.id\}" data-jump/],
  ["父评论不在本页时如实说明", js, /回复 #\$\{c\.parent\}[\s\S]*不在当前页/],
  ["评论信息逐项可见", js, /^(?=[\s\S]*私有邮箱)(?=[\s\S]*访客网站)(?=[\s\S]*文章标题)(?=[\s\S]*页面 key)(?=[\s\S]*父评论)/],
  ["墓碑删除与彻底删除", js, /墓碑删除[\s\S]*彻底删除[\s\S]*仍有回复，不能彻底删除/],
  ["删除在评论旁确认", js, /^(?=[\s\S]*class="entry-confirm" role="alertdialog")(?=[\s\S]*墓碑删除这条评论？)(?=[\s\S]*下面的回复保留不变。此操作无法撤销。)(?=[\s\S]*彻底删除这条墓碑？)(?=[\s\S]*这条墓碑会从数据库中移除。此操作无法撤销。)/],
  ["查看原评论锚点", js, /ecoku-comment-\$\{c\.id\}/],
  ["键盘快捷键", js, /^(?=[\s\S]*k === "j")(?=[\s\S]*k === "k")(?=[\s\S]*k === "o")(?=[\s\S]*k === "Delete")(?=[\s\S]*k === "Escape")/],
  ["加载、空与失败状态", js, /skeleton-entry[\s\S]*无法连接到 Ecoku，请检查网络后重试。[\s\S]*当前没有/],
  ["没有站点时引导新增", js, /当前实例还没有站点。[\s\S]*新增站点/],
  ["删除失败提示留在评论旁", js, /S\.actionError && S\.actionError\.id === c\.id/],
  ["有改动才出现保存栏", html, /id="savebar" class="savebar in-main"[^>]*hidden/],
  ["保存栏文案", js, /有未保存的修改[\s\S]*新站点尚未创建[\s\S]*有 \$\{S\.errorCount\} 处需要修改[\s\S]*创建站点[\s\S]*保存站点/],
  ["离开前确认放弃修改", html, /放弃未保存的修改？[\s\S]*离开后，本页的修改不会保存。[\s\S]*继续编辑[\s\S]*放弃修改/],
  ["邮件与 Telegram 分别保存", js, /电子邮件通知已保存。[\s\S]*Telegram 通知已保存。/],
  ["评论区同款行式字段", css, /\.rule \{[^}]*grid-template-columns: var\(--label-w\) minmax\(0, 1fr\)[^}]*border-bottom: 1px solid var\(--line\)/],
  ["逐行横线的多行输入", css, /\.ruled-paper \{[^}]*repeating-linear-gradient/],
  ["站点表单字段完整", html, /site-id[\s\S]*site-url[\s\S]*site-name[\s\S]*site-origins[\s\S]*site-sort[\s\S]*site-email-required[\s\S]*site-website-required[\s\S]*site-placeholder[\s\S]*site-limit[\s\S]*site-empty[\s\S]*smoji-enabled[\s\S]*smoji-manifest-url[\s\S]*blogger-nickname[\s\S]*blogger-email[\s\S]*blogger-passphrase[\s\S]*blogger-badge/],
  ["站点表单关键说明", html, /每行一个完整来源[\s\S]*中文、日文、韩文与其他 Unicode 字符均按一个字符计数[\s\S]*可能向该站点暴露访客 IP[\s\S]*仅用于通知去重与历史评论回填，不会公开[\s\S]*留空则不显示/],
  ["站点表单校验文案", html, /站点 ID 格式无效[\s\S]*站点 URL 格式无效[\s\S]*允许来源格式无效[\s\S]*评论长度上限需为 1 至 10000[\s\S]*博主昵称与邮箱需同时填写[\s\S]*启用博主身份时必须设置口令/],
  ["邮件通知字段完整", html, /email-server[\s\S]*email-port[\s\S]*email-encryption[\s\S]*email-user[\s\S]*email-password[\s\S]*email-sender[\s\S]*email-recipients/],
  ["只有 SSL/TLS 与 STARTTLS", html, /value="tls"[\s\S]*value="starttls"/],
  ["Telegram 字段完整", html, /telegram-token[\s\S]*telegram-targets/],
  ["测试发送使用当前表单", html, /id="email-test"[\s\S]*发送测试邮件[\s\S]*id="telegram-test"[\s\S]*发送测试消息/],
  ["收件人分隔说明", html, /按 Enter、逗号或换行添加多个邮箱[\s\S]*按 Enter、逗号或换行添加；支持用户、群组、频道 ID/],
  ["密钥不回显", html, /id="email-password"[^>]*type="password"[\s\S]*id="telegram-token"[^>]*type="password"[\s\S]*id="turnstile-secret"[^>]*type="password"[\s\S]*id="cap-secret"[^>]*type="password"/],
  ["实例级验证范围", html, /同时用于访客评论和管理员登录，不按站点分开/],
  ["三种互斥提供方", html, /value="off"[\s\S]*value="turnstile"[\s\S]*value="cap"/],
  ["Cap 登录状态", js, /点击进行真人验证[\s\S]*正在验证…[\s\S]*验证已完成[\s\S]*验证失败，请重试/],
  ["Cap 官方尺寸", css, /--cap-widget-height: 58px;[\s\S]*--cap-widget-width: 260px;/],
  ["Cap 端点尾斜杠", html, /data-cap-api-endpoint="https:\/\/cap\.example\.com\/d9256640cb53\/"/],
  ["会话过期提示", js, /管理会话已过期，请重新登录。/],
  ["退出失败提示", html, /退出失败，请重试。/],
  ["窄屏底部导航", css, /@media \(max-width: 859px\)[\s\S]*\.nav \{ display: none; \}[\s\S]*\.tabbar \{ position: fixed;[^}]*env\(safe-area-inset-bottom\)/],
  ["窄屏日期栏吸顶", css, /@media \(max-width: 859px\)[\s\S]*\.day-label \{ position: sticky;/],
  ["触屏输入不小于 16px", css, /@media \(pointer: coarse\)[\s\S]*font-size: max\(16px, 1em\)/],
  ["减少动态效果", css, /prefers-reduced-motion: reduce/],
  ["原型控件标记", html, /class="scenario-controller"[^>]*data-prototype-only="true"/],
];

const absent = [
  ["不使用系统衬线正文栈", css, /"Songti SC"|"STSong"|"Noto Serif SC"/],
  ["不加载网络字体", all, /@font-face|fonts\.googleapis|@import url/],
  ["无审核流程", all, /待审核|批准所选|拒绝所选|审核方式/],
  ["无普通用户、Count 或管理密钥", all, /用户注册|>Count<|management key|站点管理密钥/],
  ["无通知判定与模板预览", all, /通知判定预览|评论通知判定|notification-matrix|通知模板预览|\/admin\/templates\//],
  ["无不加密选项", html, /value="none"|不加密/],
  ["无运维恢复说明", all, /captcha disable|服务器恢复说明/],
  ["不新增会话面板或接入代码", all, /会话固定为登录后 8 小时|data-ecoku-mount|ecoku-loader\.js/],
  ["不展示接口没有的博主标记", js, /is_blogger|isBlogger/],
  ["无真实域名", `${all}\n${brand}`, /dejavu\.moe|via\.moe|gmail\.com/],
  ["无网络与持久化", all, /fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|indexedDB|sessionStorage|document\.cookie/],
  ["不使用 innerHTML 注入评论原文", js, /innerHTML = c\.content|innerHTML = comment\.content/],
  ["评论正文经过转义", js, /\$\{c\.content\}/],
  ["标志文件不带滤镜或渐变", brand, /Gradient|filter=|<filter/],
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
