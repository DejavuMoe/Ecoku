(() => {
  "use strict";

  const fixtures = window.EcokuCommentFixtures;
  if (!fixtures) throw new Error("Comment fixtures failed to load.");

  const elements = {
    root: document.documentElement,
    controls: document.querySelector(".preview-controls"),
    themeToggle: document.getElementById("theme-toggle"),
    serviceToggle: document.getElementById("service-toggle"),
    emptyToggle: document.getElementById("empty-toggle"),
    configToggle: document.getElementById("form-config-toggle"),
    configPanel: document.getElementById("form-config-panel"),
    configEmailRequired: document.getElementById("config-email-required"),
    configWebsiteRequired: document.getElementById("config-website-required"),
    configPlaceholder: document.getElementById("config-placeholder"),
    configCommentLimit: document.getElementById("config-comment-limit"),
    configEmptyMessage: document.getElementById("config-empty-message"),
    configTimezone: document.getElementById("config-timezone"),
    configBloggerNickname: document.getElementById("config-blogger-nickname"),
    configBloggerBadge: document.getElementById("config-blogger-badge"),
    configTurnstileEnabled: document.getElementById("config-turnstile-enabled"),
    configTurnstileInteract: document.getElementById("config-turnstile-interact"),
    configTurnstileCleared: document.getElementById("config-turnstile-cleared"),
    retryButton: document.getElementById("retry-button"),
    serviceError: document.getElementById("service-error"),
    commentCore: document.getElementById("comment-core"),
    commentForm: document.getElementById("comment-form"),
    nickname: document.getElementById("nickname"),
    email: document.getElementById("email"),
    website: document.getElementById("website"),
    commentInput: document.getElementById("comment-input"),
    characterCount: document.getElementById("character-count"),
    submitButton: document.getElementById("submit-button"),
    formError: document.getElementById("form-error"),
    statusLine: document.getElementById("status-line"),
    emptyCommentsText: document.getElementById("empty-comments-text"),
    threadList: document.getElementById("thread-list"),
    commentCount: document.getElementById("comment-count"),
    sortPicker: document.getElementById("sort-picker"),
    sortTrigger: document.getElementById("sort-trigger"),
    sortTriggerLabel: document.getElementById("sort-trigger-label"),
    sortMenu: document.getElementById("sort-menu"),
    replyTemplate: document.getElementById("reply-template"),
    pagination: document.getElementById("comment-pagination"),
    previousPage: document.getElementById("previous-page"),
    nextPage: document.getElementById("next-page"),
    paginationStatus: document.getElementById("pagination-status")
  };

  const state = {
    comments: fixtures.comments
      .filter((comment) => comment.status === "approved")
      .map((comment) => ({ ...comment })),
    sort: "newest",
    currentPage: 1,
    collapsed: new Set(),
    openReplyId: null,
    loading: false,
    emptyPreview: false,
    nextId: Math.max(...fixtures.comments.map((comment) => comment.id)) + 1
  };

  const DEFAULT_PLACEHOLDER = "写下评论（仅支持纯文本）";
  const DEFAULT_EMPTY_MESSAGE = "还没有评论\n成为第一个留下评论的人。";
  const DEFAULT_TIME_ZONE = "Asia/Singapore";
  const DEFAULT_BLOGGER_NICKNAME = "Dejavu Moe";
  const DEFAULT_BLOGGER_BADGE = "[博主]";
  const codePointLength = (value) => Array.from(value).length;
  const clampCommentLimit = (value) => Math.min(10000, Math.max(1, Number.parseInt(value, 10) || 1000));

  const resolvedTimeZone = (value) => {
    const timeZone = (value || "").trim() || DEFAULT_TIME_ZONE;
    try {
      new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
      return timeZone;
    } catch {
      return DEFAULT_TIME_ZONE;
    }
  };

  const utcOffsetLabel = (timeZone, date = new Date()) => {
    const name = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset"
    }).formatToParts(date).find((part) => part.type === "timeZoneName")?.value || "UTC";
    return name.replace(/^GMT/, "UTC");
  };

  const timezoneTitle = (timeZone) => `${timeZone} ${utcOffsetLabel(timeZone)}`;

  const settings = () => ({
    emailRequired: elements.configEmailRequired.checked,
    websiteRequired: elements.configWebsiteRequired.checked,
    placeholder: elements.configPlaceholder.value.trim() || DEFAULT_PLACEHOLDER,
    commentLimit: clampCommentLimit(elements.configCommentLimit.value),
    emptyMessage: elements.configEmptyMessage.value.trim() || DEFAULT_EMPTY_MESSAGE,
    timeZone: resolvedTimeZone(elements.configTimezone?.value),
    bloggerNickname: (elements.configBloggerNickname?.value || DEFAULT_BLOGGER_NICKNAME).trim(),
    bloggerBadge: (elements.configBloggerBadge?.value || "").trim(),
    turnstileEnabled: Boolean(elements.configTurnstileEnabled?.checked),
    turnstileNeedInteraction: Boolean(elements.configTurnstileInteract?.checked),
    turnstileCleared: Boolean(elements.configTurnstileCleared?.checked)
  });

  const createElement = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  const turnstileTimers = new WeakMap();

  const setTurnstileState = (slot, next) => {
    slot.dataset.state = next;
    const check = slot.querySelector(".turnstile-check");
    const label = slot.querySelector(".turnstile-label");
    if (!check || !label) return;
    check.replaceChildren();
    if (next === "success") {
      check.setAttribute("aria-pressed", "true");
      check.dataset.busy = "false";
      check.textContent = "✓";
      label.textContent = "已验证";
      return;
    }
    check.setAttribute("aria-pressed", "false");
    if (next === "loading") {
      check.dataset.busy = "true";
      const spinner = createElement("span", "turnstile-spinner");
      spinner.setAttribute("aria-hidden", "true");
      check.appendChild(spinner);
      label.textContent = "正在验证…";
      return;
    }
    check.dataset.busy = "false";
    label.textContent = next === "error" ? "验证失败，请重试" : "确认您是真人";
  };

  const mountTurnstile = (slot) => {
    const config = settings();
    const previous = turnstileTimers.get(slot);
    if (previous) window.clearTimeout(previous);
    slot.dataset.cleared = config.turnstileCleared ? "true" : "false";
    if (!config.turnstileEnabled || config.turnstileCleared) {
      slot.hidden = true;
      slot.dataset.kind = config.turnstileCleared ? "cleared" : "off";
      slot.dataset.state = config.turnstileCleared ? "success" : "idle";
      slot.replaceChildren();
      return;
    }
    slot.hidden = false;
    slot.dataset.kind = config.turnstileNeedInteraction ? "interact" : "auto";
    slot.replaceChildren();

    const widget = createElement("div", "turnstile-widget");
    widget.setAttribute("role", "group");
    widget.setAttribute("aria-label", "Cloudflare Turnstile");
    const check = createElement("button", "turnstile-check");
    check.type = "button";
    check.setAttribute("aria-label", "确认您是真人");
    const label = createElement("span", "turnstile-label", "确认您是真人");
    const brand = createElement("span", "turnstile-brand", "Turnstile");
    brand.setAttribute("aria-hidden", "true");
    widget.append(check, label, brand);
    slot.appendChild(widget);

    if (config.turnstileNeedInteraction) {
      setTurnstileState(slot, "idle");
      check.addEventListener("click", () => setTurnstileState(slot, "success"));
      return;
    }

    setTurnstileState(slot, "loading");
    const timer = window.setTimeout(() => setTurnstileState(slot, "success"), 800);
    turnstileTimers.set(slot, timer);
  };

  const refreshTurnstileSlots = (force = false) => {
    const config = settings();
    const expected = !config.turnstileEnabled
      ? "off"
      : config.turnstileCleared
        ? "cleared"
        : config.turnstileNeedInteraction
          ? "interact"
          : "auto";
    document.querySelectorAll(".turnstile-slot").forEach((slot) => {
      if (!force && slot.dataset.mounted === "true" && slot.dataset.kind === expected) return;
      slot.dataset.mounted = "true";
      mountTurnstile(slot);
    });
  };

  const turnstileReady = (form) => {
    const config = settings();
    if (!config.turnstileEnabled || config.turnstileCleared) return true;
    const slot = form.querySelector(".turnstile-slot");
    return slot?.dataset.state === "success";
  };

  const safeWebsite = (value) => {
    if (!value) return null;
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
    } catch (_) {
      return null;
    }
  };

  const setStatus = (message) => {
    elements.statusLine.textContent = message;
  };

  const commentById = (id) => state.comments.find((comment) => comment.id === id) ?? null;

  const directChildren = (id) => state.comments
    .filter((comment) => comment.parentId === id)
    .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt));

  const descendantCount = (id) => {
    let count = 0;
    const visit = (parentId) => {
      directChildren(parentId).forEach((child) => {
        count += 1;
        visit(child.id);
      });
    };
    visit(id);
    return count;
  };

  const flattenRoot = (root) => {
    const flattened = [];
    const visit = (comment) => {
      flattened.push(comment);
      directChildren(comment.id).forEach(visit);
    };
    visit(root);
    return flattened;
  };

  const orderedRoots = () => state.comments
    .filter((comment) => comment.parentId === null)
    .sort((left, right) => {
      const difference = new Date(left.createdAt) - new Date(right.createdAt);
      return state.sort === "oldest" ? difference : -difference;
    });

  const isHiddenByCollapsedAncestor = (comment) => {
    let parentId = comment.parentId;
    const visited = new Set();
    while (parentId !== null) {
      if (visited.has(parentId)) return true;
      visited.add(parentId);
      if (state.collapsed.has(parentId)) return true;
      parentId = commentById(parentId)?.parentId ?? null;
    }
    return false;
  };

  const displayTime = (createdAt) => {
    const parts = new Intl.DateTimeFormat("zh-CN", {
      timeZone: settings().timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date(createdAt));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}`;
  };

  const isBloggerComment = (comment) => {
    const nickname = settings().bloggerNickname;
    return Boolean(nickname) && !comment.deleted && comment.author === nickname;
  };

  const makeAuthor = (comment) => {
    const website = safeWebsite(comment.website);
    let author;
    if (!website || comment.deleted) {
      author = createElement("span", "comment-author", comment.author);
    } else {
      author = createElement("a", "comment-author", comment.author);
      author.href = website;
      author.target = "_blank";
      author.rel = "nofollow ugc noopener noreferrer";
      author.referrerPolicy = "no-referrer";
    }

    const badgeText = settings().bloggerBadge;
    if (!isBloggerComment(comment) || !badgeText) return author;

    const wrap = createElement("span", "comment-author-wrap");
    wrap.appendChild(author);
    const badge = createElement("span", "blogger-badge", badgeText);
    badge.title = "博主";
    wrap.appendChild(badge);
    return wrap;
  };

  const makeReplyComposer = (comment) => {
    const fragment = elements.replyTemplate.content.cloneNode(true);
    const form = fragment.querySelector("form");
    const textarea = fragment.querySelector("textarea");
    const authorLabel = fragment.querySelector("[data-reply-author]");
    if (authorLabel) authorLabel.textContent = comment.author;

    fragment.querySelector(".cancel-reply").addEventListener("click", () => {
      state.openReplyId = null;
      render();
      document.querySelector(`[data-comment-id="${comment.id}"] .reply-action`)?.focus();
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const body = textarea.value.trim();
      if (!body || codePointLength(body) > settings().commentLimit) {
        textarea.focus();
        return;
      }

      const newComment = {
        id: state.nextId,
        siteId: comment.siteId,
        mark: comment.mark,
        parentId: comment.id,
        rootId: comment.rootId,
        depth: comment.depth + 1,
        status: "approved",
        author: elements.nickname.value.trim() || "Dejavu Moe",
        privateEmail: elements.email.value.trim(),
        website: safeWebsite(elements.website.value.trim()),
        body,
        deleted: false,
        createdAt: new Date().toISOString()
      };
      state.nextId += 1;
      state.comments.push(newComment);
      state.openReplyId = null;
      render();
      setStatus("回复已加入讨论，内容按纯文本显示。");
      document.getElementById(`comment-${newComment.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    window.setTimeout(() => textarea.focus(), 0);
    return fragment;
  };

  const makeCommentNode = (comment) => {
    const article = createElement("article", `comment-node${comment.deleted ? " deleted" : ""}`);
    article.dataset.commentId = String(comment.id);
    article.dataset.parentId = comment.parentId === null ? "" : String(comment.parentId);
    article.dataset.rootId = String(comment.rootId);
    article.dataset.depth = String(comment.depth);
    article.id = `comment-${comment.id}`;
    article.setAttribute("aria-label", `第 ${comment.depth} 级评论，${comment.author}`);

    if (isHiddenByCollapsedAncestor(comment)) article.hidden = true;

    const row = createElement("div", "comment-row");
    const meta = createElement("header", "comment-meta");
    const metaMain = createElement("div", "comment-meta-main");
    const replies = descendantCount(comment.id);
    const collapsed = state.collapsed.has(comment.id);
    const zoneTitle = timezoneTitle(settings().timeZone);

    metaMain.appendChild(makeAuthor(comment));

    const timeLabel = displayTime(comment.createdAt);
    const time = createElement("a", "comment-time", timeLabel);
    time.href = `#comment-${comment.id}`;
    time.title = zoneTitle;
    time.setAttribute("aria-label", `${timeLabel}, ${zoneTitle}`);
    metaMain.appendChild(time);

    if (replies > 0) {
      const collapse = createElement("button", "collapse-button", collapsed ? "[+]" : "[-]");
      collapse.type = "button";
      collapse.title = collapsed ? "展开这条讨论" : "折叠这条讨论";
      collapse.setAttribute("aria-label", collapse.title);
      collapse.setAttribute("aria-expanded", String(!collapsed));
      collapse.addEventListener("click", () => {
        if (state.collapsed.has(comment.id)) state.collapsed.delete(comment.id);
        else state.collapsed.add(comment.id);
        render();
        document.querySelector(`[data-comment-id="${comment.id}"] .collapse-button`)?.focus();
      });
      metaMain.appendChild(collapse);
    }

    if (collapsed) {
      metaMain.appendChild(createElement("span", "folded-summary", `已折叠 ${replies} 条回复`));
    } else {
      if (comment.depth >= 4 && comment.parentId !== null) {
        const parent = commentById(comment.parentId);
        metaMain.appendChild(createElement("span", "reply-context", `@${parent?.author ?? "上级评论"}`));
      }

      if (!comment.deleted) {
        const replyButton = createElement("button", "text-action reply-action", "回复");
        replyButton.type = "button";
        replyButton.addEventListener("click", () => {
          state.openReplyId = comment.id;
          render();
        });
        metaMain.appendChild(replyButton);
      }
    }

    meta.appendChild(metaMain);

    row.appendChild(meta);

    const content = createElement("div", "collapsible-content");
    content.hidden = collapsed;
    const copy = createElement("div", "comment-copy");
    copy.appendChild(createElement("p", "", comment.deleted ? "[该评论已删除]" : comment.body));
    content.appendChild(copy);

    if (!comment.deleted) {
      const replySlot = createElement("div", "reply-slot");
      if (state.openReplyId === comment.id) replySlot.appendChild(makeReplyComposer(comment));
      content.appendChild(replySlot);
    }

    row.appendChild(content);
    article.appendChild(row);
    return article;
  };

  const pageCountFor = (roots) => Math.max(1, Math.ceil(roots.length / fixtures.pageSize));

  const updatePagination = (roots) => {
    const pageCount = pageCountFor(roots);
    state.currentPage = Math.min(pageCount, Math.max(1, state.currentPage));
    elements.pagination.hidden = roots.length === 0 || pageCount === 1;
    elements.paginationStatus.textContent = `${state.currentPage}/${pageCount}`;
    elements.previousPage.disabled = state.loading || state.currentPage === 1;
    elements.nextPage.disabled = state.loading || state.currentPage === pageCount;
  };

  function render() {
    if (state.emptyPreview) {
      elements.threadList.hidden = true;
      elements.threadList.replaceChildren();
      elements.threadList.dataset.totalComments = "0";
      elements.threadList.dataset.totalRoots = "0";
      elements.threadList.dataset.maxDepth = "0";
      elements.threadList.dataset.visibleRoots = "0";
      elements.commentCount.textContent = "0 条评论";
      elements.emptyCommentsText.textContent = settings().emptyMessage;
      elements.emptyCommentsText.hidden = false;
      elements.pagination.hidden = true;
      return;
    }

    elements.emptyCommentsText.hidden = true;
    elements.threadList.hidden = false;
    const roots = orderedRoots();
    const pageCount = pageCountFor(roots);
    state.currentPage = Math.min(pageCount, Math.max(1, state.currentPage));
    const pageStart = (state.currentPage - 1) * fixtures.pageSize;
    const visibleRoots = roots.slice(pageStart, pageStart + fixtures.pageSize);
    const fragment = document.createDocumentFragment();

    visibleRoots.forEach((root) => {
      const group = createElement("div", "root-thread");
      group.dataset.rootId = String(root.id);
      group.setAttribute("role", "group");
      group.setAttribute("aria-label", `${root.author} 发起的讨论`);
      flattenRoot(root).forEach((comment) => group.appendChild(makeCommentNode(comment)));
      fragment.appendChild(group);
    });

    elements.threadList.replaceChildren(fragment);
    elements.threadList.dataset.totalComments = String(state.comments.length);
    elements.threadList.dataset.totalRoots = String(roots.length);
    elements.threadList.dataset.maxDepth = String(Math.max(...state.comments.map((comment) => comment.depth)));
    elements.threadList.dataset.visibleRoots = String(visibleRoots.length);
    elements.commentCount.textContent = `${state.comments.length} 条评论`;
    updatePagination(roots);
  }

  const toggleSortMenu = (open) => {
    elements.sortMenu.hidden = !open;
    elements.sortTrigger.setAttribute("aria-expanded", String(open));
    if (open) {
      const selected = elements.sortMenu.querySelector('[aria-selected="true"]');
      window.setTimeout(() => selected?.focus(), 0);
    }
  };

  const chooseSort = (value) => {
    if (value !== "oldest" && value !== "newest") return;
    state.sort = value;
    state.currentPage = 1;
    elements.sortTriggerLabel.textContent = value === "oldest" ? "最早评论" : "最新评论";
    elements.sortTrigger.setAttribute("aria-label", `评论排序：${elements.sortTriggerLabel.textContent}`);
    elements.sortMenu.querySelectorAll("[data-sort]").forEach((option) => {
      option.setAttribute("aria-selected", String(option.dataset.sort === value));
    });
    toggleSortMenu(false);
    render();
    setStatus("");
    elements.sortTrigger.focus();
  };

  elements.sortTrigger.addEventListener("click", () => toggleSortMenu(elements.sortMenu.hidden));
  elements.sortTrigger.addEventListener("keydown", (event) => {
    if (["ArrowDown", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      toggleSortMenu(true);
    }
  });
  elements.sortMenu.addEventListener("click", (event) => {
    const option = event.target.closest("[data-sort]");
    if (option) chooseSort(option.dataset.sort);
  });
  elements.sortMenu.addEventListener("keydown", (event) => {
    const options = Array.from(elements.sortMenu.querySelectorAll("[data-sort]"));
    const currentIndex = options.indexOf(document.activeElement);
    if (["Enter", " "].includes(event.key)) {
      const option = event.target.closest("[data-sort]");
      if (option) {
        event.preventDefault();
        chooseSort(option.dataset.sort);
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      toggleSortMenu(false);
      elements.sortTrigger.focus();
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const nextIndex = event.key === "Home"
        ? 0
        : event.key === "End"
          ? options.length - 1
          : (currentIndex + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
      options[nextIndex]?.focus();
    }
  });
  document.addEventListener("click", (event) => {
    if (!elements.sortPicker.contains(event.target)) toggleSortMenu(false);
  });

  const updateThemeButton = () => {
    const dark = elements.root.dataset.theme === "dark";
    elements.themeToggle.textContent = dark ? "切换浅色" : "切换深色";
    elements.themeToggle.setAttribute("aria-pressed", String(dark));
  };

  elements.themeToggle.addEventListener("click", () => {
    elements.root.dataset.theme = elements.root.dataset.theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem("plain-thread-theme", elements.root.dataset.theme);
    } catch (_) {
      // The prototype remains functional when storage is unavailable.
    }
    updateThemeButton();
  });

  try {
    const storedTheme = localStorage.getItem("plain-thread-theme");
    if (storedTheme === "dark" || storedTheme === "light") elements.root.dataset.theme = storedTheme;
  } catch (_) {
    // Use the document default.
  }
  updateThemeButton();

  const setServiceError = (failed) => {
    elements.serviceError.hidden = !failed;
    elements.commentCore.hidden = failed;
    elements.serviceToggle.setAttribute("aria-pressed", String(failed));
    elements.serviceToggle.textContent = failed ? "恢复正常" : "模拟故障";
  };

  elements.serviceToggle.addEventListener("click", () => {
    setServiceError(elements.serviceToggle.getAttribute("aria-pressed") !== "true");
  });

  elements.emptyToggle.addEventListener("click", () => {
    state.emptyPreview = !state.emptyPreview;
    elements.emptyToggle.setAttribute("aria-pressed", String(state.emptyPreview));
    elements.emptyToggle.textContent = state.emptyPreview ? "恢复评论" : "空评论页";
    render();
  });

  elements.retryButton.addEventListener("click", () => {
    elements.retryButton.disabled = true;
    elements.retryButton.textContent = "正在重新加载…";
    window.setTimeout(() => {
      elements.retryButton.disabled = false;
      elements.retryButton.textContent = "重新加载";
      setServiceError(false);
      setStatus("评论已重新加载。");
    }, 350);
  });

  const validateComposer = (showError) => {
    const config = settings();
    const nameReady = elements.nickname.value.trim().length > 0;
    const emailValue = elements.email.value.trim();
    const emailReady = (!config.emailRequired && emailValue.length === 0)
      || (emailValue.length > 0 && elements.email.validity.valid);
    const websiteValue = elements.website.value.trim();
    const websiteReady = (!config.websiteRequired && websiteValue.length === 0)
      || safeWebsite(websiteValue) !== null;
    const messageLength = codePointLength(elements.commentInput.value);
    const messageReady = elements.commentInput.value.trim().length > 0 && messageLength <= config.commentLimit;
    const ready = nameReady && emailReady && websiteReady && messageReady;

    elements.submitButton.disabled = !ready;
    elements.characterCount.textContent = `${messageLength}/${config.commentLimit}`;

    if (!showError || ready) {
      elements.formError.hidden = true;
      elements.formError.textContent = "";
      return ready;
    }

    if (!nameReady) {
      elements.formError.textContent = "请输入昵称。";
      elements.nickname.focus();
    } else if (!emailReady) {
      elements.formError.textContent = config.emailRequired ? "请输入有效邮箱。" : "邮箱格式不正确。";
      elements.email.focus();
    } else if (!websiteReady) {
      elements.formError.textContent = config.websiteRequired
        ? "请输入以 http:// 或 https:// 开头的网址。"
        : "网址需要以 http:// 或 https:// 开头。";
      elements.website.focus();
    } else if (messageLength > config.commentLimit) {
      elements.formError.textContent = `评论不能超过 ${config.commentLimit} 个字符。`;
      elements.commentInput.focus();
    } else {
      elements.formError.textContent = "评论内容不能为空。";
      elements.commentInput.focus();
    }
    elements.formError.hidden = false;
    return false;
  };

  [elements.nickname, elements.email, elements.website, elements.commentInput].forEach((control) => {
    control.addEventListener("input", () => validateComposer(false));
  });

  const applySettings = () => {
    const config = settings();
    elements.configCommentLimit.value = String(config.commentLimit);
    elements.email.required = config.emailRequired;
    elements.website.required = config.websiteRequired;
    elements.commentInput.placeholder = config.placeholder;
    if (state.emptyPreview) {
      elements.emptyCommentsText.textContent = config.emptyMessage;
    }
    validateComposer(false);
    render();
    refreshTurnstileSlots(true);
  };

  const setConfigPanelOpen = (open) => {
    elements.configPanel.hidden = !open;
    elements.controls.dataset.settingsOpen = String(open);
    elements.configToggle.setAttribute("aria-expanded", String(open));
    if (open) elements.configEmailRequired.focus();
  };

  elements.configToggle.addEventListener("click", () => {
    setConfigPanelOpen(elements.configToggle.getAttribute("aria-expanded") !== "true");
  });
  [elements.configEmailRequired, elements.configWebsiteRequired, elements.configTurnstileEnabled, elements.configTurnstileInteract, elements.configTurnstileCleared].forEach((control) => {
    control.addEventListener("change", applySettings);
  });
  [elements.configPlaceholder, elements.configCommentLimit, elements.configEmptyMessage, elements.configTimezone, elements.configBloggerNickname, elements.configBloggerBadge].forEach((control) => {
    control.addEventListener("input", applySettings);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.configPanel.hidden) {
      setConfigPanelOpen(false);
      elements.configToggle.focus();
    }
  });

  elements.commentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!validateComposer(true)) return;

    const id = state.nextId;
    state.nextId += 1;
    const newComment = {
      id,
      siteId: "blog-local",
      mark: "/posts/windows-11-iot-ltsc-guide/",
      parentId: null,
      rootId: id,
      depth: 1,
      status: "approved",
      author: elements.nickname.value.trim(),
      privateEmail: elements.email.value.trim(),
      website: safeWebsite(elements.website.value.trim()),
      body: elements.commentInput.value.trim(),
      deleted: false,
      createdAt: new Date().toISOString()
    };
    state.comments.push(newComment);
    state.currentPage = state.sort === "newest" ? 1 : pageCountFor(orderedRoots());
    elements.commentInput.value = "";
    validateComposer(false);
    render();
    setStatus("评论已加入讨论，内容按纯文本显示。");
    document.getElementById(`comment-${newComment.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  const goToPage = (page) => {
    if (state.loading) return;
    const roots = orderedRoots();
    const targetPage = Math.min(pageCountFor(roots), Math.max(1, page));
    if (targetPage === state.currentPage) return;
    state.loading = true;
    elements.threadList.setAttribute("aria-busy", "true");
    updatePagination(roots);
    window.setTimeout(() => {
      state.currentPage = targetPage;
      state.loading = false;
      elements.threadList.setAttribute("aria-busy", "false");
      render();
      setStatus(`已切换到第 ${state.currentPage} 页。`);
      elements.threadList.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 220);
  };

  elements.previousPage.addEventListener("click", () => goToPage(state.currentPage - 1));
  elements.nextPage.addEventListener("click", () => goToPage(state.currentPage + 1));

  window.EcokuPrototype = Object.freeze({
    getStats: () => {
      const depthDistribution = state.comments.reduce((result, comment) => {
        result[comment.depth] = (result[comment.depth] ?? 0) + 1;
        return result;
      }, {});
      return {
        total: state.comments.length,
        roots: orderedRoots().length,
        maxDepth: Math.max(...state.comments.map((comment) => comment.depth)),
        visible: elements.threadList.querySelectorAll(".comment-node:not([hidden])").length,
        rendered: elements.threadList.querySelectorAll(".comment-node").length,
        depthDistribution,
        sort: state.sort,
        currentPage: state.currentPage,
        pageCount: pageCountFor(orderedRoots())
      };
    },
    resetPagination: () => {
      state.currentPage = 1;
      render();
      return window.EcokuPrototype.getStats();
    },
    goToPage: (page) => {
      state.currentPage = Math.min(pageCountFor(orderedRoots()), Math.max(1, Number(page) || 1));
      render();
      return window.EcokuPrototype.getStats();
    },
    chooseSort,
    setEmpty: (empty) => {
      state.emptyPreview = Boolean(empty);
      elements.emptyToggle.setAttribute("aria-pressed", String(state.emptyPreview));
      elements.emptyToggle.textContent = state.emptyPreview ? "恢复评论" : "空评论页";
      render();
      return window.EcokuPrototype.getStats();
    },
    codePointLength
  });

  new MutationObserver(() => refreshTurnstileSlots(false)).observe(elements.threadList, { childList: true, subtree: true });

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.classList.contains("composer")) return;
    const config = settings();
    if (!config.turnstileEnabled || config.turnstileCleared) return;
    if (form.dataset.turnstileReady === "true") {
      delete form.dataset.turnstileReady;
      return;
    }
    const showTurnstileError = () => {
      const error = form.querySelector(".form-error, .reply-error");
      if (!error) return;
      error.textContent = "请完成验证后再发布。";
      error.hidden = false;
    };
    if (!turnstileReady(form)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showTurnstileError();
    }
  }, true);

  applySettings();
  validateComposer(false);
  render();
})();
