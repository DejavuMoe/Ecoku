/* Ecoku admin v16 prototype. Static mock data only: no network, no storage. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const flat = (text) => String(text).replace(/\s+/g, " ").trim();

  // ---------- fixtures (sanitized) ----------
  const NOW = new Date(2026, 8, 28, 21, 30);
  const SITES = [
    {
      id: "blog.example.com", name: "Dejavu's Blog", siteUrl: "https://blog.example.com",
      allowedOrigins: ["http://localhost:1313", "https://blog.example.com"], i18n: "zh-CN", defaultSort: "newest",
      emailRequired: false, websiteRequired: false,
      placeholder: "仅支持纯文本，昵称为必填项，留下邮箱可在收到回复时获得通知。", commentLimit: 500,
      emptyMessage: "沙发空着也是空着，不如坐下唠两句？", smojiEnabled: true,
      smojiManifestUrl: "https://static.example.com/smoji/smoji.json", smojiImageOrigin: "https://cdn.example.com",
      bloggerNickname: "Dejavu Moe", bloggerEmail: "owner@example.com", bloggerBadge: "[博主]", bloggerPassphraseSet: true,
    },
    {
      id: "notes", name: "", siteUrl: "https://notes.example.org",
      allowedOrigins: ["https://notes.example.org"], i18n: "zh-Hant", defaultSort: "oldest",
      emailRequired: true, websiteRequired: false, placeholder: "写下评论（仅支持纯文本）", commentLimit: 1000,
      emptyMessage: "还没有评论\n成为第一个留下评论的人。", smojiEnabled: false, smojiManifestUrl: "", smojiImageOrigin: "",
      bloggerNickname: "", bloggerEmail: "", bloggerBadge: "[博主]", bloggerPassphraseSet: false,
    },
  ];

  const PUBLISHED = [
    { id: 519, parent: 517, username: "Kashyz", email: "kashyz@example.net", url: "", time: "2026/09/28 12:16", mark: "/posts/days-with-not-much-light/", title: "光线不多的日子", content: "OK，谢谢博主" },
    { id: 518, parent: 515, username: "Dejavu Moe", email: "owner@example.com", url: "https://blog.example.com", time: "2026/09/28 08:46", mark: "/posts/days-with-not-much-light/", title: "光线不多的日子", content: "以后有机会可以，暂时应该不会去上海哈哈" },
    { id: 517, parent: 516, username: "Dejavu Moe", email: "owner@example.com", url: "https://blog.example.com", time: "2026/09/28 08:44", mark: "/posts/days-with-not-much-light/", title: "光线不多的日子", content: "我用的就是内置的模板 Rhyhorn，把头像去掉后，这个比较简洁。\n可视化编辑就正常编辑呗，简历前面突出关键词和重点信息，如果投递某个岗位，可以把 JD 发给 AI 让他对应优化。" },
    { id: 516, parent: 0, username: "Kashyz", email: "kashyz@example.net", url: "", time: "2026/09/27 23:58", mark: "/posts/days-with-not-much-light/", title: "光线不多的日子", content: "师傅，我想问一下你的做简历的这个服务，我也尝试自己部署了这个 Reactive Resume，里面的简历模板师傅是直接用的自带的吗？然后这个感觉不太会使用，博主有没有什么可以分享的使用方法" },
    { id: 515, parent: 0, username: "yywr", email: "yywr@example.org", url: "https://yywr.example.org", time: "2026/09/27 21:22", mark: "/posts/days-with-not-much-light/", title: "光线不多的日子", content: "要是上海我们可以面个基，感觉你这工作和我同行了，刚开始工作杂点好，方便找下一份。" },
    { id: 514, parent: 0, username: "林间小径", email: "", url: "https://lin.example.org/about", time: "2026/09/26 19:03", mark: "/posts/rainy-season/", title: "梅雨季节", content: "读到“把窗户开一条缝”那段，想起小时候外婆家的阁楼。\n\n雨一直下，屋里有股木头的味道。\n谢谢你写下来。" },
    { id: 513, parent: 0, username: "一个名字特别特别长的访客昵称用于测试截断效果_abcdefghijklmnopqrstuvwxyz", email: "averyveryveryverylongmailboxnameforlayouttesting@subdomain.example.com", url: "https://an-extremely-long-hostname-for-layout-testing.example.com/path/to/a/deeply/nested/profile/page", time: "2026/09/26 10:41", mark: "/posts/2026/09/a-very-long-page-key-that-keeps-going-to-test-how-the-list-truncates-it/", title: "一篇标题非常非常长、用来检查详情页换行与截断表现的文章", content: "极端文本：https://example.com/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 以及 <script>alert(\"xss\")</script> 这段应当按纯文本显示。" },
    { id: 512, parent: 0, username: "阿青", email: "aqing@example.com", url: "", time: "2026/09/25 22:10", mark: "/posts/hello-world/", title: "Hello World", content: "打卡" },
    { id: 511, parent: 0, username: "Mori", email: "mori@example.jp", url: "https://mori.example.jp", time: "2026/09/24 14:27", mark: "/posts/cloudflare-waf-set-up-guide/", title: "Cloudflare WAF 防护策略简易指南", content: "按文中的规则配置之后，扫描器的请求少了很多。有一个问题：如果源站在国内，托管质询对访问速度影响大吗？" },
    { id: 510, parent: 0, username: "Sam", email: "sam@example.com", url: "", time: "2026/09/23 09:02", mark: "/posts/hugo-protected-leaf-bundle-demo/", title: "Hugo 受保护的页面包示例", content: "Great write-up. The part about page bundles finally made it click for me — thanks!" },
    { id: 509, parent: 471, username: "Pine", email: "pine@example.org", url: "", time: "2026/09/22 18:30", mark: "/posts/cloudflare-waf-set-up-guide/", title: "Cloudflare WAF 防护策略简易指南", content: "补充一下：规则里的国家代码要用两位大写字母。" },
  ];

  const DELETED = [
    { id: 487, parent: 486, hasChildren: false, time: "2026/08/30 13:24", mark: "/posts/cloudflare-waf-set-up-guide/", title: "Cloudflare WAF 防护策略简易指南" },
    { id: 486, parent: 0, hasChildren: true, time: "2026/08/30 13:23", mark: "/posts/cloudflare-waf-set-up-guide/", title: "Cloudflare WAF 防护策略简易指南" },
    { id: 485, parent: 0, hasChildren: false, time: "2026/08/27 16:08", mark: "/posts/hugo-protected-leaf-bundle-demo/", title: "Hugo 受保护的页面包示例" },
    { id: 468, parent: 467, hasChildren: false, time: "2026/08/18 08:12", mark: "/posts/hello-world/", title: "Hello World" },
  ];

  const NOTES_PUBLISHED = [
    { id: 3, parent: 0, username: "路人甲", email: "a@example.org", url: "", time: "2026/09/20 11:00", mark: "/2026/reading-list/", title: "九月书单", content: "《额尔古纳河右岸》也很好看。" },
    { id: 2, parent: 1, username: "Notes", email: "", url: "", time: "2026/09/19 20:15", mark: "/2026/reading-list/", title: "九月书单", content: "已经加进待读了。" },
    { id: 1, parent: 0, username: "路人乙", email: "b@example.org", url: "", time: "2026/09/19 18:40", mark: "/2026/reading-list/", title: "九月书单", content: "推荐一本《置身事内》。" },
  ];

  const SITE_DEFAULTS = { id: "", siteUrl: "", name: "", allowedOrigins: [], i18n: "zh-CN", defaultSort: "newest", emailRequired: true, websiteRequired: false, placeholder: "写下评论（仅支持纯文本）", commentLimit: 1000, emptyMessage: "还没有评论\n成为第一个留下评论的人。", smojiEnabled: false, smojiManifestUrl: "", smojiImageOrigin: "", bloggerNickname: "", bloggerEmail: "", bloggerBadge: "[博主]", bloggerPassphraseSet: false };

  // ---------- state ----------
  let S;
  let data;
  function freshState() {
    data = {
      "blog.example.com": { published: PUBLISHED.map((c) => ({ ...c })), deleted: DELETED.map((c) => ({ ...c })), counts: { published: 506, deleted: 15 } },
      notes: { published: NOTES_PUBLISHED.map((c) => ({ ...c })), deleted: [], counts: { published: 3, deleted: 0 } },
    };
    return {
      authed: true, login: "off", loginMessage: "", capState: "idle", logoutFailed: false,
      view: "comments", sites: SITES.map((s) => ({ ...s, allowedOrigins: [...s.allowedOrigins] })), siteId: "blog.example.com",
      status: "published", sort: "newest", page: 1, currentId: null, siteMenuOpen: false, sortMenuOpen: false,
      queue: "ready", confirm: null, actionError: null,
      creating: false, siteErrors: {}, siteMessage: "",
      email: { enabled: true, host: "smtp.example.com", port: 465, encryption: "tls", username: "notice@example.com", passwordSet: true, fromAddress: "notice@example.com", recipients: ["owner@example.com"] },
      emailErrors: {}, emailFeedback: null,
      telegram: { enabled: true, tokenSet: true, targets: ["123456789", "-1001234567890"] },
      telegramErrors: {}, telegramFeedback: null,
      captcha: { provider: "cap", turnstileSitekey: "0x4AAAAAAA00000000000000", capInstanceUrl: "https://cap.example.com", capSitekey: "d9256640cb53" },
      captchaErrors: {},
      draft: { origins: [], email: [], telegram: [] },
      committed: { origins: [], email: [], telegram: [] },
      errorCount: 0,
    };
  }

  const site = () => S.sites.find((s) => s.id === S.siteId) || null;
  const siteLabel = (s) => { if (!s) return ""; if (s.name) return s.name; try { return new URL(s.siteUrl).hostname; } catch { return s.id; } };
  const bucket = () => data[S.siteId] || { published: [], deleted: [], counts: { published: 0, deleted: 0 } };
  const pool = () => bucket()[S.status];
  const list = () => { const items = [...pool()]; return S.sort === "oldest" ? items.reverse() : items; };
  const findComment = (id) => pool().find((c) => c.id === id) || null;

  // ---------- scenarios ----------
  const SCENARIOS = [
    ["登录", [
      ["login-off", "未启用人机验证"], ["login-turnstile", "Turnstile"], ["login-cap", "Cap（点击可验证）"],
      ["login-cap-failed", "Cap 验证失败"], ["login-error", "用户名或密码错误"], ["session-expired", "会话过期"],
    ]],
    ["评论管理", [
      ["comments", "已发布"], ["comments-extreme", "极端文本"],
      ["comments-deleted", "已删除"], ["confirm-tombstone", "确认墓碑删除"], ["confirm-permanent", "确认彻底删除"],
      ["comments-action-error", "删除失败"], ["comments-empty", "空列表"], ["comments-loading", "加载中"], ["comments-error", "加载失败"],
      ["comments-single-site", "只有一个站点"], ["comments-site-menu", "切换站点"], ["comments-no-sites", "还没有站点"],
    ]],
    ["站点管理", [
      ["sites", "编辑站点"], ["sites-dirty", "有未保存的修改"], ["sites-create", "新增站点"], ["sites-errors", "校验错误（可一键修正）"],
      ["sites-duplicate", "来源重复（保存时合并）"], ["sites-discard", "离开前确认"],
    ]],
    ["通知设置", [
      ["notifications", "两个渠道已开启"], ["notifications-off", "邮件未开启（待保存）"], ["notifications-test-ok", "测试发送成功"],
      ["notifications-test-fail", "测试发送失败"], ["notifications-errors", "校验错误"], ["notifications-required", "收件人为空"],
    ]],
    ["安全", [["security-cap", "Cap"], ["security-turnstile", "Turnstile"], ["security-off", "关闭"], ["security-cap-errors", "Cap 校验错误"]]],
    ["其他", [["toast", "保存成功提示"], ["logout-failed", "退出失败"]]],
  ];

  function applyScenario(name) {
    S = freshState();
    S.preset = null;
    const [group] = name.split("-");
    if (["login", "session"].includes(group)) {
      S.authed = false;
      S.login = name === "login-turnstile" ? "turnstile" : name.startsWith("login-cap") ? "cap" : "off";
      if (name === "login-error") S.loginMessage = "用户名或密码错误。";
      if (name === "session-expired") S.loginMessage = "管理会话已过期，请重新登录。";
      S.capFails = name === "login-cap-failed";
      return;
    }
    switch (name) {
      case "comments-extreme": S.currentId = 513; S.scrollTo = 513; break;
      case "comments-deleted": S.status = "deleted"; break;
      case "confirm-tombstone": S.confirm = { id: 516, kind: "tombstone" }; S.currentId = 516; S.scrollTo = 516; break;
      case "confirm-permanent": S.status = "deleted"; S.confirm = { id: 487, kind: "permanent" }; S.currentId = 487; break;
      case "comments-action-error": S.currentId = 518; S.actionError = { id: 518, text: "数据已经被其他请求修改，请刷新后重试。" }; S.scrollTo = 518; break;
      case "comments-empty": S.status = "deleted"; data["blog.example.com"].deleted = []; data["blog.example.com"].counts.deleted = 0; break;
      case "comments-loading": S.queue = "loading"; break;
      case "comments-error": S.queue = "error"; break;
      case "comments-single-site": S.sites = S.sites.slice(0, 1); break;
      case "comments-site-menu": S.siteMenuOpen = true; break;
      case "comments-no-sites": S.sites = []; S.siteId = null; data = {}; break;
      case "sites": S.view = "sites"; break;
      case "sites-dirty": S.view = "sites"; S.preset = "site-dirty"; break;
      case "sites-create": S.view = "sites"; S.creating = true; break;
      case "sites-errors": S.view = "sites"; S.preset = "site-errors"; break;
      case "sites-duplicate": S.view = "sites"; S.preset = "site-duplicate"; break;
      case "sites-discard": S.view = "sites"; S.preset = "site-discard"; break;
      case "notifications": S.view = "notifications"; break;
      case "notifications-off": S.view = "notifications"; S.preset = "email-off"; break;
      case "notifications-test-ok": S.view = "notifications"; S.emailFeedback = { ok: true, text: "测试邮件已发送" }; break;
      case "notifications-test-fail": S.view = "notifications"; S.emailFeedback = { ok: false, text: "发送失败：SMTP 认证未通过" }; S.telegramFeedback = { ok: false, text: "发送失败：连接 Telegram 超时" }; break;
      case "notifications-errors": S.view = "notifications"; S.preset = "notify-errors"; break;
      case "notifications-required": S.view = "notifications"; S.preset = "notify-required"; break;
      case "security-cap": S.view = "security"; break;
      case "security-turnstile": S.view = "security"; S.captcha.provider = "turnstile"; break;
      case "security-off": S.view = "security"; S.captcha.provider = "off"; break;
      case "security-cap-errors": S.view = "security"; S.preset = "cap-errors"; break;
      case "toast": S.toastOnLoad = "站点设置已保存。"; S.view = "sites"; break;
      case "logout-failed": S.logoutFailed = true; break;
      default: break;
    }
  }

  // ---------- toast ----------
  let toastTimer;
  function toast(text) {
    const el = $("toast");
    el.innerHTML = icon("check") + `<span>${esc(text)}</span>`;
    el.hidden = false;
    $("sr-status").textContent = text;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
  }

  // ---------- shell ----------
  const VIEWS = ["comments", "sites", "notifications", "security"];
  function renderShell() {
    $("login-screen").hidden = S.authed;
    $("app-shell").hidden = !S.authed;
    if (!S.authed) return renderLogin();
    $$("[data-view-link]").forEach((link) => {
      if (link.classList.contains("brand")) return;
      if (link.dataset.viewLink === S.view) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
    });
    VIEWS.forEach((v) => { $(`view-${v}`).hidden = S.view !== v; });
    $("logout-error").hidden = !S.logoutFailed;
    if (S.view === "comments") renderComments();
    if (S.view === "sites") renderSites();
    if (S.view === "notifications") renderNotifications();
    if (S.view === "security") renderSecurity();
    renderSavebar();
  }

  // ---------- login ----------
  function renderLogin() {
    $("login-error").hidden = !S.loginMessage;
    $("login-error").textContent = S.loginMessage;
    $("login-turnstile").hidden = S.login !== "turnstile";
    $("login-cap-slot").hidden = S.login !== "cap";
    applyCapState(S.capState);
    updateLoginButton();
  }
  function updateLoginButton() {
    $("login-submit").disabled = !$("login-username").value.trim() || !$("login-password").value;
  }
  function applyCapState(state) {
    S.capState = state;
    const box = $("cap-captcha");
    const labels = { idle: "点击进行真人验证", verifying: "正在验证…", done: "验证已完成", error: "验证失败，请重试" };
    if (state === "idle") box.removeAttribute("data-state"); else box.dataset.state = state;
    $("cap-label").textContent = labels[state];
    $("cap-trigger").setAttribute("aria-label", labels[state]);
  }

  // ---------- site context ----------
  function renderSiteSwitches() {
    $$("[data-site-switch]").forEach((box) => {
      const onSites = Boolean(box.closest("#view-sites"));
      const s = site();
      if (onSites && S.creating) {
        box.innerHTML = '<div class="site-static is-draft"><span class="site-name"><span>新站点</span></span><span class="site-id">尚未保存</span></div>';
        return;
      }
      if (!s) {
        box.innerHTML = '<div class="site-static"><span class="site-name"><span>没有可用站点</span></span></div>';
        return;
      }
      if (S.sites.length <= 1) {
        box.innerHTML = `<div class="site-static"><span class="site-name"><span>${esc(siteLabel(s))}</span></span><span class="site-id">${esc(s.id)}</span></div>`;
        return;
      }
      const open = S.siteMenuOpen && !box.closest(".view").hidden;
      box.innerHTML = `<button class="site-trigger" type="button" aria-haspopup="listbox" aria-expanded="${open}" aria-label="切换站点，当前 ${esc(siteLabel(s))}">
          <span class="site-name"><span>${esc(siteLabel(s))}</span><svg class="icon chevron" aria-hidden="true"><use href="#i-chevron"/></svg></span>
          <span class="site-id">${esc(s.id)}</span>
        </button>
        <div class="site-menu" role="listbox" aria-label="选择站点" ${open ? "" : "hidden"}>
          ${S.sites.map((x) => `<button class="site-option" type="button" role="option" data-site="${esc(x.id)}" aria-selected="${x.id === S.siteId}"><strong>${esc(siteLabel(x))}</strong><small>${esc(x.id)}</small><svg class="icon check" aria-hidden="true"><use href="#i-check"/></svg></button>`).join("")}
        </div>`;
    });
  }
  function visibleSwitch() { return $$("[data-site-switch]").find((box) => !box.closest(".view").hidden); }

  // ---------- comments ----------
  const WEEK = "日一二三四五六";
  function parseTime(text) { const [d, t] = text.split(" "); const [y, m, day] = d.split("/").map(Number); const [hh, mm] = t.split(":").map(Number); return new Date(y, m - 1, day, hh, mm); }
  const pad = (n) => String(n).padStart(2, "0");
  const isoTime = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  function dayInfo(date) {
    const start = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diff = Math.round((start(NOW) - start(date)) / 86400000);
    const md = `${date.getMonth() + 1}月${date.getDate()}日`;
    const wk = `周${WEEK[date.getDay()]}`;
    const year = date.getFullYear() === NOW.getFullYear() ? "" : `${date.getFullYear()} · `;
    if (diff === 0) return { name: "今天", sub: `${md} ${wk}` };
    if (diff === 1) return { name: "昨天", sub: `${md} ${wk}` };
    return { name: md, sub: `${year}${wk}` };
  }

  function sourceURL(c) {
    const s = site();
    if (!s) return "";
    try { const u = new URL(c.mark.replace(/^\/+/, ""), s.siteUrl.replace(/\/+$/, "") + "/"); u.hash = `ecoku-comment-${c.id}`; return u.toString(); } catch { return ""; }
  }
  function safeWebsite(url) { try { const u = new URL(url); return /^https?:$/.test(u.protocol) ? u.toString() : ""; } catch { return ""; } }
  const displayWebsite = (url) => url.replace(/^https?:\/\//, "").replace(/\/$/, "");

  function renderComments() {
    renderSiteSwitches();
    const b = bucket();
    const counts = b.counts;
    $("count-published").textContent = counts.published;
    $("count-deleted").textContent = counts.deleted;
    $("title-count").textContent = counts[S.status];
    $("title-noun").textContent = S.status === "deleted" ? "条已删除评论" : "条评论";
    $$(".tab").forEach((tab) => tab.setAttribute("aria-selected", String(tab.dataset.status === S.status)));
    const sortText = S.sort === "oldest" ? "最早在前" : "最新在前";
    $("sort-label").textContent = sortText;
    $("sort-trigger").setAttribute("aria-label", `评论排序：${sortText}`);
    $("sort-trigger").setAttribute("aria-expanded", String(S.sortMenuOpen));
    $("sort-menu").hidden = !S.sortMenuOpen;
    $$("#sort-menu .menu-option").forEach((o) => o.setAttribute("aria-selected", String(o.dataset.sort === S.sort)));

    const total = counts[S.status];
    const pageCount = Math.max(1, Math.ceil(total / 20));
    const ready = S.queue === "ready" && Boolean(site());
    $("pager-status").textContent = `${S.page}/${pageCount}`;
    $("pager-prev").disabled = S.page <= 1 || !ready;
    $("pager-next").disabled = S.page >= pageCount || !ready;
    $("refresh-button").disabled = S.queue === "loading" || !site();
    $("refresh-button").classList.toggle("is-spinning", S.queue === "loading");
    $("sort-trigger").disabled = !site();
    $("view-comments").querySelector(".head-tools").hidden = !site();
    $("view-comments").querySelector(".tabs").hidden = !site();
    $("view-comments").querySelector(".feed-foot").hidden = !site();
    renderFeed();
  }

  function renderFeed() {
    const feed = $("feed");
    feed.removeAttribute("aria-busy");
    if (!site()) {
      feed.innerHTML = '<div class="layout feed-state"><p class="in-main feed-empty">当前实例还没有站点。<button class="quiet-link" type="button" data-view-link="sites" data-create-site="true">新增站点</button></p></div>';
      return;
    }
    if (S.queue === "loading") {
      feed.setAttribute("aria-busy", "true");
      feed.innerHTML = `<div class="layout day"><div class="in-main">${Array.from({ length: 5 }, () => '<div class="skeleton-entry" aria-hidden="true"><span></span><span></span><span></span></div>').join("")}<span class="visually-hidden">正在加载评论…</span></div></div>`;
      return;
    }
    if (S.queue === "error") {
      feed.innerHTML = '<div class="layout feed-state"><section class="in-main service-error" role="alert"><h3>评论列表没有加载出来</h3><p>无法连接到 Ecoku，请检查网络后重试。</p><button class="button" type="button" data-action="retry">重试</button></section></div>';
      return;
    }
    const items = list();
    if (!items.length) {
      feed.innerHTML = `<div class="layout feed-state"><p class="in-main feed-empty">当前没有${S.status === "deleted" ? "已删除" : "已发布"}评论</p></div>`;
      return;
    }
    const groups = [];
    items.forEach((c) => {
      const date = parseTime(c.time);
      const key = date.toDateString();
      let g = groups[groups.length - 1];
      if (!g || g.key !== key) { g = { key, date, items: [] }; groups.push(g); }
      g.items.push(c);
    });
    feed.innerHTML = groups.map((g) => {
      const info = dayInfo(g.date);
      return `<section class="day layout" aria-label="${esc(info.name)}">
        <header class="in-margin day-label"><p class="day-name">${esc(info.name)}</p><p class="day-date">${esc(info.sub)}</p><p class="day-count">${g.items.length} 条</p></header>
        <div class="in-main day-entries">${g.items.map(entryHTML).join("")}</div>
      </section>`;
    }).join("");
  }

  function entryHTML(c) {
    const deleted = S.status === "deleted";
    const date = parseTime(c.time);
    const stamp = isoTime(date);
    const link = sourceURL(c);
    const parent = c.parent ? findComment(c.parent) : null;
    let quote = "";
    if (c.parent && parent && !deleted) {
      quote = `<a class="entry-quote" href="#c-${parent.id}" data-jump="${parent.id}"><span class="quote-ref">回复 ${esc(parent.username)}</span><span class="quote-text">${esc(flat(parent.content))}</span></a>`;
    } else if (c.parent) {
      quote = `<p class="entry-quote"><span class="quote-ref"><span class="visually-hidden">父评论 </span>回复 #${c.parent}</span><span class="quote-text">${deleted ? "" : "不在当前页"}</span></p>`;
    }
    const website = deleted ? "" : safeWebsite(c.url);
    const who = deleted
      ? '<span class="entry-author">已删除</span>'
      : `<span class="entry-author">${esc(c.username)}</span>${c.email ? `<span class="entry-mail" title="私有邮箱"><span class="visually-hidden">私有邮箱 </span>${esc(c.email)}</span>` : ""}${website ? `<a class="entry-site" href="${esc(website)}" target="_blank" rel="noopener noreferrer" title="访客网站 ${esc(c.url)}"><span class="visually-hidden">访客网站 </span>${esc(displayWebsite(c.url))}</a>` : ""}`;
    let action;
    if (!deleted) action = `<button class="quiet-link is-danger" type="button" data-action="tombstone" data-id="${c.id}">墓碑删除</button>`;
    else if (!c.hasChildren) action = `<button class="quiet-link is-danger" type="button" data-action="permanent" data-id="${c.id}">彻底删除</button>`;
    else action = '<span class="entry-hint">仍有回复，不能彻底删除</span>';
    const confirm = S.confirm && S.confirm.id === c.id ? confirmHTML(c, S.confirm.kind) : "";
    const error = S.actionError && S.actionError.id === c.id ? `<p class="notice notice-error" role="alert">${esc(S.actionError.text)}</p>` : "";
    return `<article class="entry${deleted ? " is-tombstone" : ""}" id="c-${c.id}" data-comment="${c.id}" tabindex="-1" aria-current="${c.id === S.currentId}" aria-label="#${c.id} ${esc(deleted ? "已删除" : c.username)}">
      <header class="entry-head"><div class="entry-who">${who}</div><time class="entry-time" datetime="${stamp.replace(" ", "T")}" title="${stamp}">${stamp.slice(11)}</time></header>
      ${quote}
      <p class="entry-copy">${deleted ? "该评论已删除" : esc(c.content)}</p>
      <footer class="entry-foot">
        <span class="entry-page" title="${esc(c.title ? `${c.title} · ${c.mark}` : c.mark)}">${c.title ? `<span class="entry-title"><span class="visually-hidden">文章标题 </span>《${esc(c.title)}》</span>` : ""}<span class="entry-key"><span class="visually-hidden">页面 key </span>${esc(c.mark)}</span></span>
        <span class="entry-actions"><span class="entry-id">#${c.id}</span>${link ? `<a class="quiet-link" href="${esc(link)}" target="_blank" rel="noopener noreferrer" data-source title="查看原评论 #${c.id}">查看原评论</a>` : ""}${action}</span>
      </footer>
      ${error}${confirm}
    </article>`;
  }

  function confirmHTML(c, kind) {
    const title = kind === "tombstone" ? "墓碑删除这条评论？" : "彻底删除这条墓碑？";
    const copy = kind === "tombstone"
      ? "昵称、私有邮箱、网站和正文会被清除，公开页面改为显示“已删除”，下面的回复保留不变。此操作无法撤销。"
      : "这条墓碑会从数据库中移除。此操作无法撤销。";
    return `<div class="entry-confirm" role="alertdialog" aria-labelledby="confirm-${c.id}-title" aria-describedby="confirm-${c.id}-copy">
      <p><strong id="confirm-${c.id}-title">${title}</strong><span id="confirm-${c.id}-copy">${copy}</span></p>
      <div class="confirm-actions"><button class="button button-quiet" type="button" data-action="cancel-confirm">取消</button><button class="button button-danger" type="button" data-action="confirm">${kind === "tombstone" ? "墓碑删除" : "彻底删除"}</button></div>
    </div>`;
  }

  function setCurrent(id, { focus = false, scroll = false } = {}) {
    S.currentId = id;
    $$("#feed .entry").forEach((el) => el.setAttribute("aria-current", String(Number(el.dataset.comment) === id)));
    const el = $(`c-${id}`);
    if (!el) return;
    if (focus) el.focus({ preventScroll: true });
    if (scroll) el.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
  function jumpTo(id) {
    const el = $(`c-${id}`);
    if (!el) return;
    setCurrent(id, { focus: true, scroll: true });
    el.classList.remove("is-flash");
    void el.offsetWidth;
    el.classList.add("is-flash");
    setTimeout(() => el.classList.remove("is-flash"), 1500);
  }

  function openInlineConfirm(id, kind) {
    S.confirm = { id, kind };
    S.actionError = null;
    S.currentId = id;
    renderFeed();
    $(`c-${id}`)?.querySelector('[data-action="cancel-confirm"]')?.focus();
  }
  function closeInlineConfirm() {
    const id = S.confirm?.id;
    S.confirm = null;
    renderFeed();
    if (id) $(`c-${id}`)?.querySelector('[data-action="tombstone"], [data-action="permanent"]')?.focus();
  }
  function confirmAction() {
    const { id, kind } = S.confirm || {};
    const c = findComment(id);
    if (!c) return;
    const b = bucket();
    const items = list();
    const next = items[items.findIndex((x) => x.id === id) + 1] || items[items.findIndex((x) => x.id === id) - 1];
    const el = $(`c-${id}`);
    const finish = () => {
      if (kind === "tombstone") {
        b.published = b.published.filter((x) => x.id !== id);
        b.deleted.unshift({ id: c.id, parent: c.parent, hasChildren: b.published.some((x) => x.parent === c.id), time: c.time, mark: c.mark, title: c.title });
        b.counts.published -= 1; b.counts.deleted += 1;
        toast("评论已替换为墓碑。");
      } else {
        b.deleted = b.deleted.filter((x) => x.id !== id);
        b.counts.deleted -= 1;
        toast("墓碑已彻底删除。");
      }
      S.confirm = null;
      S.currentId = next ? next.id : null;
      renderComments();
      if (next) setCurrent(next.id, { focus: true });
    };
    if (el && !matchMedia("(prefers-reduced-motion: reduce)").matches) { el.classList.add("is-leaving"); setTimeout(finish, 220); } else finish();
  }

  function refresh() {
    S.queue = "loading"; S.confirm = null; S.actionError = null; renderComments();
    setTimeout(() => { S.queue = "ready"; renderComments(); toast("评论列表已刷新。"); }, 700);
  }

  // ---------- forms: dirty tracking and the save bar ----------
  const FORM_IDS = { site: "site-form", email: "email-form", telegram: "telegram-form", captcha: "captcha-form" };
  const VIEW_FORMS = { comments: [], sites: ["site"], notifications: ["email", "telegram"], security: ["captcha"] };
  const FORM_NAMES = { email: "电子邮件", telegram: "Telegram" };
  const FORM_LISTS = { site: "origins", email: "email", telegram: "telegram" };
  const snapshots = {};
  function serialize(key) {
    const form = $(FORM_IDS[key]);
    const parts = $$("input, textarea, select", form)
      .filter((el) => !el.closest(".list-field"))
      .map((el) => (el.type === "radio" || el.type === "checkbox" ? `${el.name}:${el.value}=${el.checked}` : `${el.id}=${el.value}`));
    // Empty items are ignored, so adding a blank row does not count as a change.
    if (FORM_LISTS[key]) parts.push(JSON.stringify(filled(FORM_LISTS[key])));
    return parts.join("\n");
  }
  const snapshot = (key) => { snapshots[key] = serialize(key); };
  const isDirty = (key) => (key === "site" && S.creating) || (snapshots[key] !== undefined && serialize(key) !== snapshots[key]);
  const dirtyForms = () => (S.authed ? VIEW_FORMS[S.view].filter(isDirty) : []);

  function renderSavebar() {
    const bar = $("savebar");
    const dirty = dirtyForms();
    bar.hidden = dirty.length === 0;
    if (!dirty.length) { S.errorCount = 0; return; }
    let text = "有未保存的修改";
    if (S.view === "sites" && S.creating) text = "新站点尚未创建";
    if (S.view === "notifications") { const names = dirty.map((k) => FORM_NAMES[k]).join("、"); text = `${names}${/[A-Za-z]$/.test(names) ? " " : ""}有未保存的修改`; }
    if (S.errorCount) text = `有 ${S.errorCount} 处需要修改`;
    bar.classList.toggle("is-error", S.errorCount > 0);
    $("savebar-text").textContent = text;
    $("savebar-discard").textContent = S.view === "sites" && S.creating ? "取消" : "撤销修改";
    $("savebar-save").textContent = S.view === "sites" ? (S.creating ? "创建站点" : "保存站点") : "保存";
  }

  let pendingNav = null;
  function guard(next) {
    if (!dirtyForms().length) return next();
    pendingNav = next;
    const d = $("confirm-dialog");
    if (!d.open) d.showModal();
    $("confirm-cancel").focus();
  }
  function discardAll() {
    S.errorCount = 0;
    if (S.view === "sites") { S.creating = false; S.siteErrors = {}; renderSites(); }
    if (S.view === "notifications") { S.emailErrors = {}; S.telegramErrors = {}; renderNotifications(); }
    if (S.view === "security") { S.captchaErrors = {}; renderSecurity(); }
    renderSavebar();
  }

  const getRadio = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value ?? "";
  const setRadio = (name, value) => $$(`input[name="${name}"]`).forEach((r) => { r.checked = r.value === String(value); });
  const getBool = (name) => getRadio(name) === "1";
  const setBool = (name, value) => setRadio(name, value ? "1" : "0");
  function markErrors(form, errors, inputs) {
    $$("[data-error]", form).forEach((p) => { p.hidden = !errors[p.dataset.error]; });
    $$("[aria-invalid]", form).forEach((el) => { if (!el.closest(".list-field")) el.removeAttribute("aria-invalid"); });
    Object.keys(errors).forEach((k) => (inputs[k] || []).forEach((id) => $(id)?.setAttribute("aria-invalid", "true")));
    $$(".list-field", form).forEach((box) => refreshList(box.dataset.list));
  }
  // Field errors count once; a list counts each item that needs fixing.
  const countErrors = (errors) => Object.values(errors).reduce((n, v) => n + (typeof v === "number" ? v : 1), 0);

  // ---------- item lists: one input per value ----------
  const validEmail = (x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x) && x.length <= 254;
  const validTarget = (x) => /^-?\d{1,32}$/.test(x);
  function originIssue(value) {
    let u = null;
    try { u = new URL(value); } catch { /* checked below */ }
    if (!u || !/^https?:$/.test(u.protocol) || !u.hostname) {
      try {
        const guess = new URL(`https://${value}`);
        if (guess.hostname.includes(".") || guess.hostname === "localhost") {
          const scheme = /^(localhost|127\.0\.0\.1)$/.test(guess.hostname) ? "http" : "https";
          return { text: guess.pathname === "/" ? "缺少协议" : "缺少协议，且不能含路径", fix: `${scheme}://${guess.host}` };
        }
      } catch { /* not a host either */ }
      return { text: "需要完整来源，例如 https://blog.example.com" };
    }
    if (u.username || u.password || u.pathname !== "/" || u.search || u.hash) return { text: "只填来源，不含路径", fix: u.origin };
    return null;
  }
  const LISTS = {
    origins: { box: "site-origins", label: "允许来源", add: "添加来源", placeholder: "https://blog.example.com", max: 32, mono: true, inputmode: "url", check: originIssue, norm: (v) => new URL(v).origin },
    email: { box: "email-recipients", label: "通知收件人", add: "添加收件人", placeholder: "name@example.com", inputmode: "email", check: (v) => (validEmail(v) ? null : { text: "邮箱格式无效" }), norm: (v) => v },
    telegram: { box: "telegram-targets", label: "接收目标 ID", add: "添加接收目标", placeholder: "-1001234567890", mono: true, inputmode: "text", check: (v) => (v.startsWith("@") ? { text: "不支持 @用户名，请填写数字 ID" } : validTarget(v) ? null : { text: "只能填写数字 ID，可带负号" }), norm: (v) => v },
  };
  const filled = (key) => S.draft[key].map((x) => x.trim()).filter(Boolean);
  const listValues = (key) => [...new Set(filled(key).filter((v) => !LISTS[key].check(v)).map(LISTS[key].norm))];
  const listRequired = (key) => $(LISTS[key].box).closest(".field").querySelector(".field-error[data-error]");
  function setList(key, values) {
    S.draft[key] = [...values];
    S.committed[key] = values.map(() => true);
  }
  function rowIssue(key, i) {
    const cfg = LISTS[key];
    const values = S.draft[key];
    const value = values[i].trim();
    if (!value) return null;
    const issue = cfg.check(value);
    if (issue) return issue;
    const first = values.findIndex((x) => x.trim() && !cfg.check(x.trim()) && cfg.norm(x.trim()) === cfg.norm(value));
    return first > -1 && first < i ? { text: `与第 ${first + 1} 项重复，保存时合并`, soft: true } : null;
  }
  function renderList(key) {
    const cfg = LISTS[key];
    if (!S.draft[key].length) { S.draft[key] = [""]; S.committed[key] = [false]; }
    const values = S.draft[key];
    const full = Boolean(cfg.max) && values.length >= cfg.max;
    $(cfg.box).innerHTML = `<ul class="list-rows">${values.map((value, i) => `<li class="list-row" data-row="${i}">
        <input id="${cfg.box}-${i}" class="input${cfg.mono ? " mono" : ""}" type="text" inputmode="${cfg.inputmode}" autocomplete="off" spellcheck="false" value="${esc(value)}"${i === 0 ? ` placeholder="${esc(cfg.placeholder)}"` : ""} aria-label="${cfg.label}，第 ${i + 1} 项" aria-describedby="${cfg.box}-${i}-note">
        <button class="row-remove" type="button" data-remove-row="${i}" aria-label="删除${cfg.label}第 ${i + 1} 项" title="删除">${icon("close")}</button>
        <p class="row-note" id="${cfg.box}-${i}-note" hidden></p>
      </li>`).join("")}</ul>
      <div class="list-foot"><button class="list-add" type="button" data-add-row ${full ? "disabled" : ""}>${icon("plus")}<span>${full ? `已达上限 ${cfg.max} 项` : cfg.add}</span></button>${cfg.max ? '<span class="list-count" aria-hidden="true"></span>' : ""}</div>`;
    refreshList(key);
  }
  function refreshList(key) {
    const cfg = LISTS[key];
    const box = $(cfg.box);
    const required = listRequired(key);
    S.draft[key].forEach((value, i) => {
      const row = box.querySelector(`[data-row="${i}"]`);
      if (!row) return;
      const input = row.querySelector("input");
      const note = row.querySelector(".row-note");
      const issue = rowIssue(key, i);
      const show = Boolean(issue && S.committed[key][i]);
      const invalid = (show && !issue.soft) || (i === 0 && required && !required.hidden);
      if (invalid) input.setAttribute("aria-invalid", "true"); else input.removeAttribute("aria-invalid");
      note.hidden = !show;
      note.className = `row-note${show && issue.soft ? " is-soft" : ""}`;
      // Rewrite only on change: a press on the fix button blurs the input first, and must still land on the same button.
      const html = show ? `<span>${esc(issue.text)}</span>${issue.fix ? `<button class="row-fix" type="button" data-fix-row="${i}" data-fix="${esc(issue.fix)}">改为 ${esc(issue.fix)}</button>` : ""}` : "";
      if (note.dataset.html !== html) { note.innerHTML = html; note.dataset.html = html; }
      row.querySelector(".row-remove").hidden = S.draft[key].length === 1 && !value;
    });
    const count = box.querySelector(".list-count");
    if (count) count.textContent = `${filled(key).length}/${cfg.max}`;
  }
  // Marks every item as committed so all problems show, and returns how many items need fixing.
  function invalidRows(key) {
    S.committed[key] = S.draft[key].map(() => true);
    return S.draft[key].filter((value, i) => { const issue = rowIssue(key, i); return issue && !issue.soft; }).length;
  }
  function focusRow(key, i) {
    const input = $(`${LISTS[key].box}-${i}`);
    if (!input) return;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
  function insertRows(key, at, values) {
    const cfg = LISTS[key];
    const room = cfg.max ? cfg.max - S.draft[key].length : values.length;
    const take = values.slice(0, Math.max(0, room));
    S.draft[key].splice(at, 0, ...take);
    S.committed[key].splice(at, 0, ...take.map(Boolean));
    return { added: take.length, dropped: values.length - take.length };
  }
  function removeRow(key, i) {
    S.draft[key].splice(i, 1);
    S.committed[key].splice(i, 1);
  }
  const announce = (text) => { $("sr-status").textContent = text; };
  const listContext = (el) => {
    const row = el.closest?.(".list-row");
    return row ? { key: row.closest(".list-field").dataset.list, i: Number(row.dataset.row) } : null;
  };

  // ---------- sites ----------
  const siteFields = {
    id: "site-id", siteUrl: "site-url", name: "site-name", placeholder: "site-placeholder", commentLimit: "site-limit",
    emptyMessage: "site-empty", smojiManifestUrl: "smoji-manifest-url", smojiImageOrigin: "smoji-image-origin",
    bloggerNickname: "blogger-nickname", bloggerEmail: "blogger-email", bloggerBadge: "blogger-badge",
  };
  const siteErrorInputs = { id: ["site-id"], siteUrl: ["site-url"], name: ["site-name"], placeholder: ["site-placeholder"], commentLimit: ["site-limit"], emptyMessage: ["site-empty"], smojiManifestUrl: ["smoji-manifest-url"], smojiImageOrigin: ["smoji-image-origin"], bloggerNickname: ["blogger-nickname"], bloggerEmail: ["blogger-email"], bloggerIdentity: ["blogger-nickname", "blogger-email"], bloggerPassphrase: ["blogger-passphrase"], bloggerBadge: ["blogger-badge"] };

  function renderSites() {
    if (!S.sites.length) S.creating = true;
    renderSiteSwitches();
    const src = S.creating ? SITE_DEFAULTS : site();
    $("sites-title").textContent = S.creating ? "新增站点" : "站点设置";
    Object.entries(siteFields).forEach(([k, id]) => { $(id).value = src[k] ?? ""; });
    $("site-id").readOnly = !S.creating;
    $("site-id-help").innerHTML = S.creating
      ? '对应接入代码中的 <code>data-site-id</code>。字母或数字开头，可含 <code>. _ -</code>，最多 100 个字符；创建后不能修改。'
      : '对应接入代码中的 <code>data-site-id</code>，创建后不能修改。';
    setList("origins", src.allowedOrigins);
    renderList("origins");
    setRadio("site-i18n", src.i18n);
    setRadio("site-sort", src.defaultSort);
    setBool("site-email-required", src.emailRequired);
    setBool("site-website-required", src.websiteRequired);
    setBool("smoji-enabled", src.smojiEnabled);
    $("blogger-passphrase").value = "";
    $("blogger-passphrase").placeholder = src.bloggerPassphraseSet ? "已设置，输入新值以更换" : "";
    $("new-site-button").hidden = S.creating;
    markErrors($("site-form"), S.siteErrors, siteErrorInputs);
    $("site-message").hidden = !S.siteMessage;
    $("site-message").textContent = S.siteMessage;
    updateSpecimen();
    snapshot("site");
    if (S.preset === "site-dirty" || S.preset === "site-discard") {
      $("site-placeholder").value = "写下评论（仅支持纯文本），留下邮箱可在收到回复时获得通知。";
      setBool("site-email-required", true);
    }
    if (S.preset === "site-errors") {
      $("site-url").value = "blog.example.com";
      setList("origins", ["https://blog.example.com/posts/", "localhost:1313"]);
      renderList("origins");
      $("blogger-email").value = "";
      S.siteErrors = { siteUrl: true, originRows: 2, bloggerIdentity: true };
      S.errorCount = countErrors(S.siteErrors);
      markErrors($("site-form"), S.siteErrors, siteErrorInputs);
    }
    if (S.preset === "site-duplicate") {
      setList("origins", ["https://blog.example.com", "http://localhost:1313", "https://BLOG.example.com/"]);
      renderList("origins");
    }
  }
  function updateSpecimen() {
    const name = $("blogger-nickname").value.trim();
    const badge = $("blogger-badge").value.trim();
    $("specimen-name").textContent = name || "博主";
    $("specimen-badge").textContent = badge;
    $("specimen-badge").hidden = !badge;
  }
  function validateSite() {
    const e = {};
    const v = (id) => $(id).value.trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(v("site-id"))) e.id = true;
    try { const u = new URL(v("site-url")); if (!/^https?:$/.test(u.protocol)) throw 0; } catch { e.siteUrl = true; }
    if ([...v("site-name")].length > 120) e.name = true;
    if (!filled("origins").length) e.origins = true;
    const originRows = invalidRows("origins"); if (originRows) e.originRows = originRows;
    const placeholder = [...v("site-placeholder")].length; if (!placeholder || placeholder > 80) e.placeholder = true;
    const limit = Number($("site-limit").value); if (!Number.isInteger(limit) || limit < 1 || limit > 10000) e.commentLimit = true;
    const empty = [...v("site-empty")].length; if (!empty || empty > 240) e.emptyMessage = true;
    if (getBool("smoji-enabled") && !v("smoji-manifest-url")) e.smojiManifestUrl = true;
    if (v("smoji-image-origin")) { try { const u = new URL(v("smoji-image-origin")); if (u.protocol !== "https:" || u.pathname !== "/" || u.search || u.hash) throw 0; } catch { e.smojiImageOrigin = true; } }
    if ([...v("blogger-nickname")].length > 80) e.bloggerNickname = true;
    if (v("blogger-email") && !validEmail(v("blogger-email"))) e.bloggerEmail = true;
    if (Boolean(v("blogger-nickname")) !== Boolean(v("blogger-email"))) e.bloggerIdentity = true;
    const current = S.creating ? SITE_DEFAULTS : site();
    if (v("blogger-nickname") && v("blogger-email") && !current.bloggerPassphraseSet && !$("blogger-passphrase").value) e.bloggerPassphrase = true;
    if ([...v("blogger-badge")].length > 16) e.bloggerBadge = true;
    return e;
  }
  function saveSite() {
    const errors = validateSite();
    S.siteErrors = errors;
    S.errorCount = countErrors(errors);
    markErrors($("site-form"), errors, siteErrorInputs);
    if (S.errorCount) {
      renderSavebar();
      const first = $("site-form").querySelector('[aria-invalid="true"]');
      first?.focus();
      return;
    }
    const v = (id) => $(id).value.trim();
    const model = {
      id: v("site-id"), siteUrl: v("site-url"), name: v("site-name"),
      allowedOrigins: listValues("origins"), i18n: getRadio("site-i18n"),
      defaultSort: getRadio("site-sort"), emailRequired: getBool("site-email-required"), websiteRequired: getBool("site-website-required"),
      placeholder: v("site-placeholder"), commentLimit: Number($("site-limit").value), emptyMessage: $("site-empty").value.trim(),
      smojiEnabled: getBool("smoji-enabled"), smojiManifestUrl: v("smoji-manifest-url"), smojiImageOrigin: v("smoji-image-origin").replace(/\/+$/, ""),
      bloggerNickname: v("blogger-nickname"), bloggerEmail: v("blogger-email"), bloggerBadge: v("blogger-badge"),
    };
    const wasCreating = S.creating;
    if (wasCreating) {
      S.sites.push({ ...SITE_DEFAULTS, ...model, bloggerPassphraseSet: Boolean($("blogger-passphrase").value) });
      data[model.id] = { published: [], deleted: [], counts: { published: 0, deleted: 0 } };
      S.siteId = model.id; S.creating = false;
    } else {
      const s = site();
      Object.assign(s, model, { id: s.id, bloggerPassphraseSet: s.bloggerPassphraseSet || Boolean($("blogger-passphrase").value) });
    }
    S.preset = null;
    renderSites();
    renderSavebar();
    toast(wasCreating ? "站点已创建。" : "站点设置已保存。");
  }

  // ---------- notifications ----------
  function feedbackHTML(f) { return f ? `${icon(f.ok ? "check" : "alert")}<span>${esc(f.text)}</span>` : ""; }
  function syncChannel(key) {
    const on = getBool(`${key}-enabled`);
    $(`${key}-body`).hidden = !on;
    $(`${key}-off`).hidden = on;
    $(`${key}-test`).closest(".section-actions").hidden = !on;
    const f = on ? S[`${key}Feedback`] : null;
    const fb = $(`${key}-feedback`);
    fb.className = "feedback" + (f ? (f.ok ? " is-success" : " is-failure") : "");
    fb.innerHTML = feedbackHTML(f);
  }
  const emailErrorInputs = { host: ["email-server"], port: ["email-port"], password: ["email-password"], from: ["email-sender"] };
  const telegramErrorInputs = { token: ["telegram-token"] };
  function renderNotifications() {
    const e = S.email;
    setBool("email-enabled", e.enabled);
    $("email-server").value = e.host; $("email-port").value = e.port || ""; $("email-user").value = e.username; $("email-sender").value = e.fromAddress;
    $("email-password").value = "";
    setRadio("email-encryption", e.encryption);
    $("email-port").placeholder = e.encryption === "starttls" ? "587" : "465";
    $("email-password").placeholder = e.passwordSet ? "已设置，输入新值以更换" : "";
    setList("email", e.recipients);
    renderList("email");
    const t = S.telegram;
    setBool("telegram-enabled", t.enabled);
    $("telegram-token").value = "";
    $("telegram-token").placeholder = t.tokenSet ? "已设置，输入新值以更换" : "";
    setList("telegram", t.targets);
    renderList("telegram");
    syncChannel("email"); syncChannel("telegram");
    markErrors($("email-form"), S.emailErrors, emailErrorInputs);
    markErrors($("telegram-form"), S.telegramErrors, telegramErrorInputs);
    snapshot("email"); snapshot("telegram");
    if (S.preset === "email-off") { setBool("email-enabled", false); syncChannel("email"); }
    if (S.preset === "notify-errors") {
      setList("email", ["owner@example.com", "not-an-email"]); $("email-port").value = "0";
      setList("telegram", ["123456789", "@channel"]);
      renderList("email"); renderList("telegram");
      S.emailErrors = { port: true, recipientRows: 1 };
      S.telegramErrors = { targetRows: 1 };
      markErrors($("email-form"), S.emailErrors, emailErrorInputs);
      markErrors($("telegram-form"), S.telegramErrors, telegramErrorInputs);
      S.errorCount = countErrors(S.emailErrors) + countErrors(S.telegramErrors);
    }
    if (S.preset === "notify-required") {
      setList("email", []); setList("telegram", []);
      renderList("email"); renderList("telegram");
      S.emailErrors = { recipients: true };
      S.telegramErrors = { targets: true };
      markErrors($("email-form"), S.emailErrors, emailErrorInputs);
      markErrors($("telegram-form"), S.telegramErrors, telegramErrorInputs);
      S.errorCount = 2;
    }
  }
  function validateChannel(key) {
    const e = {};
    if (!getBool(`${key}-enabled`)) return e;
    if (key === "email") {
      if (!$("email-server").value.trim()) e.host = true;
      const port = Number($("email-port").value); if (!Number.isInteger(port) || port < 1 || port > 65535) e.port = true;
      if (!validEmail($("email-sender").value.trim())) e.from = true;
      if ($("email-user").value.trim() && !S.email.passwordSet && !$("email-password").value) e.password = true;
      if (!filled("email").length) e.recipients = true;
      const rows = invalidRows("email"); if (rows) e.recipientRows = rows;
    } else {
      if (!S.telegram.tokenSet && !$("telegram-token").value.trim()) e.token = true;
      if (!filled("telegram").length) e.targets = true;
      const rows = invalidRows("telegram"); if (rows) e.targetRows = rows;
    }
    return e;
  }
  function saveNotifications() {
    const saved = [];
    let errorCount = 0;
    dirtyForms().forEach((key) => {
      const errors = validateChannel(key);
      S[`${key}Errors`] = errors;
      markErrors($(`${key}-form`), errors, key === "email" ? emailErrorInputs : telegramErrorInputs);
      if (Object.keys(errors).length) { errorCount += countErrors(errors); return; }
      if (key === "email") {
        Object.assign(S.email, {
          enabled: getBool("email-enabled"), host: $("email-server").value.trim(), port: Number($("email-port").value) || S.email.port,
          encryption: getRadio("email-encryption"), username: $("email-user").value.trim(), fromAddress: $("email-sender").value.trim(),
          passwordSet: S.email.passwordSet || Boolean($("email-password").value), recipients: listValues("email"),
        });
        $("email-password").value = "";
      } else {
        Object.assign(S.telegram, { enabled: getBool("telegram-enabled"), tokenSet: S.telegram.tokenSet || Boolean($("telegram-token").value.trim()), targets: listValues("telegram") });
        $("telegram-token").value = "";
      }
      S[`${key}Feedback`] = null;
      setList(key, key === "email" ? S.email.recipients : S.telegram.targets);
      renderList(key);
      syncChannel(key);
      snapshot(key);
      saved.push(key === "email" ? "电子邮件通知已保存。" : "Telegram 通知已保存。");
    });
    S.errorCount = errorCount;
    S.preset = null;
    renderSavebar();
    if (errorCount) $("view-notifications").querySelector('[aria-invalid="true"]')?.focus();
    if (saved.length) toast(saved.join(" "));
  }

  // ---------- security ----------
  const captchaErrorInputs = { capInstanceUrl: ["cap-instance-url"], capSitekey: ["cap-sitekey"], turnstileSitekey: ["turnstile-sitekey"], turnstileSecret: ["turnstile-secret"], capSecret: ["cap-secret"] };
  function syncProvider() {
    const p = getRadio("captcha-provider");
    $("panel-off").hidden = p !== "off"; $("panel-turnstile").hidden = p !== "turnstile"; $("panel-cap").hidden = p !== "cap";
  }
  function renderSecurity() {
    setRadio("captcha-provider", S.captcha.provider);
    $("turnstile-sitekey").value = S.captcha.turnstileSitekey;
    $("cap-instance-url").value = S.captcha.capInstanceUrl;
    $("cap-sitekey").value = S.captcha.capSitekey;
    $("turnstile-secret").value = ""; $("cap-secret").value = "";
    syncProvider();
    markErrors($("captcha-form"), S.captchaErrors, captchaErrorInputs);
    snapshot("captcha");
    if (S.preset === "cap-errors") {
      $("cap-instance-url").value = "http://cap.example.com/?key=1"; $("cap-sitekey").value = "";
      S.captchaErrors = { capInstanceUrl: true, capSitekey: true }; S.errorCount = 2;
      markErrors($("captcha-form"), S.captchaErrors, captchaErrorInputs);
    }
  }
  function saveCaptcha() {
    const e = {};
    const provider = getRadio("captcha-provider");
    const instance = $("cap-instance-url").value.trim().replace(/\/+$/, "");
    const capSitekey = $("cap-sitekey").value.trim();
    const turnstileSitekey = $("turnstile-sitekey").value.trim();
    if (provider === "cap") {
      try { const u = new URL(instance); if (u.protocol !== "https:" || u.search || u.hash) throw 0; } catch { e.capInstanceUrl = true; }
      if (!capSitekey) e.capSitekey = true;
    }
    if (provider === "turnstile" && !turnstileSitekey) e.turnstileSitekey = true;
    S.captchaErrors = e;
    S.errorCount = Object.keys(e).length;
    markErrors($("captcha-form"), e, captchaErrorInputs);
    if (S.errorCount) { renderSavebar(); $("captcha-form").querySelector('[aria-invalid="true"]')?.focus(); return; }
    Object.assign(S.captcha, { provider, capInstanceUrl: instance, capSitekey, turnstileSitekey });
    S.preset = null;
    renderSecurity();
    renderSavebar();
    toast("验证设置已保存。");
  }

  // ---------- events ----------
  function go(view, after) {
    guard(() => {
      S.view = view; S.siteMenuOpen = false; S.sortMenuOpen = false; S.confirm = null; S.errorCount = 0; S.preset = null;
      S.siteErrors = {}; S.emailErrors = {}; S.telegramErrors = {}; S.captchaErrors = {};
      if (view !== "sites") S.creating = false;
      renderShell();
      if (after) after();
      window.scrollTo({ top: 0 });
    });
  }
  function chooseSite(id) {
    S.siteMenuOpen = false;
    const apply = () => {
      S.siteId = id; S.errorCount = 0; S.siteErrors = {}; S.preset = null;
      if (S.view === "comments") { S.status = "published"; S.page = 1; S.currentId = null; S.confirm = null; renderComments(); }
      else { renderSites(); renderSavebar(); }
      visibleSwitch()?.querySelector(".site-trigger")?.focus();
    };
    if (S.view === "sites" && id !== S.siteId) guard(apply); else apply();
  }

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (S.siteMenuOpen && !target.closest("[data-site-switch]")) { S.siteMenuOpen = false; renderSiteSwitches(); }
    if (S.sortMenuOpen && !target.closest(".menu-anchor")) { S.sortMenuOpen = false; renderComments(); }
    const t = target.closest("button, a");
    if (!t) {
      const entry = target.closest(".entry");
      if (entry && !window.getSelection()?.toString()) setCurrent(Number(entry.dataset.comment));
      return;
    }
    if (t.dataset.viewLink) { event.preventDefault(); const create = t.dataset.createSite === "true"; return go(t.dataset.viewLink, create ? () => { S.creating = true; renderSites(); renderSavebar(); $("site-id").focus(); } : null); }
    if (t.classList.contains("site-trigger")) {
      S.siteMenuOpen = !S.siteMenuOpen; renderSiteSwitches();
      if (S.siteMenuOpen) visibleSwitch()?.querySelector('.site-option[aria-selected="true"]')?.focus();
      return;
    }
    if (t.dataset.site) return chooseSite(t.dataset.site);
    if (t.id === "sort-trigger") { S.sortMenuOpen = !S.sortMenuOpen; renderComments(); if (S.sortMenuOpen) document.querySelector('#sort-menu [aria-selected="true"]')?.focus(); return; }
    if (t.dataset.sort) { S.sort = t.dataset.sort; S.sortMenuOpen = false; S.page = 1; S.currentId = null; S.confirm = null; renderComments(); $("sort-trigger").focus(); return; }
    if (t.dataset.status) { S.status = t.dataset.status; S.page = 1; S.currentId = null; S.confirm = null; S.actionError = null; return renderComments(); }
    if (t.dataset.jump) { event.preventDefault(); return jumpTo(Number(t.dataset.jump)); }
    if (t.id === "refresh-button" || t.dataset.action === "retry") return refresh();
    if (t.id === "pager-prev" && S.page > 1) { S.page -= 1; S.confirm = null; renderComments(); return window.scrollTo({ top: 0 }); }
    if (t.id === "pager-next") { S.page += 1; S.confirm = null; renderComments(); return window.scrollTo({ top: 0 }); }
    if (t.dataset.action === "tombstone" || t.dataset.action === "permanent") return openInlineConfirm(Number(t.dataset.id), t.dataset.action);
    if (t.dataset.action === "cancel-confirm") return closeInlineConfirm();
    if (t.dataset.action === "confirm") return confirmAction();
    if (t.id === "confirm-cancel") { pendingNav = null; $("confirm-dialog").close(); return; }
    if (t.id === "confirm-ok") { const next = pendingNav; pendingNav = null; $("confirm-dialog").close(); discardAll(); if (next) next(); return; }
    if (t.id === "logout-button") {
      if (S.logoutFailed) { S.logoutFailed = false; renderShell(); return; }
      return guard(() => { S.authed = false; S.loginMessage = ""; S.creating = false; renderShell(); });
    }
    if (t.id === "new-site-button") return guard(() => { S.creating = true; S.siteErrors = {}; S.errorCount = 0; renderSites(); renderSavebar(); $("site-id").focus(); });
    if (t.id === "savebar-save") { if (S.view === "sites") return saveSite(); if (S.view === "notifications") return saveNotifications(); if (S.view === "security") return saveCaptcha(); }
    if (t.id === "savebar-discard") return discardAll();
    if (t.dataset.removeRow !== undefined) {
      const { key, i } = listContext(t);
      if (S.draft[key].length === 1) { S.draft[key] = [""]; S.committed[key] = [false]; renderList(key); focusRow(key, 0); }
      else { removeRow(key, i); renderList(key); focusRow(key, Math.min(i, S.draft[key].length - 1)); }
      announce(`已删除${LISTS[key].label}第 ${i + 1} 项`);
      renderSavebar();
      return;
    }
    if (t.dataset.addRow !== undefined) {
      const key = t.closest(".list-field").dataset.list;
      const last = S.draft[key].length - 1;
      if (!S.draft[key][last].trim()) return focusRow(key, last);
      insertRows(key, last + 1, [""]);
      renderList(key);
      return focusRow(key, last + 1);
    }
    if (t.dataset.fixRow !== undefined) {
      const { key, i } = listContext(t);
      S.draft[key][i] = t.dataset.fix;
      S.committed[key][i] = true;
      $(`${LISTS[key].box}-${i}`).value = t.dataset.fix;
      refreshList(key);
      focusRow(key, i);
      announce(`已改为 ${t.dataset.fix}`);
      renderSavebar();
      return;
    }
    if (t.id === "email-test") { S.emailFeedback = { ok: true, text: "测试邮件已发送" }; return syncChannel("email"); }
    if (t.id === "telegram-test") { S.telegramFeedback = { ok: true, text: "测试消息已发送" }; return syncChannel("telegram"); }
    if (t.id === "cap-trigger") {
      if (S.capState === "done" || S.capState === "verifying") return;
      applyCapState("verifying");
      setTimeout(() => applyCapState(S.capFails ? "error" : "done"), 800);
      return;
    }
    if (t.id === "scenario-toggle") {
      const box = $("scenario-controller"); const collapsed = box.dataset.collapsed === "true";
      box.dataset.collapsed = String(!collapsed); t.textContent = collapsed ? "收起" : "原型场景";
    }
  });

  document.addEventListener("change", (event) => {
    const t = event.target;
    if (t.name === "email-enabled" || t.name === "telegram-enabled") { const key = t.name.split("-")[0]; S[`${key}Feedback`] = null; syncChannel(key); }
    if (t.name === "email-encryption") $("email-port").placeholder = t.value === "starttls" ? "587" : "465";
    if (t.name === "captcha-provider") syncProvider();
    if (S.authed) renderSavebar();
  });

  document.addEventListener("input", (event) => {
    const t = event.target;
    if (t.id === "login-username" || t.id === "login-password") return updateLoginButton();
    if (t.id === "blogger-nickname" || t.id === "blogger-badge") updateSpecimen();
    const item = listContext(t);
    if (item) {
      S.draft[item.key][item.i] = t.value;
      const required = listRequired(item.key);
      if (filled(item.key).length && required) required.hidden = true;
      refreshList(item.key);
    }
    if (t.closest && t.closest("form.doc")) renderSavebar();
  });

  document.addEventListener("keydown", (event) => {
    const t = event.target;
    const item = t.tagName === "INPUT" ? listContext(t) : null;
    if (item) {
      const { key, i } = item;
      const values = S.draft[key];
      if (event.key === "Enter" && !event.isComposing) {
        // Enter moves on to the next item instead of submitting the form.
        event.preventDefault();
        if (values[i].trim()) { S.committed[key][i] = true; refreshList(key); }
        if (i + 1 < values.length) return focusRow(key, i + 1);
        if (!values[i].trim()) return;
        if (!insertRows(key, i + 1, [""]).added) return announce(`最多 ${LISTS[key].max} 项`);
        renderList(key);
        return focusRow(key, i + 1);
      }
      if (event.key === "Backspace" && !t.value && values.length > 1) {
        event.preventDefault();
        removeRow(key, i);
        renderList(key);
        focusRow(key, Math.max(0, i - 1));
        return renderSavebar();
      }
      if (event.key === "ArrowDown" && i + 1 < values.length) { event.preventDefault(); return focusRow(key, i + 1); }
      if (event.key === "ArrowUp" && i > 0) { event.preventDefault(); return focusRow(key, i - 1); }
    }
    if (t.closest && t.closest(".site-menu, #sort-menu")) {
      const menu = t.closest(".site-menu, #sort-menu");
      const opts = $$("button", menu);
      const i = opts.indexOf(document.activeElement);
      if (event.key === "Escape") {
        event.preventDefault();
        if (menu.id === "sort-menu") { S.sortMenuOpen = false; renderComments(); $("sort-trigger").focus(); }
        else { S.siteMenuOpen = false; renderSiteSwitches(); visibleSwitch()?.querySelector(".site-trigger")?.focus(); }
      }
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const n = event.key === "Home" ? 0 : event.key === "End" ? opts.length - 1 : (i + (event.key === "ArrowDown" ? 1 : -1) + opts.length) % opts.length;
        opts[n].focus();
      }
      return;
    }
  });

  // Pasting several values (one per line, or separated by commas or spaces) fills one item each.
  document.addEventListener("paste", (event) => {
    const item = event.target.tagName === "INPUT" ? listContext(event.target) : null;
    if (!item) return;
    const parts = (event.clipboardData?.getData("text") ?? "").split(/[\s,，;；]+/).filter(Boolean);
    if (parts.length < 2) return;
    event.preventDefault();
    const { key, i } = item;
    let at = i + 1;
    if (!S.draft[key][i].trim()) { removeRow(key, i); at = i; }
    const { added, dropped } = insertRows(key, at, parts);
    renderList(key);
    focusRow(key, at + added - 1);
    announce(dropped ? `已添加 ${added} 项；最多 ${LISTS[key].max} 项，其余 ${dropped} 项未添加` : `已添加 ${added} 项`);
    renderSavebar();
  });

  // An item's problems show once the cursor leaves it, not while it is being typed.
  document.addEventListener("focusout", (event) => {
    const item = event.target.tagName === "INPUT" ? listContext(event.target) : null;
    if (!item || !S.draft[item.key][item.i]?.trim()) return;
    S.committed[item.key][item.i] = true;
    refreshList(item.key);
  });

  $("site-form").addEventListener("submit", (event) => { event.preventDefault(); saveSite(); });
  ["email-form", "telegram-form", "captcha-form"].forEach((id) => $(id).addEventListener("submit", (event) => event.preventDefault()));

  $("login-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (S.login === "cap" && S.capState !== "done") { S.loginMessage = "请完成验证后再登录。"; renderLogin(); $("cap-trigger").focus(); return; }
    $("login-password").value = ""; $("login-username").value = "";
    S.authed = true; S.loginMessage = ""; S.view = "comments"; renderShell();
  });

  $("confirm-dialog").addEventListener("close", () => { pendingNav = null; });
  $("confirm-dialog").addEventListener("click", (event) => { if (event.target === event.currentTarget) $("confirm-dialog").close(); });

  // ---------- prototype controller ----------
  const select = $("scenario-select");
  select.innerHTML = SCENARIOS.map(([label, items]) => `<optgroup label="${label}">${items.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</optgroup>`).join("");
  select.addEventListener("change", () => { window.location.hash = select.value; });
  $("theme-select").addEventListener("change", (e) => { document.documentElement.dataset.theme = e.target.value; });

  function boot() {
    const name = window.location.hash.slice(1) || "comments";
    select.value = name;
    const d = $("confirm-dialog"); if (d.open) d.close();
    Object.keys(snapshots).forEach((k) => delete snapshots[k]);
    applyScenario(name);
    renderShell();
    window.scrollTo(0, 0);
    if (S.scrollTo) { const el = $(`c-${S.scrollTo}`); if (el) el.scrollIntoView({ block: "center" }); }
    if (S.preset === "site-discard") guard(() => {});
    if (S.toastOnLoad) toast(S.toastOnLoad);
  }
  window.addEventListener("hashchange", boot);
  boot();
})();
