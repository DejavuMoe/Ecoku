/* Ecoku admin v14 prototype. Static mock data only: no network, no storage. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const MARK = '<svg class="brand-mark" aria-hidden="true"><use href="#ecoku-mark"/></svg>';
  const DIRTY_DOT = '<span class="dot is-dirty" aria-hidden="true" title="有未保存的修改"></span>';
  const SERVER_URL = "https://ecoku.example.com";
  const NOW = new Date(2026, 8, 29, 16, 52);
  const PAGE_SIZE = 20;

  // ---------- fixtures (sanitized) ----------
  const SITES = [
    {
      id: "blog.example.com", name: "Dejavu's Blog", siteUrl: "https://blog.example.com",
      allowedOrigins: ["http://localhost:1313", "https://blog.example.com"], defaultSort: "newest",
      emailRequired: false, websiteRequired: false,
      placeholder: "仅支持纯文本，昵称为必填项，留下邮箱可在收到回复时获得通知。", commentLimit: 500,
      emptyMessage: "沙发空着也是空着，不如坐下唠两句？", smojiEnabled: true,
      smojiManifestUrl: "https://static.example.com/smoji/smoji.json",
      bloggerNickname: "Dejavu Moe", bloggerEmail: "owner@example.com", bloggerBadge: "[博主]", bloggerPassphraseSet: true,
    },
    {
      id: "notes", name: "", siteUrl: "https://notes.example.org",
      allowedOrigins: ["https://notes.example.org"], defaultSort: "oldest",
      emailRequired: true, websiteRequired: false, placeholder: "写下评论（仅支持纯文本）", commentLimit: 1000,
      emptyMessage: "还没有评论\n成为第一个留下评论的人。", smojiEnabled: false, smojiManifestUrl: "",
      bloggerNickname: "", bloggerEmail: "", bloggerBadge: "[博主]", bloggerPassphraseSet: false,
    },
  ];

  const PUBLISHED = [
    { id: 524, parent: 523, username: "Dejavu Moe", email: "owner@example.com", url: "https://blog.example.com", time: "2026/09/29 16:48", mark: "/posts/fiber-modem-bridge-mode/", title: "光猫改桥接之后", content: "对，路由器 WAN 口要开 DHCPv6-PD，前缀长度一般是 /60，改完重新拨号就能拿到。" },
    { id: 523, parent: 0, username: "阿澈", email: "ache@example.org", url: "", time: "2026/09/29 15:02", mark: "/posts/fiber-modem-bridge-mode/", title: "光猫改桥接之后", content: "按照文章把光猫改成桥接之后，IPv6 前缀一直拿不到，是不是还要在路由器上单独开什么？" },
    { id: 519, parent: 517, username: "Kashyz", email: "kashyz@example.net", url: "", time: "2026/09/28 12:16", mark: "/posts/days-with-not-much-light/", title: "光线不多的日子", content: "OK，谢谢博主" },
    { id: 518, parent: 515, username: "Dejavu Moe", email: "owner@example.com", url: "https://blog.example.com", time: "2026/09/28 08:46", mark: "/posts/days-with-not-much-light/", title: "光线不多的日子", content: "以后有机会可以，暂时应该不会去上海哈哈" },
    { id: 517, parent: 516, username: "Dejavu Moe", email: "owner@example.com", url: "https://blog.example.com", time: "2026/09/28 08:44", mark: "/posts/days-with-not-much-light/", title: "光线不多的日子", content: "我用的就是内置的模板 Rhyhorn，把头像去掉后，这个比较简洁。\n可视化编辑就正常编辑呗，简历前面突出关键词和重点信息，如果投递某个岗位，可以把 JD 发给 AI 让他对应优化。" },
    { id: 516, parent: 0, username: "Kashyz", email: "kashyz@example.net", url: "", time: "2026/09/27 23:58", mark: "/posts/days-with-not-much-light/", title: "光线不多的日子", content: "师傅，我想问一下你的做简历的这个服务，我也尝试自己部署了这个 Reactive Resume，里面的简历模板师傅是直接用的自带的吗？然后这个感觉不太会使用，博主有没有什么可以分享的使用方法" },
    { id: 515, parent: 0, username: "yywr", email: "yywr@example.org", url: "https://yywr.example.org", time: "2026/09/27 21:22", mark: "/posts/days-with-not-much-light/", title: "光线不多的日子", content: "要是上海我们可以面个基，感觉你这工作和我同行了，刚开始工作杂点好，方便找下一份。" },
    { id: 514, parent: 0, username: "林间小径", email: "", url: "https://lin.example.org/about", time: "2026/09/26 19:03", mark: "/posts/rainy-season/", title: "梅雨季节", content: "读到“把窗户开一条缝”那段，想起小时候外婆家的阁楼。\n\n雨一直下，屋里有股木头的味道。\n谢谢你写下来。" },
    { id: 513, parent: 0, username: "一个名字特别特别长的访客昵称用于测试截断效果_abcdefghijklmnopqrstuvwxyz", email: "averyveryveryverylongmailboxnameforlayouttesting@subdomain.example.com", url: "https://an-extremely-long-hostname-for-layout-testing.example.com/path/to/a/deeply/nested/profile/page", time: "2026/09/26 10:41", mark: "/posts/2026/09/a-very-long-page-key-that-keeps-going-to-test-how-the-list-truncates-it/", title: "一篇标题非常非常长、用来检查详情页换行与截断表现的文章", content: "极端文本：https://example.com/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 以及 <script>alert(\"xss\")</script> 这段应当按纯文本显示。" },
    { id: 512, parent: 0, username: "阿青", email: "aqing@example.com", url: "", time: "2026/09/25 22:10", mark: "/posts/hello-world/", title: "Hello World", content: "打卡" },
    { id: 511, parent: 0, username: "Mori", email: "mori@example.jp", url: "https://mori.example.jp", time: "2026/09/24 14:27", mark: "/posts/cloudflare-waf-set-up-guide/", title: "Cloudflare WAF 防护策略简易指南", content: "按文中的规则配置之后，扫描器的请求少了很多。有一个问题：如果源站在国内，托管质询对访问速度影响大吗？" },
    { id: 510, parent: 0, username: "Sam", email: "sam@example.com", url: "", time: "2026/09/23 09:02", mark: "/posts/hugo-protected-leaf-bundle-demo/", title: "", content: "Great write-up. The part about page bundles finally made it click for me — thanks!" },
  ];

  const DELETED = [
    { id: 487, parent: 486, hasChildren: false, time: "2026/08/30 13:24", mark: "/posts/cloudflare-waf-set-up-guide/", title: "Cloudflare WAF 防护策略简易指南" },
    { id: 486, parent: 0, hasChildren: true, time: "2026/08/30 13:23", mark: "/posts/cloudflare-waf-set-up-guide/", title: "Cloudflare WAF 防护策略简易指南" },
    { id: 485, parent: 0, hasChildren: false, time: "2026/08/27 16:08", mark: "/posts/hugo-protected-leaf-bundle-demo/", title: "Hugo 受保护的页面包示例" },
    { id: 468, parent: 0, hasChildren: false, time: "2026/08/18 08:12", mark: "/posts/hello-world/", title: "Hello World" },
  ];

  const NOTES_PUBLISHED = [
    { id: 3, parent: 0, username: "路人甲", email: "a@example.org", url: "", time: "2026/09/20 11:00", mark: "/2026/reading-list/", title: "九月书单", content: "《额尔古纳河右岸》也很好看。" },
    { id: 2, parent: 1, username: "Notes", email: "", url: "", time: "2026/09/19 20:15", mark: "/2026/reading-list/", title: "九月书单", content: "已经加进待读了。" },
    { id: 1, parent: 0, username: "路人乙", email: "b@example.org", url: "", time: "2026/09/19 18:40", mark: "/2026/reading-list/", title: "九月书单", content: "推荐一本《置身事内》。" },
  ];

  const SITE_DEFAULTS = { id: "", siteUrl: "", name: "", allowedOrigins: [], defaultSort: "newest", emailRequired: true, websiteRequired: false, placeholder: "写下评论（仅支持纯文本）", commentLimit: 1000, emptyMessage: "还没有评论\n成为第一个留下评论的人。", smojiEnabled: false, smojiManifestUrl: "", bloggerNickname: "", bloggerEmail: "", bloggerBadge: "[博主]", bloggerPassphraseSet: false };
  const withChildren = (items) => items.map((c) => ({ ...c, hasChildren: items.some((x) => x.parent === c.id) }));

  // ---------- state ----------
  let S;
  let data;
  function freshState() {
    data = {
      "blog.example.com": { published: withChildren(PUBLISHED), deleted: DELETED.map((c) => ({ ...c })), counts: { published: 506, deleted: 15 } },
      notes: { published: withChildren(NOTES_PUBLISHED), deleted: [], counts: { published: 3, deleted: 0 } },
    };
    const email = { enabled: true, host: "smtp.example.com", port: 465, encryption: "tls", username: "notice@example.com", passwordSet: true, fromAddress: "notice@example.com", recipients: ["owner@example.com"] };
    const telegram = { enabled: true, tokenSet: true, targets: ["123456789", "-1001234567890"] };
    const captcha = { provider: "cap", turnstileSitekey: "0x4AAAAAAA00000000000000", capInstanceUrl: "https://cap.example.com", capSitekey: "d9256640cb53" };
    return {
      authed: true, login: "off", loginMessage: "", capState: "idle", logoutFailed: false,
      view: "comments", detail: false,
      sites: SITES.map((s) => ({ ...s, allowedOrigins: [...s.allowedOrigins] })), siteId: "blog.example.com", siteMenuOpen: false,
      status: "published", sort: "newest", page: 1, selectedId: 524, queue: "ready", actionMessage: "",
      editSiteId: "blog.example.com", creating: false, siteMessage: "",
      channel: "email", security: "captcha",
      dirty: { site: false, email: false, telegram: false, captcha: false },
      filled: { site: null, email: false, telegram: false, captcha: false },
      email, telegram, captcha,
      saved: { email: clone(email), telegram: clone(telegram), captcha: clone(captcha) },
      emailErrors: {}, emailFeedback: null, telegramErrors: {}, telegramFeedback: null, captchaErrors: {},
    };
  }

  const site = () => S.sites.find((s) => s.id === S.siteId) || null;
  const siteLabel = (s) => { if (!s) return ""; if (s.name) return s.name; try { return new URL(s.siteUrl).hostname; } catch { return s.id; } };
  const pool = () => (data[S.siteId] || { published: [], deleted: [] })[S.status];
  const list = () => { const items = [...pool()]; return S.sort === "oldest" ? items.reverse() : items; };
  const selected = () => pool().find((c) => c.id === S.selectedId) || null;
  function findComment(id) {
    const bucket = data[S.siteId];
    for (const status of ["published", "deleted"]) { const c = bucket[status].find((x) => x.id === id); if (c) return { c, status }; }
    return null;
  }

  // ---------- time ----------
  const parseTime = (t) => { const [d, hm] = t.split(" "); const [y, m, day] = d.split("/").map(Number); const [h, mi] = hm.split(":").map(Number); return new Date(y, m - 1, day, h, mi); };
  const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  function dayLabel(t) {
    const d = parseTime(t);
    const diff = Math.round((dayStart(NOW) - dayStart(d)) / 86400000);
    if (diff === 0) return "今天";
    if (diff === 1) return "昨天";
    return d.getFullYear() === NOW.getFullYear() ? `${d.getMonth() + 1} 月 ${d.getDate()} 日` : `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
  }
  const clock = (t) => t.split(" ")[1];

  // ---------- scenarios ----------
  const SCENARIOS = [
    ["登录", [
      ["login-off", "未启用人机验证"], ["login-turnstile", "Turnstile"], ["login-cap", "Cap（点击可验证）"],
      ["login-cap-failed", "Cap 验证失败"], ["login-error", "用户名或密码错误"], ["session-expired", "会话过期"],
    ]],
    ["评论管理", [
      ["comments", "已发布 · 选中回复"], ["comments-root", "已发布 · 选中根评论"], ["comments-untitled", "页面没有标题"],
      ["comments-extreme", "极端文本"], ["comments-none", "未选择 · 快捷键"],
      ["comments-deleted", "已删除 · 可彻底删除"], ["comments-deleted-children", "已删除 · 仍有回复"],
      ["comments-empty", "空列表"], ["comments-loading", "加载中"], ["comments-error", "加载失败"],
      ["confirm-tombstone", "确认墓碑删除"], ["confirm-permanent", "确认彻底删除"], ["comments-single-site", "只有一个站点"],
      ["comments-mobile-detail", "窄屏 · 详情"],
    ]],
    ["站点管理", [["sites", "编辑站点"], ["sites-dirty", "有未保存的修改"], ["sites-discard", "离开前确认放弃"], ["sites-create", "新增站点"], ["sites-errors", "校验错误"]]],
    ["通知设置", [
      ["notifications", "电子邮件"], ["notifications-telegram", "Telegram"], ["notifications-off", "邮件未开启"],
      ["notifications-test-ok", "测试发送成功"], ["notifications-test-fail", "测试发送失败"], ["notifications-errors", "校验错误"],
    ]],
    ["安全", [["security-cap", "Cap"], ["security-turnstile", "Turnstile"], ["security-off", "关闭"], ["security-cap-errors", "Cap 校验错误"], ["security-session", "当前会话"]]],
    ["其他", [["toast", "保存成功提示"], ["logout-failed", "退出失败"]]],
  ];

  function applyScenario(name) {
    S = freshState();
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
      case "comments-root": S.selectedId = 523; break;
      case "comments-untitled": S.selectedId = 510; break;
      case "comments-extreme": S.selectedId = 513; break;
      case "comments-none": S.selectedId = null; break;
      case "comments-deleted": S.status = "deleted"; S.selectedId = 487; break;
      case "comments-deleted-children": S.status = "deleted"; S.selectedId = 486; break;
      case "comments-empty": S.status = "deleted"; data["blog.example.com"].deleted = []; data["blog.example.com"].counts.deleted = 0; S.selectedId = null; break;
      case "comments-loading": S.queue = "loading"; S.selectedId = null; break;
      case "comments-error": S.queue = "error"; S.selectedId = null; break;
      case "confirm-tombstone": S.pendingConfirm = "tombstone"; break;
      case "confirm-permanent": S.status = "deleted"; S.selectedId = 487; S.pendingConfirm = "permanent"; break;
      case "comments-single-site": S.sites = S.sites.slice(0, 1); break;
      case "comments-mobile-detail": S.detail = true; break;
      case "sites": S.view = "sites"; break;
      case "sites-dirty": S.view = "sites"; S.presetSiteEdit = true; break;
      case "sites-discard": S.view = "sites"; S.presetSiteEdit = true; S.pendingConfirm = "discard"; break;
      case "sites-create": S.view = "sites"; S.creating = true; break;
      case "sites-errors": S.view = "sites"; S.siteErrorsPreset = true; break;
      case "notifications": S.view = "notifications"; break;
      case "notifications-telegram": S.view = "notifications"; S.channel = "telegram"; break;
      case "notifications-off": S.view = "notifications"; S.email.enabled = false; S.saved.email.enabled = false; break;
      case "notifications-test-ok": S.view = "notifications"; S.emailFeedback = { ok: true, text: "测试邮件已发送" }; break;
      case "notifications-test-fail": S.view = "notifications"; S.emailFeedback = { ok: false, text: "发送失败：SMTP 认证未通过" }; break;
      case "notifications-errors": S.view = "notifications"; S.email.recipients = ["owner@example.com", "not-an-email"]; S.email.port = 0; S.emailErrors = { port: true }; S.dirty.email = true; break;
      case "security-cap": S.view = "security"; break;
      case "security-turnstile": S.view = "security"; S.captcha.provider = "turnstile"; S.saved.captcha.provider = "turnstile"; break;
      case "security-off": S.view = "security"; S.captcha.provider = "off"; S.saved.captcha.provider = "off"; break;
      case "security-cap-errors": S.view = "security"; S.captcha.capInstanceUrl = "http://cap.example.com/?key=1"; S.captcha.capSitekey = ""; S.captchaErrors = { capInstanceUrl: true, capSitekey: true }; S.dirty.captcha = true; break;
      case "security-session": S.view = "security"; S.security = "session"; break;
      case "toast": S.toastOnLoad = "站点设置已保存。"; S.view = "sites"; break;
      case "logout-failed": S.logoutFailed = true; break;
      default: break;
    }
  }

  // ---------- toast & confirm ----------
  let toastTimer;
  function toast(text) {
    const el = $("toast");
    el.innerHTML = icon("check") + `<span>${esc(text)}</span>`;
    el.hidden = false;
    $("sr-status").textContent = text;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
  }

  let confirmHandler = null;
  function ask({ title, copy, target, ok, onOk }) {
    $("confirm-title").textContent = title;
    $("confirm-copy").textContent = copy;
    $("confirm-target").textContent = target || "";
    $("confirm-target").hidden = !target;
    $("confirm-ok").textContent = ok;
    confirmHandler = onOk;
    const dialog = $("confirm-dialog");
    if (!dialog.open) dialog.showModal();
    $("confirm-cancel").focus();
  }
  function closeConfirm() { confirmHandler = null; const d = $("confirm-dialog"); if (d.open) d.close(); }

  // ---------- unsaved changes ----------
  const DIRTY_LABELS = { site: "站点设置", email: "电子邮件通知", telegram: "Telegram 通知", captcha: "人机验证" };
  const VIEW_KEYS = { sites: ["site"], notifications: ["email", "telegram"], security: ["captcha"] };
  const dirtyKeys = () => Object.keys(S.dirty).filter((k) => S.dirty[k]);
  function markDirty(key) { if (S.dirty[key]) return; S.dirty[key] = true; renderDirty(); }
  function discardAll() {
    S.dirty = { site: false, email: false, telegram: false, captcha: false };
    S.filled = { site: null, email: false, telegram: false, captcha: false };
    S.email = clone(S.saved.email); S.telegram = clone(S.saved.telegram); S.captcha = clone(S.saved.captcha);
    S.emailErrors = {}; S.telegramErrors = {}; S.captchaErrors = {};
  }
  function guard(fn) {
    const keys = dirtyKeys();
    if (!keys.length) return fn();
    ask({
      title: "放弃未保存的修改？",
      copy: "离开后，这些修改不会保存。要保留它们，请取消并点击“保存”。",
      target: keys.map((k) => DIRTY_LABELS[k]).join("、"),
      ok: "放弃修改",
      onOk: () => { discardAll(); fn(); },
    });
  }
  function renderDirty() {
    const d = S.dirty;
    $("site-dirty").hidden = !d.site;
    $("site-reset").hidden = !d.site || S.creating;
    $("channel-dirty").hidden = !d[S.channel];
    $("channel-save").disabled = !d[S.channel];
    $("captcha-dirty").hidden = !d.captcha;
    $("captcha-save").disabled = !d.captcha;
    renderNav();
    if (S.view === "sites") renderSiteRail();
    if (S.view === "notifications") renderChannelRail();
    if (S.view === "security") renderSecurityRail();
  }

  // ---------- shell ----------
  const NAV_LABELS = { comments: "评论管理", sites: "站点管理", notifications: "通知设置", security: "安全" };
  function renderNav() {
    document.querySelectorAll(".nav-tab").forEach((tab) => {
      const view = tab.dataset.viewLink;
      if (view === S.view) tab.setAttribute("aria-current", "page"); else tab.removeAttribute("aria-current");
      const dirty = (VIEW_KEYS[view] || []).some((k) => S.dirty[k]);
      tab.innerHTML = esc(NAV_LABELS[view]) + (dirty ? DIRTY_DOT : "");
    });
  }
  function renderShell() {
    $("login-screen").hidden = S.authed;
    $("app-shell").hidden = !S.authed;
    if (!S.authed) return renderLogin();
    renderNav();
    ["comments", "sites", "notifications", "security"].forEach((v) => { $(`view-${v}`).hidden = S.view !== v; });
    $("logout-error").hidden = !S.logoutFailed;
    ({ comments: renderComments, sites: renderSites, notifications: renderNotifications, security: renderSecurity })[S.view]();
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

  // ---------- comments ----------
  function renderComments() {
    $("view-comments").dataset.detail = String(S.detail);
    renderSitePicker();
    const counts = data[S.siteId].counts;
    $("count-published").textContent = counts.published;
    $("count-deleted").textContent = counts.deleted;
    document.querySelectorAll(".status-tab").forEach((tab) => tab.setAttribute("aria-selected", String(tab.dataset.status === S.status)));
    $("sort-label").textContent = S.sort === "oldest" ? "最早在前" : "最新在前";
    $("sort-button").setAttribute("aria-label", `排序：${S.sort === "oldest" ? "最早提交在前" : "最新提交在前"}，点击切换`);

    const total = counts[S.status];
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const from = total ? (S.page - 1) * PAGE_SIZE + 1 : 0;
    const to = Math.min(S.page * PAGE_SIZE, total);
    $("pager-total").textContent = S.queue === "ready" ? (total ? `第 ${from}–${to} 条，共 ${total} 条` : "共 0 条") : "";
    $("pager-status").textContent = `${S.page} / ${pageCount}`;
    $("pager-prev").disabled = S.page <= 1 || S.queue !== "ready";
    $("pager-next").disabled = S.page >= pageCount || S.queue !== "ready";
    $("refresh-button").disabled = S.queue === "loading";
    $("refresh-button").classList.toggle("is-spinning", S.queue === "loading");

    const scroll = $("queue-scroll");
    if (S.queue === "loading") {
      scroll.setAttribute("aria-busy", "true");
      scroll.innerHTML = Array.from({ length: 6 }, () => '<div class="skeleton-row" aria-hidden="true"><span></span><span></span><span></span></div>').join("") + '<span class="visually-hidden">正在加载评论…</span>';
    } else if (S.queue === "error") {
      scroll.removeAttribute("aria-busy");
      scroll.innerHTML = '<p class="notice notice-error" role="alert">无法连接到 Ecoku，请检查网络后重试。<button class="button" type="button" data-action="retry">重试</button></p>';
    } else {
      scroll.removeAttribute("aria-busy");
      const items = list();
      scroll.innerHTML = items.length ? queueHTML(items) : `<p class="rail-empty">当前没有${S.status === "deleted" ? "已删除" : "已发布"}评论</p>`;
    }
    renderDetail();
  }

  function queueHTML(items) {
    const groups = [];
    for (const c of items) {
      const label = dayLabel(c.time);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(c); else groups.push({ label, items: [c] });
    }
    return `<div role="listbox" aria-label="评论列表">${groups.map((g, i) => `<div role="group" aria-labelledby="day-${i}">
      <p class="rail-group" id="day-${i}">${esc(g.label)}<small>${g.items.length} 条</small></p>
      <ul class="rail-list" role="none">${g.items.map(queueRow).join("")}</ul></div>`).join("")}</div>`;
  }

  function queueRow(c) {
    const deleted = S.status === "deleted";
    const name = deleted ? `#${c.id} · 已删除` : c.username;
    const where = c.title || c.mark;
    return `<li class="rail-row" role="none"><button class="rail-item" type="button" role="option" data-comment="${c.id}" aria-selected="${c.id === S.selectedId}">
      <span class="item-line"><span class="item-title${deleted ? " is-deleted" : ""}" title="${esc(name)}">${esc(name)}</span>${deleted && c.hasChildren ? '<span class="tag">有回复</span>' : ""}<time class="item-time" datetime="${esc(c.time)}">${esc(clock(c.time))}</time></span>
      ${deleted ? "" : `<span class="item-text">${esc(c.content)}</span>`}
      <span class="item-meta"><span class="grow${c.title ? "" : " mono"}" title="${esc(c.mark)}">${esc(where)}</span>${c.parent ? `<span class="item-ref" title="回复 #${c.parent}">${icon("reply")}#${c.parent}</span>` : ""}</span>
    </button></li>`;
  }

  function renderSitePicker() {
    const picker = $("site-picker");
    const s = site();
    if (S.sites.length <= 1) {
      picker.innerHTML = `<div class="site-static"><span class="site-name"><span>${esc(siteLabel(s))}</span></span><span class="site-id">${esc(s ? s.id : "")}</span></div>`;
      return;
    }
    picker.innerHTML = `<button id="site-trigger" class="site-trigger" type="button" aria-haspopup="listbox" aria-expanded="${S.siteMenuOpen}" aria-label="切换站点，当前 ${esc(siteLabel(s))}">
        <span class="site-name"><span>${esc(siteLabel(s))}</span><svg class="icon chevron" aria-hidden="true"><use href="#i-chevron"/></svg></span>
        <span class="site-id">${esc(s.id)}</span>
      </button>
      <div id="site-menu" class="site-menu" role="listbox" aria-label="选择站点" ${S.siteMenuOpen ? "" : "hidden"}>
        ${S.sites.map((x) => `<button class="site-option" type="button" role="option" data-site="${esc(x.id)}" aria-selected="${x.id === S.siteId}"><strong>${esc(siteLabel(x))}</strong><small>${esc(x.id)}</small><svg class="icon check" aria-hidden="true"><use href="#i-check"/></svg></button>`).join("")}
      </div>`;
  }

  function sourceURL(c) {
    const s = site();
    try { const u = new URL(c.mark.replace(/^\/+/, ""), s.siteUrl.replace(/\/+$/, "") + "/"); u.hash = `ecoku-comment-${c.id}`; return u.toString(); } catch { return ""; }
  }

  function fact(label, value, opts = {}) {
    const empty = !value;
    const cls = `value${opts.mono && !empty ? " mono" : ""}${empty ? " is-empty" : ""}`;
    const inner = empty ? `<span class="${cls}">—</span>`
      : opts.href ? `<a class="${cls}" href="${esc(opts.href)}" target="_blank" rel="noopener noreferrer" title="${esc(value)}">${esc(value)}</a>`
      : `<span class="${cls}" title="${esc(value)}">${esc(value)}</span>`;
    const copy = !empty && opts.copy ? `<button class="icon-button copy-button" type="button" data-copy="${esc(value)}" aria-label="复制${esc(label)}" title="复制">${icon("copy")}</button>` : "";
    return `<div class="fact"><dt>${esc(label)}</dt><dd>${inner}${copy}</dd></div>`;
  }

  function contextHTML(c) {
    if (!c.parent) return "";
    const found = findComment(c.parent);
    if (!found) return `<div class="context"><span class="context-label">${icon("reply")}<span>回复 #${c.parent}</span></span></div>`;
    const p = found.c;
    const gone = found.status === "deleted";
    return `<button class="context" type="button" data-jump="${p.id}" title="查看父评论 #${p.id}">
      <span class="context-label">${icon("reply")}<span>回复 ${esc(gone ? "已删除的评论" : p.username)}</span><span class="grow">#${p.id} · ${esc(p.time)}</span></span>
      <span class="context-text${gone ? " is-deleted" : ""}">${gone ? "该评论已删除" : esc(p.content)}</span>
    </button>`;
  }

  function emptyPane() {
    if (S.queue !== "ready") return "";
    const has = list().length > 0;
    const shortcuts = `<dl class="shortcut-list">
      <dt><kbd>J</kbd><kbd>K</kbd></dt><dd>下一条 · 上一条</dd>
      <dt><kbd>O</kbd></dt><dd>查看原评论</dd>
      <dt><kbd>Del</kbd></dt><dd>删除</dd>
      <dt><kbd>R</kbd></dt><dd>刷新</dd>
      <dt><kbd>[</kbd><kbd>]</kbd></dt><dd>上一页 · 下一页</dd>
    </dl>`;
    return `<div class="pane-empty">${MARK}<p>${has ? "从左侧选择一条评论" : `当前没有${S.status === "deleted" ? "已删除" : "已发布"}评论`}</p>${has ? shortcuts : ""}</div>`;
  }

  function renderDetail() {
    const pane = $("detail-pane");
    const c = S.queue === "ready" ? selected() : null;
    if (!c) { pane.innerHTML = emptyPane(); return; }
    const deleted = S.status === "deleted";
    const link = sourceURL(c);
    const name = deleted ? "已删除" : c.username;
    let action = "";
    if (!deleted) action = '<button class="button danger-button" type="button" data-action="tombstone" title="墓碑删除（Delete）">墓碑删除</button>';
    else if (!c.hasChildren) action = '<button class="button danger-button" type="button" data-action="permanent" title="彻底删除（Delete）">彻底删除</button>';
    else action = '<span class="hint">仍有回复，不能彻底删除</span>';
    const ref = c.parent
      ? `<span aria-hidden="true">·</span><button class="link-button" type="button" data-jump="${c.parent}">回复 #${c.parent}</button>`
      : '<span aria-hidden="true">·</span><span>根评论</span>';
    const article = c.title ? `《${esc(c.title)}》` : `<span class="mono">${esc(c.mark)}</span>`;
    const body = deleted
      ? `<div class="tombstone"><strong>该评论已删除</strong><span>昵称、私有邮箱、网站和正文已清除，公开页面显示“已删除”。</span><span>${c.hasChildren ? "下面仍有回复，墓碑保留以维持楼层结构，暂时不能彻底删除。" : "没有回复，可以彻底删除，从数据库中移除。"}</span></div>`
      : `<p class="comment-body">${esc(c.content)}</p>`;
    pane.innerHTML = `
      <div class="pane-bar">
        <button class="button button-quiet back-button" type="button" data-action="back">${icon("left")}评论</button>
        <div class="pane-ref"><span class="badge ${deleted ? "badge-deleted" : "badge-published"}">${deleted ? "已删除" : "已发布"}</span><span>#${c.id}</span>${ref}</div>
        <div class="pane-actions">
          ${link ? `<a class="button button-quiet" data-source href="${esc(link)}" target="_blank" rel="noopener noreferrer" title="查看原评论（O）">${icon("external")}<span class="label">查看原评论</span></a>` : ""}
          ${action}
        </div>
      </div>
      ${S.actionMessage ? `<p class="notice notice-error" role="alert">${esc(S.actionMessage)}</p>` : ""}
      <div class="pane-body">
        <div class="review">
          <article class="review-main" aria-labelledby="comment-detail-title">
            ${contextHTML(c)}
            <header class="comment-head">
              <div class="comment-author"><h2 id="comment-detail-title" class="${deleted ? "is-deleted" : ""}" title="${esc(name)}">${esc(name)}</h2></div>
              <time datetime="${esc(c.time)}">${esc(c.time)}</time>
            </header>
            ${body}
            <p class="comment-where">发表在 ${link ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${article}</a>` : article}</p>
          </article>
          <aside class="facts" aria-label="评论信息">
            <div class="fact-group"><h3>访客</h3><dl>
              ${fact("私有邮箱", deleted ? "" : c.email, { mono: true, copy: true })}
              ${fact("访客网站", deleted ? "" : c.url, { mono: true, href: deleted ? "" : c.url })}
            </dl></div>
            <div class="fact-group"><h3>页面</h3><dl>
              ${fact("文章标题", c.title)}
              ${fact("页面 key", c.mark, { mono: true, copy: true })}
            </dl></div>
            <div class="fact-group"><h3>楼层</h3><dl>
              ${fact("位置", c.parent ? `回复 #${c.parent}` : "根评论")}
              ${fact("回复", c.hasChildren ? "有回复" : "暂无回复")}
            </dl></div>
          </aside>
        </div>
      </div>`;
  }

  function selectComment(id, { open = false, focus = false } = {}) {
    S.selectedId = id;
    if (open) S.detail = true;
    renderComments();
    const el = document.querySelector(`.rail-item[data-comment="${id}"]`);
    if (el) { el.scrollIntoView({ block: "nearest" }); if (focus) el.focus(); }
    $("detail-pane").scrollTop = 0;
  }
  function step(delta) {
    const items = list();
    if (!items.length || S.queue !== "ready") return;
    const i = items.findIndex((c) => c.id === S.selectedId);
    const next = items[i < 0 ? 0 : Math.min(items.length - 1, Math.max(0, i + delta))];
    selectComment(next.id, { focus: document.activeElement?.classList.contains("rail-item") });
  }
  function jumpTo(id) {
    const found = findComment(id);
    if (!found) return;
    S.status = found.status;
    selectComment(id, { open: S.detail });
  }
  function refresh() {
    S.queue = "loading"; renderComments();
    setTimeout(() => { S.queue = "ready"; if (!selected()) S.selectedId = (list()[0] || {}).id ?? null; renderComments(); toast("评论列表已刷新。"); }, 700);
  }

  function confirmDelete(kind) {
    const c = selected();
    if (!c) return;
    if (kind === "tombstone") {
      ask({
        title: "墓碑删除这条评论？",
        copy: "昵称、私有邮箱、网站和正文会被清除，公开页面改为显示“已删除”，下面的回复保留不变。此操作无法撤销。",
        target: `#${c.id} · ${c.username} · ${c.content.slice(0, 40)}${c.content.length > 40 ? "…" : ""}`,
        ok: "墓碑删除",
        onOk: () => removeComment(c, "tombstone"),
      });
    } else {
      ask({ title: "彻底删除这条墓碑？", copy: "这条墓碑会从数据库中移除。此操作无法撤销。", target: `#${c.id} · ${c.mark}`, ok: "彻底删除", onOk: () => removeComment(c, "permanent") });
    }
  }
  function removeComment(c, kind) {
    const before = list();
    const index = before.findIndex((x) => x.id === c.id);
    const bucket = data[S.siteId];
    if (kind === "tombstone") {
      bucket.published = bucket.published.filter((x) => x.id !== c.id);
      bucket.deleted.unshift({ id: c.id, parent: c.parent, hasChildren: c.hasChildren, time: c.time, mark: c.mark, title: c.title });
      bucket.counts.published -= 1; bucket.counts.deleted += 1;
      toast("评论已替换为墓碑。");
    } else {
      bucket.deleted = bucket.deleted.filter((x) => x.id !== c.id);
      bucket.counts.deleted -= 1;
      toast("墓碑已彻底删除。");
    }
    const after = list();
    S.selectedId = (after[index] || after[index - 1] || {}).id ?? null;
    S.detail = false;
    renderComments();
  }

  // ---------- sites ----------
  const siteFields = {
    id: "site-id", siteUrl: "site-url", name: "site-name", placeholder: "site-placeholder", commentLimit: "site-limit",
    emptyMessage: "site-empty", smojiManifestUrl: "smoji-manifest-url", bloggerNickname: "blogger-nickname",
    bloggerEmail: "blogger-email", bloggerBadge: "blogger-badge",
  };
  function renderSites() {
    $("view-sites").dataset.detail = String(S.detail);
    renderSiteRail();
    renderSitePane();
  }
  function renderSiteRail() {
    $("sites-count").textContent = `${S.sites.length} 个站点`;
    const draft = S.creating ? `<li class="rail-row"><button class="rail-item" type="button" aria-current="true"><span class="item-line"><span class="item-title" style="font-style: italic">新站点</span>${S.dirty.site ? DIRTY_DOT : ""}</span><span class="item-meta"><span class="grow">尚未保存</span></span></button></li>` : "";
    $("site-list").innerHTML = `<ul class="rail-list">${draft}${S.sites.map((x) => {
      const current = !S.creating && x.id === S.editSiteId;
      return `<li class="rail-row"><button class="rail-item" type="button" data-site-edit="${esc(x.id)}" aria-current="${current}">
        <span class="item-line"><span class="item-title">${esc(siteLabel(x))}</span>${current && S.dirty.site ? DIRTY_DOT : ""}</span>
        <span class="item-meta"><span class="grow mono">${esc(x.id)}</span><span>${x.allowedOrigins.length} 个来源</span></span>
      </button></li>`;
    }).join("")}</ul>`;
  }
  function embedCode(s) {
    if (!s) return "";
    return `<section
  id="ecoku-comments"
  class="ecoku-shell"
  data-ecoku-comments
  data-server-url="${SERVER_URL}"
  data-site-id="${s.id}"
  data-page-key="/posts/hello-world/"
  data-page-title="你好，世界"
>
  <div class="ecoku-loader" data-ecoku-loader hidden>
    <p class="ecoku-loader-status" data-ecoku-status></p>
    <button class="ecoku-loader-retry" data-ecoku-retry type="button" hidden>重新加载评论</button>
  </div>
  <div id="ecoku-mount" data-ecoku-mount></div>
</section>
<script src="${SERVER_URL}/client/ecoku-loader.js" defer></script>`;
  }
  function renderSitePane() {
    const current = S.creating ? null : S.sites.find((x) => x.id === S.editSiteId);
    const src = current || SITE_DEFAULTS;
    $("site-pane-title").textContent = S.creating ? "新增站点" : siteLabel(current);
    $("site-pane-id").textContent = S.creating ? "" : current.id;
    $("sec-embed-block").hidden = S.creating;
    $("embed-code").textContent = embedCode(current);
    const key = S.creating ? "__new" : S.editSiteId;
    if (S.filled.site !== key) {
      Object.entries(siteFields).forEach(([k, id]) => { $(id).value = src[k] ?? ""; });
      $("site-id").readOnly = !S.creating;
      $("site-id-help").innerHTML = S.creating ? '对应接入代码中的 <code class="mono">data-site-id</code>。字母或数字开头，可含 <span class="mono">. _ -</span>，最多 100 个字符；创建后不能修改。' : '对应接入代码中的 <code class="mono">data-site-id</code>，创建后不能修改。';
      $("site-origins").value = src.allowedOrigins.join("\n");
      document.querySelectorAll('input[name="site-sort"]').forEach((r) => { r.checked = r.value === src.defaultSort; });
      $("site-email-required").checked = src.emailRequired;
      $("site-website-required").checked = src.websiteRequired;
      $("smoji-enabled").checked = src.smojiEnabled;
      $("blogger-passphrase").value = "";
      $("blogger-passphrase").placeholder = src.bloggerPassphraseSet ? "已设置，输入新值以更换" : "";
      S.filled.site = key;
      showSiteErrors({});
      $("site-pane").scrollTop = 0;
    }
    if (S.siteErrorsPreset) {
      S.siteErrorsPreset = false;
      $("site-url").value = "blog.example.com";
      $("site-origins").value = "https://blog.example.com/posts/\nhttps://blog.example.com";
      $("blogger-email").value = "";
      S.dirty.site = true;
      showSiteErrors({ siteUrl: true, origins: true, bloggerIdentity: true });
    }
    if (S.presetSiteEdit) {
      S.presetSiteEdit = false;
      $("site-placeholder").value = "写下你的想法（仅支持纯文本）";
      S.dirty.site = true;
    }
    $("site-cancel").hidden = !S.creating;
    $("site-submit").textContent = S.creating ? "创建站点" : "保存站点";
    $("new-site-button").disabled = S.creating;
    $("site-message").hidden = !S.siteMessage;
    $("site-message").textContent = S.siteMessage;
    renderDirty();
  }
  const errorInputs = { id: ["site-id"], siteUrl: ["site-url"], name: ["site-name"], origins: ["site-origins"], placeholder: ["site-placeholder"], commentLimit: ["site-limit"], emptyMessage: ["site-empty"], smojiManifestUrl: ["smoji-manifest-url"], bloggerNickname: ["blogger-nickname"], bloggerEmail: ["blogger-email"], bloggerIdentity: ["blogger-nickname", "blogger-email"], bloggerPassphrase: ["blogger-passphrase"], bloggerBadge: ["blogger-badge"] };
  function showSiteErrors(errors, focus) {
    const form = $("site-form");
    form.querySelectorAll("[data-error]").forEach((p) => { p.hidden = !errors[p.dataset.error]; });
    form.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
    Object.keys(errors).forEach((k) => (errorInputs[k] || []).forEach((id) => $(id).setAttribute("aria-invalid", "true")));
    const n = Object.keys(errors).length;
    const summary = $("site-form-summary");
    summary.textContent = n ? `有 ${n} 处需要修改` : "";
    summary.hidden = !n;
    summary.className = "hint is-error";
    if (n && focus) form.querySelector('[aria-invalid="true"]')?.focus();
  }
  function validateSite() {
    const e = {};
    const v = (id) => $(id).value.trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(v("site-id"))) e.id = true;
    try { const u = new URL(v("site-url")); if (!/^https?:$/.test(u.protocol)) throw 0; } catch { e.siteUrl = true; }
    const origins = $("site-origins").value.split(/[\r\n,]+/).map((x) => x.trim().replace(/\/$/, "")).filter(Boolean);
    if (!origins.length || origins.length > 32) e.origins = true;
    origins.forEach((o) => { try { if (new URL(o).origin !== o) throw 0; } catch { e.origins = true; } });
    if (!v("site-placeholder")) e.placeholder = true;
    const limit = Number($("site-limit").value); if (!Number.isInteger(limit) || limit < 1 || limit > 10000) e.commentLimit = true;
    if (!v("site-empty")) e.emptyMessage = true;
    if ($("smoji-enabled").checked && !v("smoji-manifest-url")) e.smojiManifestUrl = true;
    if (Boolean(v("blogger-nickname")) !== Boolean(v("blogger-email"))) e.bloggerIdentity = true;
    return e;
  }
  function saveSite() {
    const errors = validateSite();
    showSiteErrors(errors, true);
    if (Object.keys(errors).length) return;
    const v = (id) => $(id).value.trim();
    const values = {
      siteUrl: v("site-url"), name: v("site-name"), allowedOrigins: $("site-origins").value.split(/\n+/).map((x) => x.trim()).filter(Boolean),
      defaultSort: document.querySelector('input[name="site-sort"]:checked')?.value || "newest",
      emailRequired: $("site-email-required").checked, websiteRequired: $("site-website-required").checked,
      placeholder: v("site-placeholder"), commentLimit: Number(v("site-limit")), emptyMessage: $("site-empty").value,
      smojiEnabled: $("smoji-enabled").checked, smojiManifestUrl: v("smoji-manifest-url"),
      bloggerNickname: v("blogger-nickname"), bloggerEmail: v("blogger-email"), bloggerBadge: v("blogger-badge"),
    };
    const wasCreating = S.creating;
    if (wasCreating) {
      const id = v("site-id");
      S.sites.push({ ...SITE_DEFAULTS, ...values, id });
      data[id] = { published: [], deleted: [], counts: { published: 0, deleted: 0 } };
      S.editSiteId = id; S.creating = false;
    } else {
      Object.assign(S.sites.find((x) => x.id === S.editSiteId), values);
    }
    S.dirty.site = false; S.filled.site = null;
    renderSites();
    toast(wasCreating ? "站点已创建。" : "站点设置已保存。");
  }

  // ---------- notifications ----------
  const validEmail = (x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x) && x.length <= 254;
  const validTarget = (x) => /^-?\d{1,32}$/.test(x);
  const CHANNEL_NAMES = { email: "电子邮件", telegram: "Telegram" };
  function renderChips(containerId, values, kind) {
    const box = $(containerId);
    const valid = kind === "email" ? validEmail : validTarget;
    const invalid = values.some((x) => !valid(x));
    box.setAttribute("aria-invalid", String(invalid));
    box.innerHTML = values.map((x, i) => `<span class="chip${valid(x) ? "" : " is-invalid"}"><span class="chip-text" title="${esc(x)}">${esc(x)}</span><button class="chip-remove" type="button" data-chip="${i}" aria-label="移除 ${esc(x)}">×</button></span>`).join("") +
      `<input id="${containerId}-input" type="text" autocomplete="off" aria-label="${kind === "email" ? "通知收件人" : "接收目标 ID"}">`;
    let err = box.parentElement.querySelector(".chip-error");
    if (!err) { err = document.createElement("p"); err.className = "field-error chip-error"; box.after(err); }
    err.textContent = kind === "email" ? "邮箱格式错误" : "接收目标 ID 格式错误";
    err.hidden = !invalid;
  }
  function renderChannelRail() {
    $("channel-list").innerHTML = `<ul class="rail-list">${["email", "telegram"].map((key) => {
      const s = S.saved[key];
      const meta = key === "email"
        ? (s.enabled ? `${s.recipients.length} 位收件人 · ${s.host}` : "不发送任何邮件")
        : (s.enabled ? `${s.targets.length} 个接收目标` : "不发送任何消息");
      return `<li class="rail-row"><button class="rail-item" type="button" data-channel="${key}" aria-current="${S.channel === key}">
        <span class="item-line"><span class="item-title">${CHANNEL_NAMES[key]}</span>${S.dirty[key] ? DIRTY_DOT : ""}<span class="badge ${s.enabled ? "badge-on" : "badge-off"}">${s.enabled ? "已开启" : "未开启"}</span></span>
        <span class="item-meta"><span class="grow">${esc(meta)}</span></span>
      </button></li>`;
    }).join("")}</ul>`;
  }
  function fillChannel(key) {
    if (key === "email") {
      const e = S.email;
      $("email-server").value = e.host; $("email-port").value = e.port || ""; $("email-user").value = e.username; $("email-sender").value = e.fromAddress;
      $("email-password").value = "";
    } else {
      $("telegram-token").value = "";
    }
    S.filled[key] = true;
  }
  function renderNotifications() {
    $("view-notifications").dataset.detail = String(S.detail);
    renderChannelRail();
    const key = S.channel;
    const c = S[key];
    $("email-form").hidden = key !== "email";
    $("telegram-form").hidden = key !== "telegram";
    $("channel-pane-title").textContent = CHANNEL_NAMES[key];
    const on = S.saved[key].enabled;
    $("channel-state").className = `badge ${on ? "badge-on" : "badge-off"}`;
    $("channel-state").textContent = on ? "已开启" : "未开启";
    if (!S.filled[key]) fillChannel(key);

    $(`${key}-enabled`).checked = c.enabled;
    document.querySelectorAll(`.${key}-body`).forEach((el) => { el.hidden = !c.enabled; });
    $(`${key}-off`).hidden = c.enabled;
    if (key === "email") {
      document.querySelectorAll('input[name="email-encryption"]').forEach((r) => { r.checked = r.value === c.encryption; });
      $("email-port").placeholder = c.encryption === "starttls" ? "587" : "465";
      $("email-password").placeholder = c.passwordSet ? "已设置，输入新值以更换" : "";
      renderChips("email-recipients", c.recipients, "email");
      $("email-port").setAttribute("aria-invalid", String(Boolean(S.emailErrors.port)));
      $("email-server").setAttribute("aria-invalid", String(Boolean(S.emailErrors.host)));
    } else {
      $("telegram-token").placeholder = c.tokenSet ? "已设置，输入新值以更换" : "";
      renderChips("telegram-targets", c.targets, "telegram");
    }
    $(`${key}-form`).querySelectorAll("[data-error]").forEach((p) => { p.hidden = !S[`${key}Errors`][p.dataset.error]; });

    const test = $("channel-test");
    test.hidden = !on;
    test.querySelector(".label").textContent = key === "email" ? "发送测试邮件" : "发送测试消息";
    test.title = "按已保存的配置发送";
    const f = S[`${key}Feedback`];
    const fb = $("channel-feedback");
    fb.className = "test-feedback" + (f ? (f.ok ? " is-success" : " is-failure") : "");
    fb.innerHTML = f ? `${icon(f.ok ? "check" : "alert")}<span>${esc(f.text)}</span>` : "";
    renderDirty();
  }
  function addChips(key, raw) {
    const field = key === "email" ? "recipients" : "targets";
    const next = raw.split(/[，,\n]+/).map((x) => x.trim()).filter(Boolean);
    if (!next.length) return;
    S[key][field] = [...new Set([...S[key][field], ...next])];
    markDirty(key);
    renderNotifications();
    $(`${key === "email" ? "email-recipients" : "telegram-targets"}-input`).focus();
  }
  function saveChannel() {
    const key = S.channel;
    const c = S[key];
    if (key === "email") {
      c.host = $("email-server").value.trim(); c.port = Number($("email-port").value) || 0; c.username = $("email-user").value.trim(); c.fromAddress = $("email-sender").value.trim();
      S.emailErrors = c.enabled && (c.port < 1 || c.port > 65535) ? { port: true } : {};
      if (c.enabled && (Object.keys(S.emailErrors).length || c.recipients.some((x) => !validEmail(x)))) return renderNotifications();
    } else if (c.enabled && c.targets.some((x) => !validTarget(x))) return renderNotifications();
    S.saved[key] = clone(c);
    S.dirty[key] = false; S[`${key}Feedback`] = null;
    renderNotifications();
    toast(`${CHANNEL_NAMES[key]}通知已保存。`);
  }

  // ---------- security ----------
  const PROVIDER_LABELS = { off: "已关闭", turnstile: "Cloudflare Turnstile", cap: "Cap" };
  function renderSecurityRail() {
    const p = S.saved.captcha;
    const captchaMeta = p.provider === "cap" ? `Cap · ${p.capInstanceUrl.replace(/^https:\/\//, "")}` : PROVIDER_LABELS[p.provider];
    const items = [
      ["captcha", "人机验证", captchaMeta, S.dirty.captcha],
      ["session", "当前会话", "还剩 7 小时 56 分", false],
    ];
    $("security-list").innerHTML = `<ul class="rail-list">${items.map(([key, title, meta, dirty]) => `<li class="rail-row"><button class="rail-item" type="button" data-security="${key}" aria-current="${S.security === key}">
      <span class="item-line"><span class="item-title">${title}</span>${dirty ? DIRTY_DOT : ""}${key === "captcha" ? `<span class="badge ${p.provider === "off" ? "badge-off" : "badge-on"}">${p.provider === "off" ? "未开启" : "已开启"}</span>` : ""}</span>
      <span class="item-meta"><span class="grow">${esc(meta)}</span></span>
    </button></li>`).join("")}</ul>`;
  }
  function renderSecurity() {
    $("view-security").dataset.detail = String(S.detail);
    renderSecurityRail();
    const isCaptcha = S.security === "captcha";
    $("captcha-form").hidden = !isCaptcha;
    $("session-panel").hidden = isCaptcha;
    $("security-pane-title").textContent = isCaptcha ? "人机验证" : "当前会话";
    $("captcha-save").hidden = !isCaptcha;
    if (!S.filled.captcha) {
      $("turnstile-sitekey").value = S.captcha.turnstileSitekey;
      $("cap-instance-url").value = S.captcha.capInstanceUrl;
      $("cap-sitekey").value = S.captcha.capSitekey;
      $("turnstile-secret").value = ""; $("cap-secret").value = "";
      S.filled.captcha = true;
    }
    const p = S.captcha.provider;
    document.querySelectorAll('input[name="captcha-provider"]').forEach((r) => { r.checked = r.value === p; });
    $("panel-off").hidden = p !== "off"; $("panel-turnstile").hidden = p !== "turnstile"; $("panel-cap").hidden = p !== "cap";
    $("view-security").querySelectorAll("[data-error]").forEach((el) => { el.hidden = !S.captchaErrors[el.dataset.error]; });
    ["cap-instance-url", "cap-sitekey", "cap-secret", "turnstile-sitekey", "turnstile-secret"].forEach((id) => $(id).removeAttribute("aria-invalid"));
    if (S.captchaErrors.capInstanceUrl) $("cap-instance-url").setAttribute("aria-invalid", "true");
    if (S.captchaErrors.capSitekey) $("cap-sitekey").setAttribute("aria-invalid", "true");
    if (S.captchaErrors.turnstileSitekey) $("turnstile-sitekey").setAttribute("aria-invalid", "true");
    renderDirty();
  }
  function saveCaptcha() {
    const e = {};
    S.captcha.capInstanceUrl = $("cap-instance-url").value.trim().replace(/\/+$/, "");
    S.captcha.capSitekey = $("cap-sitekey").value.trim();
    S.captcha.turnstileSitekey = $("turnstile-sitekey").value.trim();
    if (S.captcha.provider === "cap") {
      try { const u = new URL(S.captcha.capInstanceUrl); if (u.protocol !== "https:" || u.search || u.hash) throw 0; } catch { e.capInstanceUrl = true; }
      if (!S.captcha.capSitekey) e.capSitekey = true;
    }
    if (S.captcha.provider === "turnstile" && !S.captcha.turnstileSitekey) e.turnstileSitekey = true;
    S.captchaErrors = e;
    if (!Object.keys(e).length) { S.saved.captcha = clone(S.captcha); S.dirty.captcha = false; toast("验证设置已保存。"); }
    renderSecurity();
  }

  // ---------- events ----------
  function go(view) {
    if (view === S.view) { S.detail = false; return renderShell(); }
    guard(() => { S.view = view; S.siteMenuOpen = false; S.detail = false; renderShell(); });
  }
  function copyText(text) {
    try { navigator.clipboard?.writeText(text); } catch { /* the prototype only shows the confirmation */ }
    toast("已复制。");
  }

  document.addEventListener("click", (event) => {
    const t = event.target.closest("button, a");
    if (S.siteMenuOpen && !event.target.closest("#site-picker")) { S.siteMenuOpen = false; renderSitePicker(); }
    if (!t) return;
    if (t.dataset.viewLink) return go(t.dataset.viewLink);
    if (t.id === "site-trigger") { S.siteMenuOpen = !S.siteMenuOpen; renderSitePicker(); if (S.siteMenuOpen) document.querySelector('.site-option[aria-selected="true"]')?.focus(); return; }
    if (t.dataset.site) { S.siteId = t.dataset.site; S.siteMenuOpen = false; S.status = "published"; S.page = 1; S.selectedId = (list()[0] || {}).id ?? null; renderComments(); $("site-trigger")?.focus(); return; }
    if (t.dataset.status) { S.status = t.dataset.status; S.page = 1; S.selectedId = (list()[0] || {}).id ?? null; S.detail = false; return renderComments(); }
    if (t.dataset.comment) return selectComment(Number(t.dataset.comment), { open: true });
    if (t.dataset.jump) return jumpTo(Number(t.dataset.jump));
    if (t.dataset.copy) return copyText(t.dataset.copy);
    if (t.dataset.copyFrom) return copyText($(t.dataset.copyFrom).textContent);
    if (t.id === "sort-button") { S.sort = S.sort === "newest" ? "oldest" : "newest"; S.page = 1; S.selectedId = (list()[0] || {}).id ?? null; return renderComments(); }
    if (t.id === "refresh-button" || t.dataset.action === "retry") return refresh();
    if (t.id === "pager-prev" && S.page > 1) { S.page -= 1; return renderComments(); }
    if (t.id === "pager-next") { S.page += 1; return renderComments(); }
    if (t.dataset.action === "back") {
      guard(() => { S.detail = false; renderShell(); document.querySelector(`#view-${S.view} .rail-item[aria-selected="true"], #view-${S.view} .rail-item[aria-current="true"]`)?.focus(); });
      return;
    }
    if (t.dataset.action === "tombstone" || t.dataset.action === "permanent") return confirmDelete(t.dataset.action);
    if (t.id === "confirm-cancel") return closeConfirm();
    if (t.id === "confirm-ok") { const fn = confirmHandler; closeConfirm(); if (fn) fn(); return; }
    if (t.id === "logout-button" || t.dataset.action === "logout") {
      if (S.logoutFailed) { S.logoutFailed = false; renderShell(); return; }
      guard(() => { S.authed = false; S.loginMessage = ""; renderShell(); });
      return;
    }
    if (t.id === "new-site-button") { guard(() => { S.creating = true; S.detail = true; renderSites(); $("site-id").focus(); }); return; }
    if (t.id === "site-cancel") { discardAll(); S.creating = false; S.detail = false; return renderSites(); }
    if (t.id === "site-reset") { discardAll(); return renderSites(); }
    if (t.dataset.siteEdit) {
      const id = t.dataset.siteEdit;
      if (id === S.editSiteId && !S.creating) { S.detail = true; return renderSites(); }
      guard(() => { S.creating = false; S.editSiteId = id; S.detail = true; renderSites(); });
      return;
    }
    if (t.dataset.channel) {
      const key = t.dataset.channel;
      if (key === S.channel) { S.detail = true; return renderNotifications(); }
      guard(() => { S.channel = key; S.detail = true; renderNotifications(); });
      return;
    }
    if (t.dataset.security) {
      const key = t.dataset.security;
      if (key === S.security) { S.detail = true; return renderSecurity(); }
      guard(() => { S.security = key; S.detail = true; renderSecurity(); });
      return;
    }
    if (t.dataset.chip) {
      const box = t.closest(".chip-field"); const key = box.dataset.kind === "email" ? "email" : "telegram"; const field = key === "email" ? "recipients" : "targets";
      S[key][field] = S[key][field].filter((_, i) => i !== Number(t.dataset.chip));
      markDirty(key); return renderNotifications();
    }
    if (t.id === "channel-test") {
      S[`${S.channel}Feedback`] = { ok: true, text: S.channel === "email" ? "测试邮件已发送" : "测试消息已发送" };
      return renderNotifications();
    }
    if (t.id === "channel-save") return saveChannel();
    if (t.id === "captcha-save") return saveCaptcha();
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

  function trackDirty(event) {
    const form = event.target.closest && event.target.closest("[data-dirty-key]");
    if (form) markDirty(form.dataset.dirtyKey);
  }
  document.addEventListener("input", (event) => {
    if (event.target.id === "login-username" || event.target.id === "login-password") return updateLoginButton();
    trackDirty(event);
  });
  document.addEventListener("change", (event) => {
    const t = event.target;
    trackDirty(event);
    if (t.id === "email-enabled" || t.id === "telegram-enabled") { const key = t.id.split("-")[0]; S[key].enabled = t.checked; S[`${key}Feedback`] = null; return renderNotifications(); }
    if (t.name === "email-encryption") { S.email.encryption = t.value; return renderNotifications(); }
    if (t.name === "captcha-provider") { S.captcha.provider = t.value; S.captchaErrors = {}; return renderSecurity(); }
  });

  document.addEventListener("keydown", (event) => {
    const t = event.target;
    if (t.closest && t.closest(".chip-field") && t.tagName === "INPUT") {
      const box = t.closest(".chip-field"); const key = box.dataset.kind === "email" ? "email" : "telegram"; const field = key === "email" ? "recipients" : "targets";
      if (["Enter", ",", "，"].includes(event.key)) { event.preventDefault(); addChips(key, t.value); }
      else if (event.key === "Backspace" && !t.value && S[key][field].length) { S[key][field] = S[key][field].slice(0, -1); markDirty(key); renderNotifications(); $(`${box.id}-input`).focus(); }
      return;
    }
    if (t.closest && t.closest("#site-menu")) {
      const opts = [...document.querySelectorAll(".site-option")];
      const i = opts.indexOf(document.activeElement);
      if (event.key === "Escape") { event.preventDefault(); S.siteMenuOpen = false; renderSitePicker(); $("site-trigger").focus(); }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); opts[(i + (event.key === "ArrowDown" ? 1 : -1) + opts.length) % opts.length].focus(); }
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s" && S.authed && S.view !== "comments") {
      event.preventDefault();
      if (S.view === "sites") $("site-form").requestSubmit();
      if (S.view === "notifications" && S.dirty[S.channel]) saveChannel();
      if (S.view === "security" && S.dirty.captcha) saveCaptcha();
      return;
    }
    if ($("confirm-dialog").open || !S.authed || S.view !== "comments") return;
    if ((t.closest && t.closest("input, textarea, select, [contenteditable]")) || event.metaKey || event.ctrlKey || event.altKey) return;
    const onItem = t.classList && t.classList.contains("rail-item");
    const k = event.key;
    if (k === "Escape" && S.detail) { S.detail = false; renderComments(); }
    else if (k === "j" || k === "J" || (onItem && k === "ArrowDown")) { event.preventDefault(); step(1); }
    else if (k === "k" || k === "K" || (onItem && k === "ArrowUp")) { event.preventDefault(); step(-1); }
    else if (k === "o" || k === "O") document.querySelector("#detail-pane [data-source]")?.click();
    else if (k === "Delete") document.querySelector('#detail-pane [data-action="tombstone"], #detail-pane [data-action="permanent"]')?.click();
    else if (k === "r" || k === "R") refresh();
    else if (k === "[" && !$("pager-prev").disabled) $("pager-prev").click();
    else if (k === "]" && !$("pager-next").disabled) $("pager-next").click();
  });

  document.addEventListener("paste", (event) => {
    const t = event.target;
    if (!(t.closest && t.closest(".chip-field"))) return;
    const text = event.clipboardData?.getData("text") ?? "";
    if (!/[，,\n]/.test(text)) return;
    event.preventDefault();
    addChips(t.closest(".chip-field").dataset.kind === "email" ? "email" : "telegram", text);
  });

  document.addEventListener("focusout", (event) => {
    const t = event.target;
    if (t.closest && t.closest(".chip-field") && t.tagName === "INPUT" && t.value.trim()) {
      const key = t.closest(".chip-field").dataset.kind === "email" ? "email" : "telegram";
      const value = t.value; t.value = "";
      setTimeout(() => addChips(key, value));
    }
  });

  $("site-form").addEventListener("submit", (event) => { event.preventDefault(); saveSite(); });

  $("login-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (S.login === "cap" && S.capState !== "done") { S.loginMessage = "请完成验证后再登录。"; renderLogin(); $("cap-trigger").focus(); return; }
    $("login-password").value = ""; $("login-username").value = "";
    S.authed = true; S.loginMessage = ""; S.view = "comments"; renderShell();
  });

  $("confirm-dialog").addEventListener("close", () => { confirmHandler = null; });
  $("confirm-dialog").addEventListener("click", (event) => { if (event.target === event.currentTarget) closeConfirm(); });

  // ---------- prototype controller ----------
  const select = $("scenario-select");
  select.innerHTML = SCENARIOS.map(([label, items]) => `<optgroup label="${label}">${items.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</optgroup>`).join("");
  select.addEventListener("change", () => { window.location.hash = select.value; });
  $("theme-select").addEventListener("change", (e) => { document.documentElement.dataset.theme = e.target.value; });

  function boot() {
    const name = window.location.hash.slice(1) || "comments";
    select.value = name;
    closeConfirm();
    applyScenario(name);
    renderShell();
    if (S.pendingConfirm === "tombstone" || S.pendingConfirm === "permanent") confirmDelete(S.pendingConfirm);
    if (S.pendingConfirm === "discard") guard(() => { S.view = "comments"; renderShell(); });
    if (S.toastOnLoad) toast(S.toastOnLoad);
  }
  window.addEventListener("hashchange", boot);
  boot();
})();
