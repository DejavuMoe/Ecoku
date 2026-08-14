(function () {
  "use strict";

  const source = window.ECOKU_ADMIN_PROTOTYPE_FIXTURES;
  const model = {
    sites: source.sites.map((site) => ({ ...site })),
    comments: source.comments.map((comment) => ({ ...comment }))
  };

  const statusOrder = ["pending", "approved", "rejected", "deleted"];
  const statusMeta = {
    pending: { label: "待审核", short: "Pending", className: "is-pending" },
    approved: { label: "已批准", short: "Approved", className: "is-approved" },
    rejected: { label: "已拒绝", short: "Rejected", className: "is-rejected" },
    deleted: { label: "已删除", short: "Deleted", className: "is-deleted" }
  };

  const state = {
    authenticated: true,
    siteId: model.sites[0].id,
    status: "pending",
    page: 1,
    pageSize: 4,
    selectedId: null,
    scenario: "normal",
    busy: false,
    lastDeleteTrigger: null
  };

  const elements = {
    loginScreen: document.getElementById("login-screen"),
    workspaceScreen: document.getElementById("workspace-screen"),
    loginForm: document.getElementById("login-form"),
    loginButton: document.getElementById("login-button"),
    loginError: document.getElementById("login-error"),
    username: document.getElementById("admin-username"),
    password: document.getElementById("admin-password"),
    logout: document.getElementById("logout-button"),
    prototypeControlToggle: document.getElementById("prototype-control-toggle"),
    prototypeAuthToggle: document.getElementById("prototype-auth-toggle"),
    scenario: document.getElementById("scenario-control"),
    main: document.getElementById("main-content"),
    site: document.getElementById("site-select"),
    statusTabs: document.getElementById("status-tabs"),
    queueSummary: document.getElementById("queue-summary"),
    pageSummary: document.getElementById("page-summary"),
    queueState: document.getElementById("queue-state"),
    queue: document.getElementById("comment-queue"),
    pager: document.getElementById("pager"),
    pagerLabel: document.getElementById("pager-label"),
    previousPage: document.getElementById("previous-page"),
    nextPage: document.getElementById("next-page"),
    refresh: document.getElementById("refresh-button"),
    detailEmpty: document.getElementById("detail-empty"),
    reviewSheet: document.getElementById("review-sheet"),
    back: document.getElementById("back-to-queue"),
    detailStatus: document.getElementById("detail-status"),
    detailId: document.getElementById("detail-id"),
    detailPath: document.getElementById("detail-path"),
    detailTitle: document.getElementById("detail-title"),
    detailTime: document.getElementById("detail-time"),
    detailParent: document.getElementById("detail-parent"),
    detailEmail: document.getElementById("detail-email"),
    detailURL: document.getElementById("detail-url"),
    detailMark: document.getElementById("detail-mark"),
    detailSite: document.getElementById("detail-site"),
    ancestorNote: document.getElementById("ancestor-note"),
    detailContent: document.getElementById("detail-content"),
    actionFeedback: document.getElementById("action-feedback"),
    reviewActions: document.getElementById("review-actions"),
    approve: document.getElementById("approve-button"),
    reject: document.getElementById("reject-button"),
    delete: document.getElementById("delete-button"),
    deleteDialog: document.getElementById("delete-dialog"),
    confirmDelete: document.getElementById("confirm-delete"),
    cancelDelete: document.getElementById("cancel-delete"),
    toast: document.getElementById("toast"),
    live: document.getElementById("live-region")
  };

  let toastTimer = 0;

  function announce(message) {
    elements.live.textContent = "";
    window.setTimeout(() => {
      elements.live.textContent = message;
    }, 20);
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    toastTimer = window.setTimeout(() => {
      elements.toast.hidden = true;
    }, 3200);
    announce(message);
  }

  function currentSite() {
    return model.sites.find((site) => site.id === state.siteId) || model.sites[0];
  }

  function currentComment() {
    return model.comments.find((comment) => comment.id === state.selectedId) || null;
  }

  function commentMatchesStatus(comment, status) {
    if (status === "deleted") return comment.deleted;
    return !comment.deleted && comment.status === status;
  }

  function filteredComments(status = state.status) {
    if (state.scenario === "empty") return [];
    return model.comments
      .filter((comment) => comment.siteId === state.siteId && commentMatchesStatus(comment, status))
      .sort((left, right) => {
        const timeDifference = Date.parse(left.createdAt) - Date.parse(right.createdAt);
        return timeDifference || left.id - right.id;
      });
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(new Date(value));
  }

  function statusForComment(comment) {
    return comment.deleted ? "deleted" : comment.status;
  }

  function safeWebsite(value) {
    if (!value) return null;
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
      return parsed.href;
    } catch (_error) {
      return null;
    }
  }

  function createStatusPill(comment, compact) {
    const key = statusForComment(comment);
    const metadata = statusMeta[key];
    const pill = document.createElement("span");
    pill.className = `${compact ? "mini-status" : "status-stamp"} ${metadata.className}`;
    pill.textContent = metadata.label;
    return pill;
  }

  function populateSites() {
    elements.site.replaceChildren();
    model.sites.forEach((site) => {
      const option = document.createElement("option");
      option.value = site.id;
      option.textContent = `${site.label} · ${site.id}`;
      elements.site.append(option);
    });
    elements.site.value = state.siteId;
  }

  function renderTabs() {
    elements.statusTabs.replaceChildren();
    statusOrder.forEach((status) => {
      const button = document.createElement("button");
      button.className = "status-tab";
      button.type = "button";
      button.dataset.status = status;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", String(state.status === status));

      const label = document.createElement("span");
      label.textContent = statusMeta[status].label;
      const count = document.createElement("strong");
      count.textContent = String(filteredComments(status).length);
      button.append(label, count);
      elements.statusTabs.append(button);
    });
  }

  function showQueueState(kind, title, message, retryable) {
    elements.queueState.replaceChildren();
    elements.queueState.className = `queue-state${kind === "neutral" ? " is-neutral" : ""}`;
    const heading = document.createElement("strong");
    heading.textContent = title;
    const copy = document.createElement("p");
    copy.textContent = message;
    elements.queueState.append(heading, copy);
    if (retryable) {
      const retry = document.createElement("button");
      retry.className = "button button-secondary";
      retry.type = "button";
      retry.textContent = "重试";
      retry.addEventListener("click", () => {
        state.scenario = "normal";
        elements.scenario.value = "normal";
        renderAll();
        announce("评论列表已恢复");
      });
      elements.queueState.append(retry);
    }
    elements.queueState.hidden = false;
  }

  function hideQueueState() {
    elements.queueState.hidden = true;
    elements.queueState.replaceChildren();
  }

  function renderQueueItem(comment) {
    const button = document.createElement("button");
    button.className = "queue-item";
    button.type = "button";
    button.dataset.commentId = String(comment.id);
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(comment.id === state.selectedId));

    const head = document.createElement("span");
    head.className = "queue-item-head";
    const author = document.createElement("span");
    author.className = "queue-author";
    author.textContent = comment.deleted ? "已删除" : comment.username;
    const time = document.createElement("time");
    time.className = "queue-time";
    time.dateTime = comment.createdAt;
    time.textContent = formatDate(comment.createdAt);
    head.append(author, time);

    const copy = document.createElement("span");
    copy.className = "queue-copy";
    copy.textContent = comment.deleted ? "[该评论已删除]" : comment.content;

    const foot = document.createElement("span");
    foot.className = "queue-item-foot";
    const page = document.createElement("span");
    page.className = "queue-page";
    page.textContent = comment.mark;
    const trailing = document.createElement("span");
    trailing.className = "queue-parent";
    trailing.textContent = comment.parent ? `回复 #${comment.parent}` : `#${comment.id}`;
    foot.append(page, trailing);

    button.append(head, copy, foot);
    button.append(createStatusPill(comment, true));
    return button;
  }

  function renderQueue() {
    elements.queue.replaceChildren();
    hideQueueState();

    if (state.scenario === "server-error") {
      state.selectedId = null;
      showQueueState("error", "评论列表暂时不可用", "服务端返回了 500。稍后重试，当前筛选不会丢失。", true);
      elements.pager.hidden = true;
      renderDetail();
      return;
    }
    if (state.scenario === "offline") {
      state.selectedId = null;
      showQueueState("error", "无法连接到 Ecoku", "检查网络或服务状态后重试。页面不会保存管理员会话。", true);
      elements.pager.hidden = true;
      renderDetail();
      return;
    }

    const comments = filteredComments();
    const pageCount = Math.max(1, Math.ceil(comments.length / state.pageSize));
    if (state.page > pageCount) state.page = pageCount;
    const pageStart = (state.page - 1) * state.pageSize;
    const pageComments = comments.slice(pageStart, pageStart + state.pageSize);

    if (!pageComments.some((comment) => comment.id === state.selectedId)) {
      state.selectedId = pageComments[0] ? pageComments[0].id : null;
    }

    elements.queueSummary.textContent = state.status === "pending" ? "最早提交优先" : "按创建时间升序";
    elements.pageSummary.textContent = `${comments.length} 条`;
    elements.pagerLabel.textContent = `${state.page} / ${pageCount}`;
    elements.previousPage.disabled = state.page <= 1;
    elements.nextPage.disabled = state.page >= pageCount;
    elements.pager.hidden = comments.length === 0;

    if (pageComments.length === 0) {
      const label = statusMeta[state.status].label;
      showQueueState("neutral", `没有${label}评论`, "切换站点或状态，或者稍后刷新列表。", false);
    } else {
      pageComments.forEach((comment) => elements.queue.append(renderQueueItem(comment)));
    }
    renderDetail();
  }

  function clearActionFeedback() {
    elements.actionFeedback.hidden = true;
    elements.actionFeedback.className = "action-feedback";
    elements.actionFeedback.textContent = "";
  }

  function setActionFeedback(message, success) {
    elements.actionFeedback.textContent = message;
    elements.actionFeedback.className = `action-feedback${success ? " is-success" : ""}`;
    elements.actionFeedback.hidden = false;
    announce(message);
  }

  function renderDetail() {
    const comment = currentComment();
    if (!comment) {
      elements.detailEmpty.hidden = false;
      elements.reviewSheet.hidden = true;
      return;
    }

    const status = statusForComment(comment);
    const statusInformation = statusMeta[status];
    elements.detailEmpty.hidden = true;
    elements.reviewSheet.hidden = false;
    clearActionFeedback();

    elements.detailStatus.className = `status-stamp ${statusInformation.className}`;
    elements.detailStatus.textContent = statusInformation.label;
    elements.detailId.textContent = `#${comment.id}`;
    elements.detailPath.textContent = `${currentSite().label} / ${comment.mark}`;
    elements.detailTitle.textContent = comment.deleted ? "已删除" : comment.username;
    elements.detailTime.dateTime = comment.createdAt;
    elements.detailTime.textContent = `提交于 ${formatDate(comment.createdAt)}`;
    elements.detailParent.textContent = comment.parent ? `回复 #${comment.parent}` : "根评论";
    elements.detailEmail.textContent = comment.deleted ? "" : (comment.email || "");
    elements.detailMark.textContent = comment.mark;
    elements.detailSite.textContent = comment.siteId;
    elements.ancestorNote.hidden = comment.parent === 0 || comment.deleted;
    elements.detailContent.className = `comment-copy${comment.deleted ? " is-tombstone" : ""}`;
    elements.detailContent.textContent = comment.deleted ? "[该评论已删除]" : comment.content;

    const website = comment.deleted ? null : safeWebsite(comment.url);
    elements.detailURL.textContent = website || "";
    if (website) {
      elements.detailURL.href = website;
    } else {
      elements.detailURL.removeAttribute("href");
    }

    const pending = !comment.deleted && comment.status === "pending";
    elements.approve.hidden = !pending;
    elements.reject.hidden = !pending;
    elements.delete.hidden = comment.deleted;
    elements.reviewActions.hidden = comment.deleted;
    setBusyState(state.busy);
  }

  function renderAll() {
    renderTabs();
    renderQueue();
  }

  function setBusyState(busy) {
    state.busy = busy;
    [elements.approve, elements.reject, elements.delete, elements.confirmDelete].forEach((button) => {
      button.disabled = busy;
    });
    elements.approve.textContent = busy ? "处理中…" : "批准";
    elements.reject.textContent = busy ? "处理中…" : "拒绝";
    elements.delete.textContent = busy ? "处理中…" : "墓碑删除";
  }

  function selectComment(commentId, focusDetail) {
    state.selectedId = commentId;
    elements.queue.querySelectorAll(".queue-item").forEach((item) => {
      item.setAttribute("aria-selected", String(Number(item.dataset.commentId) === commentId));
    });
    renderDetail();
    if (focusDetail && window.matchMedia("(max-width: 760px)").matches) {
      elements.main.dataset.mobileView = "detail";
      window.scrollTo(0, 0);
      window.setTimeout(() => elements.back.focus({ preventScroll: true }), 0);
    }
  }

  function showLogin(message) {
    state.authenticated = false;
    state.busy = false;
    elements.workspaceScreen.hidden = true;
    elements.loginScreen.hidden = false;
    elements.prototypeAuthToggle.textContent = "查看审核台";
    elements.loginError.hidden = !message;
    elements.loginError.textContent = message || "";
    elements.password.value = "";
    window.setTimeout(() => elements.username.focus(), 0);
    if (message) announce(message);
  }

  function showWorkspace() {
    state.authenticated = true;
    elements.loginScreen.hidden = true;
    elements.workspaceScreen.hidden = false;
    elements.prototypeAuthToggle.textContent = "查看登录";
    elements.loginError.hidden = true;
    elements.main.dataset.mobileView = "queue";
    populateSites();
    renderAll();
    window.setTimeout(() => elements.site.focus(), 0);
  }

  function scenarioFailureMessage() {
    switch (state.scenario) {
      case "conflict":
        return "审核状态已经被其他请求修改（409）。刷新列表后再处理。";
      case "rate-limit":
        return "操作过于频繁（429）。请稍后重试。";
      case "server-error":
        return "服务端暂时无法完成操作（500）。评论状态没有改变。";
      case "offline":
        return "网络连接中断。评论状态没有改变。";
      default:
        return "";
    }
  }

  function completeAction(action) {
    const comment = currentComment();
    if (!comment) return;
    setBusyState(true);
    clearActionFeedback();
    const progressText = action === "delete" ? "正在清除评论个人数据…" : "正在更新审核状态…";
    announce(progressText);

    window.setTimeout(() => {
      const failure = scenarioFailureMessage();
      if (failure) {
        setBusyState(false);
        setActionFeedback(failure, false);
        return;
      }

      if (action === "approve" || action === "reject") {
        comment.status = action === "approve" ? "approved" : "rejected";
        comment.updatedAt = new Date().toISOString();
      } else if (action === "delete") {
        comment.deleted = true;
        comment.username = "已删除";
        comment.email = null;
        comment.url = null;
        comment.content = "";
        comment.updatedAt = new Date().toISOString();
      }

      setBusyState(false);
      const message = action === "approve" ? "评论已批准" : action === "reject" ? "评论已拒绝" : "评论已替换为隐私墓碑";
      showToast(message);
      renderAll();
      const nextSelected = elements.queue.querySelector('.queue-item[aria-selected="true"]');
      if (nextSelected) window.setTimeout(() => nextSelected.focus(), 0);
    }, 520);
  }

  function openDeleteDialog() {
    if (state.busy || !currentComment()) return;
    state.lastDeleteTrigger = elements.delete;
    elements.deleteDialog.showModal();
    window.setTimeout(() => elements.cancelDelete.focus(), 0);
  }

  elements.loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const username = elements.username.value.trim();
    const password = elements.password.value;
    elements.loginError.hidden = true;

    if (!username || !password) {
      elements.loginError.textContent = "请输入用户名和密码。";
      elements.loginError.hidden = false;
      (username ? elements.password : elements.username).focus();
      return;
    }

    elements.loginButton.disabled = true;
    elements.loginButton.textContent = "正在登录…";
    window.setTimeout(() => {
      elements.loginButton.disabled = false;
      elements.loginButton.textContent = "登录";
      if (state.scenario === "rate-limit") {
        elements.loginError.textContent = "登录尝试过于频繁，请稍后重试。";
        elements.loginError.hidden = false;
        return;
      }
      if (state.scenario === "offline" || state.scenario === "server-error") {
        elements.loginError.textContent = "暂时无法连接到管理员认证服务。";
        elements.loginError.hidden = false;
        return;
      }
      if (password === "wrong") {
        elements.loginError.textContent = "用户名或密码错误。";
        elements.loginError.hidden = false;
        elements.password.select();
        return;
      }
      showWorkspace();
      showToast("已进入评论审核台");
    }, 420);
  });

  elements.logout.addEventListener("click", () => showLogin(""));

  elements.prototypeAuthToggle.addEventListener("click", () => {
    if (state.authenticated) showLogin("");
    else showWorkspace();
  });

  elements.prototypeControlToggle.addEventListener("click", () => {
    const controls = elements.prototypeControlToggle.closest(".prototype-controls");
    const open = controls.dataset.open !== "true";
    controls.dataset.open = String(open);
    elements.prototypeControlToggle.setAttribute("aria-expanded", String(open));
  });

  elements.scenario.addEventListener("change", () => {
    state.scenario = elements.scenario.value;
    state.page = 1;
    if (state.scenario === "expired") {
      showLogin("会话已过期，请重新登录。");
      return;
    }
    if (state.authenticated) renderAll();
  });

  elements.site.addEventListener("change", () => {
    state.siteId = elements.site.value;
    state.page = 1;
    state.selectedId = null;
    elements.main.dataset.mobileView = "queue";
    renderAll();
    announce(`已切换到${currentSite().label}`);
  });

  elements.statusTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-status]");
    if (!button) return;
    state.status = button.dataset.status;
    state.page = 1;
    state.selectedId = null;
    elements.main.dataset.mobileView = "queue";
    renderAll();
    announce(`正在查看${statusMeta[state.status].label}评论`);
  });

  elements.queue.addEventListener("click", (event) => {
    const item = event.target.closest("[data-comment-id]");
    if (!item) return;
    selectComment(Number(item.dataset.commentId), true);
  });

  elements.previousPage.addEventListener("click", () => {
    if (state.page <= 1) return;
    state.page -= 1;
    state.selectedId = null;
    renderQueue();
  });

  elements.nextPage.addEventListener("click", () => {
    state.page += 1;
    state.selectedId = null;
    renderQueue();
  });

  elements.refresh.addEventListener("click", () => {
    state.scenario = "normal";
    elements.scenario.value = "normal";
    renderAll();
    showToast("评论列表已刷新");
  });

  elements.back.addEventListener("click", () => {
    elements.main.dataset.mobileView = "queue";
    const selected = elements.queue.querySelector('.queue-item[aria-selected="true"]');
    if (selected) window.setTimeout(() => selected.focus(), 0);
  });

  elements.approve.addEventListener("click", () => completeAction("approve"));
  elements.reject.addEventListener("click", () => completeAction("reject"));
  elements.delete.addEventListener("click", openDeleteDialog);

  elements.confirmDelete.addEventListener("click", (event) => {
    event.preventDefault();
    elements.deleteDialog.close("confirm");
    completeAction("delete");
  });

  elements.cancelDelete.addEventListener("click", () => {
    window.setTimeout(() => {
      if (state.lastDeleteTrigger) state.lastDeleteTrigger.focus();
    }, 0);
  });

  elements.deleteDialog.addEventListener("close", () => {
    if (elements.deleteDialog.returnValue !== "confirm" && state.lastDeleteTrigger) {
      window.setTimeout(() => state.lastDeleteTrigger.focus(), 0);
    }
  });

  populateSites();
  renderAll();
})();
