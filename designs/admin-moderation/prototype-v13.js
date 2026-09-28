/* Ecoku admin v13 prototype. Static mock data only: no network, no storage. */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;

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

  const SITE_DEFAULTS = { id: "", siteUrl: "", name: "", allowedOrigins: [], defaultSort: "newest", emailRequired: true, websiteRequired: false, placeholder: "写下评论（仅支持纯文本）", commentLimit: 1000, emptyMessage: "还没有评论\n成为第一个留下评论的人。", smojiEnabled: false, smojiManifestUrl: "", bloggerNickname: "", bloggerEmail: "", bloggerBadge: "[博主]", bloggerPassphraseSet: false };

  // ---------- state ----------
  let S;
  let data;
  function freshState() {
    data = {
      "blog.example.com": { published: PUBLISHED.map((c) => ({ ...c })), deleted: DELETED.map((c) => ({ ...c })), counts: { published: 504, deleted: 15 } },
      notes: { published: NOTES_PUBLISHED.map((c) => ({ ...c })), deleted: [], counts: { published: 3, deleted: 0 } },
    };
    return {
      authed: true, login: "off", loginMessage: "", capState: "idle", logoutFailed: false,
      view: "comments", sites: SITES.map((s) => ({ ...s, allowedOrigins: [...s.allowedOrigins] })), siteId: "blog.example.com",
      status: "published", sort: "newest", page: 1, selectedId: 519, mobileDetail: false, siteMenuOpen: false,
      queue: "ready", actionMessage: "",
      creating: false, siteErrors: {}, siteMessage: "",
      email: { enabled: true, host: "smtp.example.com", port: 465, encryption: "tls", username: "notice@example.com", passwordSet: true, fromAddress: "notice@example.com", recipients: ["owner@example.com"] },
      emailPersisted: true, emailErrors: {}, emailFeedback: null,
      telegram: { enabled: true, tokenSet: true, targets: ["123456789", "-1001234567890"] },
      telegramPersisted: true, telegramErrors: {}, telegramFeedback: null,
      captcha: { provider: "cap", turnstileSitekey: "0x4AAAAAAA00000000000000", capInstanceUrl: "https://cap.example.com", capSitekey: "d9256640cb53" },
      captchaErrors: {},
    };
  }

  const site = () => S.sites.find((s) => s.id === S.siteId) || null;
  const siteLabel = (s) => { if (!s) return ""; if (s.name) return s.name; try { return new URL(s.siteUrl).hostname; } catch { return s.id; } };
  const pool = () => (data[S.siteId] || { published: [], deleted: [] })[S.status];
  const list = () => { const items = [...pool()]; return S.sort === "oldest" ? items.reverse() : items; };
  const selected = () => pool().find((c) => c.id === S.selectedId) || null;

  // ---------- scenarios ----------
  const SCENARIOS = [
    ["登录", [
      ["login-off", "未启用人机验证"], ["login-turnstile", "Turnstile"], ["login-cap", "Cap（点击可验证）"],
      ["login-cap-failed", "Cap 验证失败"], ["login-error", "用户名或密码错误"], ["session-expired", "会话过期"],
    ]],
    ["评论管理", [
      ["comments", "已发布 · 选中回复"], ["comments-root", "已发布 · 选中根评论"], ["comments-extreme", "极端文本"],
      ["comments-deleted", "已删除 · 可彻底删除"], ["comments-deleted-children", "已删除 · 仍有回复"],
      ["comments-empty", "空列表"], ["comments-loading", "加载中"], ["comments-error", "加载失败"],
      ["confirm-tombstone", "确认墓碑删除"], ["confirm-permanent", "确认彻底删除"], ["comments-single-site", "只有一个站点"],
      ["comments-mobile-detail", "窄屏 · 详情"],
    ]],
    ["站点管理", [["sites", "编辑站点"], ["sites-create", "新增站点"], ["sites-errors", "校验错误"]]],
    ["通知设置", [
      ["notifications", "两个渠道已开启"], ["notifications-off", "邮件未开启"], ["notifications-test-ok", "测试发送成功"],
      ["notifications-test-fail", "测试发送失败"], ["notifications-errors", "校验错误"],
    ]],
    ["安全", [["security-cap", "Cap"], ["security-turnstile", "Turnstile"], ["security-off", "关闭"], ["security-cap-errors", "Cap 校验错误"]]],
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
      case "comments-root": S.selectedId = 516; break;
      case "comments-extreme": S.selectedId = 513; break;
      case "comments-deleted": S.status = "deleted"; S.selectedId = 487; break;
      case "comments-deleted-children": S.status = "deleted"; S.selectedId = 486; break;
      case "comments-empty": S.status = "deleted"; data["blog.example.com"].deleted = []; data["blog.example.com"].counts.deleted = 0; S.selectedId = null; break;
      case "comments-loading": S.queue = "loading"; S.selectedId = null; break;
      case "comments-error": S.queue = "error"; S.selectedId = null; break;
      case "confirm-tombstone": S.pendingConfirm = "tombstone"; break;
      case "confirm-permanent": S.status = "deleted"; S.selectedId = 487; S.pendingConfirm = "permanent"; break;
      case "comments-single-site": S.sites = S.sites.slice(0, 1); break;
      case "comments-mobile-detail": S.mobileDetail = true; break;
      case "sites": S.view = "sites"; break;
      case "sites-create": S.view = "sites"; S.creating = true; break;
      case "sites-errors": S.view = "sites"; S.siteErrorsPreset = true; break;
      case "notifications": S.view = "notifications"; break;
      case "notifications-off": S.view = "notifications"; S.email.enabled = false; S.emailPersisted = false; break;
      case "notifications-test-ok": S.view = "notifications"; S.emailFeedback = { ok: true, text: "测试邮件已发送" }; break;
      case "notifications-test-fail": S.view = "notifications"; S.emailFeedback = { ok: false, text: "发送失败：SMTP 认证未通过" }; S.telegramFeedback = { ok: false, text: "发送失败：连接 Telegram 超时" }; break;
      case "notifications-errors": S.view = "notifications"; S.email.recipients = ["owner@example.com", "not-an-email"]; S.email.port = 0; S.emailErrors = { port: true }; S.telegram.targets = ["123456789", "@channel"]; break;
      case "security-cap": S.view = "security"; break;
      case "security-turnstile": S.view = "security"; S.captcha.provider = "turnstile"; break;
      case "security-off": S.view = "security"; S.captcha.provider = "off"; break;
      case "security-cap-errors": S.view = "security"; S.captcha.capInstanceUrl = "http://cap.example.com/?key=1"; S.captcha.capSitekey = ""; S.captchaErrors = { capInstanceUrl: true, capSitekey: true }; break;
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
  function renderShell() {
    $("login-screen").hidden = S.authed;
    $("app-shell").hidden = !S.authed;
    if (!S.authed) return renderLogin();
    document.querySelectorAll(".nav-tab").forEach((tab) => {
      if (tab.dataset.viewLink === S.view) tab.setAttribute("aria-current", "page"); else tab.removeAttribute("aria-current");
    });
    ["comments", "sites", "notifications", "security"].forEach((v) => { $(`view-${v}`).hidden = S.view !== v; });
    $("logout-error").hidden = !S.logoutFailed;
    if (S.view === "comments") renderComments();
    if (S.view === "sites") renderSites();
    if (S.view === "notifications") renderNotifications();
    if (S.view === "security") renderSecurity();
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
    const layout = $("view-comments");
    layout.dataset.mobileDetail = String(S.mobileDetail);
    renderSitePicker();
    const counts = data[S.siteId].counts;
    $("count-published").textContent = counts.published;
    $("count-deleted").textContent = counts.deleted;
    document.querySelectorAll(".status-tab").forEach((tab) => tab.setAttribute("aria-selected", String(tab.dataset.status === S.status)));
    $("sort-label").textContent = S.sort === "oldest" ? "最早在前" : "最新在前";
    $("sort-button").setAttribute("aria-label", `排序：${S.sort === "oldest" ? "最早提交在前" : "最新提交在前"}，点击切换`);

    const total = counts[S.status];
    const pageCount = Math.max(1, Math.ceil(total / 20));
    $("pager-total").textContent = S.queue === "ready" ? `共 ${total} 条` : "";
    $("pager-status").textContent = `${S.page} / ${pageCount}`;
    $("pager-prev").disabled = S.page <= 1 || S.queue !== "ready";
    $("pager-next").disabled = S.page >= pageCount || S.queue !== "ready";
    $("refresh-button").disabled = S.queue === "loading";

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
      scroll.innerHTML = items.length
        ? `<ul class="queue-list" role="listbox" aria-label="评论列表">${items.map(queueRow).join("")}</ul>`
        : `<p class="queue-empty">当前没有${S.status === "deleted" ? "已删除" : "已发布"}评论</p>`;
    }
    renderDetail();
  }

  function queueRow(c) {
    const deleted = S.status === "deleted";
    const ref = c.parent ? `回复 #${c.parent}` : `#${c.id}`;
    return `<li class="queue-row" role="none"><button class="queue-item" type="button" role="option" data-comment="${c.id}" aria-selected="${c.id === S.selectedId}">
      <span class="queue-item-line"><span class="queue-author${deleted ? " is-deleted" : ""}" title="${esc(deleted ? "已删除" : c.username)}">${esc(deleted ? "已删除" : c.username)}</span><time class="queue-time">${esc(c.time)}</time></span>
      <span class="queue-summary${deleted ? " is-deleted" : ""}">${deleted ? "该评论已删除" : esc(c.content)}</span>
      <span class="queue-item-line"><span class="queue-path" title="${esc(c.mark)}">${esc(c.mark)}</span><span class="queue-ref">${esc(ref)}</span></span>
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
    const inner = empty ? '<span class="is-empty">—</span>' : opts.href ? `<a href="${esc(opts.href)}" target="_blank" rel="noopener noreferrer">${esc(value)}</a>` : esc(value);
    return `<div class="fact-row"><dt>${label}</dt><dd class="${opts.mono && !empty ? "mono" : ""}" title="${esc(value || "—")}">${inner}</dd></div>`;
  }

  function renderDetail() {
    const pane = $("detail-pane");
    const c = S.queue === "ready" ? selected() : null;
    if (!c) { pane.innerHTML = `<p class="detail-empty">${S.queue === "ready" && list().length ? "从左侧选择一条评论" : ""}</p>`; return; }
    const deleted = S.status === "deleted";
    const link = sourceURL(c);
    let action = "";
    if (!deleted) action = '<button class="button danger-button" type="button" data-action="tombstone">墓碑删除</button>';
    else if (!c.hasChildren) action = '<button class="button danger-button" type="button" data-action="permanent">彻底删除</button>';
    else action = '<span class="hint">仍有回复，不能彻底删除</span>';
    pane.innerHTML = `
      <div class="detail-toolbar">
        <button class="button button-quiet back-button" type="button" data-action="back">${icon("left")}评论列表</button>
        <div class="detail-ref"><span class="badge ${deleted ? "badge-deleted" : "badge-published"}">${deleted ? "已删除" : "已发布"}</span><span>#${c.id}</span><span aria-hidden="true">·</span><span>${c.parent ? `回复 #${c.parent}` : "根评论"}</span></div>
        <div class="detail-actions">
          ${link ? `<a class="button button-quiet source-link" href="${esc(link)}" target="_blank" rel="noopener noreferrer" title="查看原评论 #${c.id}">${icon("external")}<span class="label">查看原评论</span></a>` : ""}
          ${action}
        </div>
      </div>
      ${S.actionMessage ? `<p class="notice notice-error" role="alert">${esc(S.actionMessage)}</p>` : ""}
      <article class="review-sheet" aria-labelledby="comment-detail-title">
        <header class="detail-heading">
          <h2 id="comment-detail-title" class="${deleted ? "is-deleted" : ""}" title="${esc(deleted ? "已删除" : c.username)}">${esc(deleted ? "已删除" : c.username)}</h2>
          <time>${esc(c.time)}</time>
        </header>
        <p class="comment-body${deleted ? " is-deleted-copy" : ""}">${deleted ? "该评论已删除" : esc(c.content)}</p>
        <dl class="detail-facts detail-side" aria-label="评论信息">
          ${fact("私有邮箱", deleted ? "" : c.email, { mono: true })}
          ${fact("访客网站", deleted ? "" : c.url, { mono: true, href: deleted ? "" : c.url })}
          ${fact("文章标题", c.title)}
          ${fact("页面 key", c.mark, { mono: true })}
          ${fact("父评论", c.parent ? `#${c.parent}` : "")}
        </dl>
      </article>`;
  }

  // ---------- confirm ----------
  function openConfirm(kind) {
    const c = selected();
    if (!c) return;
    S.pendingConfirm = kind;
    $("confirm-title").textContent = kind === "tombstone" ? "墓碑删除这条评论？" : "彻底删除这条墓碑？";
    $("confirm-copy").textContent = kind === "tombstone"
      ? "昵称、私有邮箱、网站和正文会被清除，公开页面改为显示“已删除”，下面的回复保留不变。此操作无法撤销。"
      : "这条墓碑会从数据库中移除。此操作无法撤销。";
    $("confirm-target").textContent = kind === "tombstone" ? `#${c.id} · ${c.username} · ${c.content.slice(0, 40)}${c.content.length > 40 ? "…" : ""}` : `#${c.id} · ${c.mark}`;
    $("confirm-ok").textContent = kind === "tombstone" ? "墓碑删除" : "彻底删除";
    const dialog = $("confirm-dialog");
    if (!dialog.open) dialog.showModal();
    $("confirm-cancel").focus();
  }
  function closeConfirm() { S.pendingConfirm = null; const d = $("confirm-dialog"); if (d.open) d.close(); }
  function confirmAction() {
    const kind = S.pendingConfirm; const c = selected();
    closeConfirm();
    if (!c) return;
    const bucket = data[S.siteId];
    if (kind === "tombstone") {
      bucket.published = bucket.published.filter((x) => x.id !== c.id);
      bucket.deleted.unshift({ id: c.id, parent: c.parent, hasChildren: PUBLISHED.some((x) => x.parent === c.id), time: c.time, mark: c.mark, title: c.title });
      bucket.counts.published -= 1; bucket.counts.deleted += 1;
      toast("评论已替换为墓碑。");
    } else {
      bucket.deleted = bucket.deleted.filter((x) => x.id !== c.id);
      bucket.counts.deleted -= 1;
      toast("墓碑已彻底删除。");
    }
    S.selectedId = (pool()[0] || {}).id ?? null;
    S.mobileDetail = false;
    renderComments();
  }

  // ---------- sites ----------
  const siteFields = {
    id: "site-id", siteUrl: "site-url", name: "site-name", placeholder: "site-placeholder", commentLimit: "site-limit",
    emptyMessage: "site-empty", smojiManifestUrl: "smoji-manifest-url", bloggerNickname: "blogger-nickname",
    bloggerEmail: "blogger-email", bloggerBadge: "blogger-badge",
  };
  function renderSites() {
    const current = S.creating ? null : site();
    $("site-list").innerHTML = '<p class="site-list-title">已注册站点</p>' +
      (S.creating ? '<button class="site-list-item is-draft" type="button" aria-current="true"><strong>新站点</strong><small>尚未保存</small></button>' : "") +
      S.sites.map((x) => `<button class="site-list-item" type="button" data-site-edit="${esc(x.id)}" aria-current="${!S.creating && x.id === S.siteId}"><strong>${esc(siteLabel(x))}</strong><small>${esc(x.id)}</small></button>`).join("");
    const src = current || SITE_DEFAULTS;
    $("site-form-title").textContent = S.creating ? "新增站点" : "编辑站点";
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
    $("site-cancel").hidden = !S.creating;
    $("site-submit").textContent = S.creating ? "创建站点" : "保存站点";
    $("new-site-button").disabled = S.creating;
    if (S.siteErrorsPreset) {
      S.siteErrorsPreset = false;
      $("site-url").value = "blog.example.com";
      $("site-origins").value = "https://blog.example.com/posts/\nhttps://blog.example.com";
      $("blogger-email").value = "";
      showSiteErrors({ siteUrl: true, origins: true, bloggerIdentity: true });
    } else showSiteErrors({});
    $("site-message").hidden = !S.siteMessage;
    $("site-message").textContent = S.siteMessage;
  }
  const errorInputs = { id: ["site-id"], siteUrl: ["site-url"], name: ["site-name"], origins: ["site-origins"], placeholder: ["site-placeholder"], commentLimit: ["site-limit"], emptyMessage: ["site-empty"], smojiManifestUrl: ["smoji-manifest-url"], bloggerNickname: ["blogger-nickname"], bloggerEmail: ["blogger-email"], bloggerIdentity: ["blogger-nickname", "blogger-email"], bloggerPassphrase: ["blogger-passphrase"], bloggerBadge: ["blogger-badge"] };
  function showSiteErrors(errors) {
    const form = $("site-form");
    form.querySelectorAll("[data-error]").forEach((p) => { p.hidden = !errors[p.dataset.error]; });
    form.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
    Object.keys(errors).forEach((k) => (errorInputs[k] || []).forEach((id) => $(id).setAttribute("aria-invalid", "true")));
    const n = Object.keys(errors).length;
    const summary = $("site-form-summary");
    summary.textContent = n ? `有 ${n} 处需要修改` : "";
    summary.classList.toggle("is-error", n > 0);
    if (n) { const first = form.querySelector('[aria-invalid="true"]'); if (first && S.focusErrors) first.focus(); }
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

  // ---------- notifications ----------
  const validEmail = (x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x) && x.length <= 254;
  const validTarget = (x) => /^-?\d{1,32}$/.test(x);
  function renderChips(containerId, values, kind, disabled) {
    const box = $(containerId);
    const valid = kind === "email" ? validEmail : validTarget;
    const invalid = values.some((x) => !valid(x));
    box.setAttribute("aria-invalid", String(invalid));
    box.setAttribute("aria-disabled", String(disabled));
    box.innerHTML = values.map((x, i) => `<span class="chip${valid(x) ? "" : " is-invalid"}"><span class="chip-text" title="${esc(x)}">${esc(x)}</span><button class="chip-remove" type="button" data-chip="${i}" aria-label="移除 ${esc(x)}">×</button></span>`).join("") +
      `<input id="${containerId}-input" type="text" autocomplete="off" aria-label="${kind === "email" ? "通知收件人" : "接收目标 ID"}" ${disabled ? "disabled" : ""}>`;
    let err = box.parentElement.querySelector(".chip-error");
    if (!err) { err = document.createElement("p"); err.className = "field-error chip-error"; box.after(err); }
    err.textContent = kind === "email" ? "邮箱格式错误" : "接收目标 ID 格式错误";
    err.hidden = !invalid;
  }
  function feedbackHTML(f) { return f ? `${icon(f.ok ? "check" : "alert")}<span>${esc(f.text)}</span>` : ""; }
  function renderChannel(key) {
    const c = S[key];
    $(`${key}-enabled`).checked = c.enabled;
    document.querySelector(`[data-state-for="${key}-enabled"]`).textContent = c.enabled ? "已开启" : "未开启";
    $(`${key}-body`).hidden = !c.enabled;
    $(`${key}-off`).hidden = c.enabled;
    $(`${key}-test`).hidden = !c.enabled;
    $(`${key}-save`).disabled = !c.enabled && c.enabled === S[`${key}Persisted`];
    const fb = $(`${key}-feedback`);
    const f = c.enabled ? S[`${key}Feedback`] : (S[`${key}Persisted`] ? { ok: false, text: "关闭后需保存才会生效" } : null);
    fb.className = "test-feedback" + (f ? (f.ok ? " is-success" : " is-failure") : "");
    fb.innerHTML = f && !c.enabled ? `<span>${esc(f.text)}</span>` : feedbackHTML(f);
    if (!c.enabled && f) fb.className = "test-feedback";
  }
  function renderNotifications() {
    const e = S.email;
    $("email-server").value = e.host; $("email-port").value = e.port || ""; $("email-user").value = e.username; $("email-sender").value = e.fromAddress;
    document.querySelectorAll('input[name="email-encryption"]').forEach((r) => { r.checked = r.value === e.encryption; });
    $("email-port").placeholder = e.encryption === "starttls" ? "587" : "465";
    $("email-password").placeholder = e.passwordSet ? "已设置，输入新值以更换" : "";
    renderChips("email-recipients", e.recipients, "email", !e.enabled);
    $("email-card").querySelectorAll("[data-error]").forEach((p) => { p.hidden = !S.emailErrors[p.dataset.error]; });
    $("email-port").setAttribute("aria-invalid", String(Boolean(S.emailErrors.port)));
    $("email-server").setAttribute("aria-invalid", String(Boolean(S.emailErrors.host)));
    renderChannel("email");
    $("telegram-token").placeholder = S.telegram.tokenSet ? "已设置，输入新值以更换" : "";
    renderChips("telegram-targets", S.telegram.targets, "telegram", !S.telegram.enabled);
    $("telegram-card").querySelectorAll("[data-error]").forEach((p) => { p.hidden = !S.telegramErrors[p.dataset.error]; });
    renderChannel("telegram");
  }
  function addChips(key, field, raw) {
    const next = raw.split(/[，,\n]+/).map((x) => x.trim()).filter(Boolean);
    if (!next.length) return;
    S[key][field] = [...new Set([...S[key][field], ...next])];
    renderNotifications();
    $(`${key === "email" ? "email-recipients" : "telegram-targets"}-input`).focus();
  }

  // ---------- security ----------
  function renderSecurity() {
    const p = S.captcha.provider;
    document.querySelectorAll('input[name="captcha-provider"]').forEach((r) => { r.checked = r.value === p; });
    $("panel-off").hidden = p !== "off"; $("panel-turnstile").hidden = p !== "turnstile"; $("panel-cap").hidden = p !== "cap";
    $("turnstile-sitekey").value = S.captcha.turnstileSitekey;
    $("cap-instance-url").value = S.captcha.capInstanceUrl;
    $("cap-sitekey").value = S.captcha.capSitekey;
    $("view-security").querySelectorAll("[data-error]").forEach((el) => { el.hidden = !S.captchaErrors[el.dataset.error]; });
    ["cap-instance-url", "cap-sitekey", "cap-secret", "turnstile-sitekey", "turnstile-secret"].forEach((id) => $(id).removeAttribute("aria-invalid"));
    if (S.captchaErrors.capInstanceUrl) $("cap-instance-url").setAttribute("aria-invalid", "true");
    if (S.captchaErrors.capSitekey) $("cap-sitekey").setAttribute("aria-invalid", "true");
    if (S.captchaErrors.turnstileSitekey) $("turnstile-sitekey").setAttribute("aria-invalid", "true");
  }

  // ---------- events ----------
  function go(view) { S.view = view; S.siteMenuOpen = false; S.mobileDetail = false; renderShell(); }

  document.addEventListener("click", (event) => {
    const t = event.target.closest("button, a");
    if (S.siteMenuOpen && !event.target.closest("#site-picker")) { S.siteMenuOpen = false; renderSitePicker(); }
    if (!t) return;
    if (t.dataset.viewLink) return go(t.dataset.viewLink);
    if (t.id === "site-trigger") { S.siteMenuOpen = !S.siteMenuOpen; renderSitePicker(); if (S.siteMenuOpen) document.querySelector('.site-option[aria-selected="true"]')?.focus(); return; }
    if (t.dataset.site) { S.siteId = t.dataset.site; S.siteMenuOpen = false; S.status = "published"; S.page = 1; S.selectedId = (pool()[0] || {}).id ?? null; renderComments(); $("site-trigger")?.focus(); return; }
    if (t.dataset.status) { S.status = t.dataset.status; S.page = 1; S.selectedId = (list()[0] || {}).id ?? null; S.mobileDetail = false; return renderComments(); }
    if (t.dataset.comment) { S.selectedId = Number(t.dataset.comment); S.mobileDetail = true; return renderComments(); }
    if (t.id === "sort-button") { S.sort = S.sort === "newest" ? "oldest" : "newest"; S.page = 1; S.selectedId = (list()[0] || {}).id ?? null; return renderComments(); }
    if (t.id === "refresh-button" || t.dataset.action === "retry") {
      S.queue = "loading"; renderComments();
      setTimeout(() => { S.queue = "ready"; if (!selected()) S.selectedId = (list()[0] || {}).id ?? null; renderComments(); toast("评论列表已刷新。"); }, 700);
      return;
    }
    if (t.id === "pager-prev" && S.page > 1) { S.page -= 1; return renderComments(); }
    if (t.id === "pager-next") { S.page += 1; return renderComments(); }
    if (t.dataset.action === "back") { S.mobileDetail = false; renderComments(); document.querySelector('.queue-item[aria-selected="true"]')?.focus(); return; }
    if (t.dataset.action === "tombstone" || t.dataset.action === "permanent") return openConfirm(t.dataset.action);
    if (t.id === "confirm-cancel") return closeConfirm();
    if (t.id === "confirm-ok") return confirmAction();
    if (t.id === "logout-button") { if (S.logoutFailed) { S.logoutFailed = false; renderShell(); return; } S.authed = false; S.loginMessage = ""; return renderShell(); }
    if (t.id === "new-site-button") { S.creating = true; renderSites(); $("site-id").focus(); return; }
    if (t.id === "site-cancel") { S.creating = false; return renderSites(); }
    if (t.dataset.siteEdit) { S.creating = false; S.siteId = t.dataset.siteEdit; return renderSites(); }
    if (t.dataset.chip) {
      const box = t.closest(".chip-field"); const key = box.dataset.kind === "email" ? "email" : "telegram"; const field = key === "email" ? "recipients" : "targets";
      S[key][field] = S[key][field].filter((_, i) => i !== Number(t.dataset.chip)); return renderNotifications();
    }
    if (t.id === "email-test") { S.emailFeedback = { ok: true, text: "测试邮件已发送" }; return renderNotifications(); }
    if (t.id === "telegram-test") { S.telegramFeedback = { ok: true, text: "测试消息已发送" }; return renderNotifications(); }
    if (t.id === "email-save") {
      if (S.email.enabled && S.email.recipients.some((x) => !validEmail(x))) return;
      S.emailPersisted = S.email.enabled; S.emailFeedback = null; renderNotifications(); return toast("电子邮件通知已保存。");
    }
    if (t.id === "telegram-save") {
      if (S.telegram.enabled && S.telegram.targets.some((x) => !validTarget(x))) return;
      S.telegramPersisted = S.telegram.enabled; S.telegramFeedback = null; renderNotifications(); return toast("Telegram 通知已保存。");
    }
    if (t.id === "captcha-save") {
      const e = {};
      S.captcha.capInstanceUrl = $("cap-instance-url").value.trim().replace(/\/+$/, "");
      S.captcha.capSitekey = $("cap-sitekey").value.trim();
      S.captcha.turnstileSitekey = $("turnstile-sitekey").value.trim();
      if (S.captcha.provider === "cap") {
        try { const u = new URL(S.captcha.capInstanceUrl); if (u.protocol !== "https:" || u.search || u.hash) throw 0; } catch { e.capInstanceUrl = true; }
        if (!S.captcha.capSitekey) e.capSitekey = true;
      }
      if (S.captcha.provider === "turnstile" && !S.captcha.turnstileSitekey) e.turnstileSitekey = true;
      S.captchaErrors = e; renderSecurity();
      if (!Object.keys(e).length) toast("验证设置已保存。");
      return;
    }
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
    if (t.id === "email-enabled" || t.id === "telegram-enabled") { const key = t.id.split("-")[0]; S[key].enabled = t.checked; S[`${key}Feedback`] = null; return renderNotifications(); }
    if (t.name === "email-encryption") { S.email.encryption = t.value; return renderNotifications(); }
    if (t.name === "captcha-provider") { S.captcha.provider = t.value; S.captchaErrors = {}; return renderSecurity(); }
  });

  document.addEventListener("input", (event) => {
    if (event.target.id === "login-username" || event.target.id === "login-password") updateLoginButton();
  });

  document.addEventListener("keydown", (event) => {
    const t = event.target;
    if (t.closest && t.closest(".chip-field") && t.tagName === "INPUT") {
      const box = t.closest(".chip-field"); const key = box.dataset.kind === "email" ? "email" : "telegram"; const field = key === "email" ? "recipients" : "targets";
      if (["Enter", ",", "，"].includes(event.key)) { event.preventDefault(); addChips(key, field, t.value); }
      else if (event.key === "Backspace" && !t.value && S[key][field].length) { S[key][field] = S[key][field].slice(0, -1); renderNotifications(); $(`${box.id}-input`).focus(); }
      return;
    }
    if (t.closest && t.closest("#site-menu")) {
      const opts = [...document.querySelectorAll(".site-option")];
      const i = opts.indexOf(document.activeElement);
      if (event.key === "Escape") { event.preventDefault(); S.siteMenuOpen = false; renderSitePicker(); $("site-trigger").focus(); }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); opts[(i + (event.key === "ArrowDown" ? 1 : -1) + opts.length) % opts.length].focus(); }
      return;
    }
    if (t.classList && t.classList.contains("queue-item") && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      const items = [...document.querySelectorAll(".queue-item")];
      const next = items[items.indexOf(t) + (event.key === "ArrowDown" ? 1 : -1)];
      if (next) { S.selectedId = Number(next.dataset.comment); renderComments(); document.querySelector(`.queue-item[data-comment="${S.selectedId}"]`)?.focus(); }
    }
  });

  document.addEventListener("paste", (event) => {
    const t = event.target;
    if (!(t.closest && t.closest(".chip-field"))) return;
    const text = event.clipboardData?.getData("text") ?? "";
    if (!/[，,\n]/.test(text)) return;
    event.preventDefault();
    const box = t.closest(".chip-field"); const key = box.dataset.kind === "email" ? "email" : "telegram";
    addChips(key, key === "email" ? "recipients" : "targets", text);
  });

  document.addEventListener("focusout", (event) => {
    const t = event.target;
    if (t.closest && t.closest(".chip-field") && t.tagName === "INPUT" && t.value.trim()) {
      const box = t.closest(".chip-field"); const key = box.dataset.kind === "email" ? "email" : "telegram";
      const value = t.value; t.value = "";
      setTimeout(() => addChips(key, key === "email" ? "recipients" : "targets", value));
    }
  });

  $("site-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const errors = validateSite();
    S.focusErrors = true; showSiteErrors(errors); S.focusErrors = false;
    if (Object.keys(errors).length) return;
    const wasCreating = S.creating;
    if (wasCreating) {
      const id = $("site-id").value.trim();
      S.sites.push({ ...SITE_DEFAULTS, id, siteUrl: $("site-url").value.trim(), name: $("site-name").value.trim(), allowedOrigins: $("site-origins").value.split(/\n+/).filter(Boolean) });
      data[id] = { published: [], deleted: [], counts: { published: 0, deleted: 0 } };
      S.siteId = id; S.creating = false;
    }
    renderSites();
    toast(wasCreating ? "站点已创建。" : "站点设置已保存。");
  });

  $("login-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (S.login === "cap" && S.capState !== "done") { S.loginMessage = "请完成验证后再登录。"; renderLogin(); $("cap-trigger").focus(); return; }
    $("login-password").value = ""; $("login-username").value = "";
    S.authed = true; S.loginMessage = ""; S.view = "comments"; renderShell();
  });

  $("confirm-dialog").addEventListener("close", () => { S.pendingConfirm = null; });
  $("confirm-dialog").addEventListener("click", (event) => { if (event.target === event.currentTarget) closeConfirm(); });

  // ---------- prototype controller ----------
  const select = $("scenario-select");
  select.innerHTML = SCENARIOS.map(([label, items]) => `<optgroup label="${label}">${items.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</optgroup>`).join("");
  select.addEventListener("change", () => { window.location.hash = select.value; });
  $("theme-select").addEventListener("change", (e) => { document.documentElement.dataset.theme = e.target.value; });

  function boot() {
    const name = window.location.hash.slice(1) || "comments";
    select.value = name;
    const d = $("confirm-dialog"); if (d.open) d.close();
    applyScenario(name);
    renderShell();
    if (S.pendingConfirm) openConfirm(S.pendingConfirm);
    if (S.toastOnLoad) toast(S.toastOnLoad);
  }
  window.addEventListener("hashchange", boot);
  boot();
})();
