(() => {
  "use strict";

  const DEVICE_DAYS = 7;
  const DEVICE_TTL_MS = DEVICE_DAYS * 24 * 60 * 60 * 1000;
  const SERVER_URL = "https://comments.example.test";
  const SITE_ID = "blog-local";
  const IDENTITY_SCOPE = `${SERVER_URL}::${SITE_ID}`;
  const DB_NAME = "ecoku-prototype-v8";
  const STORE_NAME = "identity";
  const KEY_RECORD = `key:${IDENTITY_SCOPE}`;
  const VALUE_RECORD = `value:${IDENTITY_SCOPE}`;

  const root = {
    form: document.getElementById("comment-form"),
    nickname: document.getElementById("nickname"),
    email: document.getElementById("email"),
    website: document.getElementById("website"),
    status: document.getElementById("status-line"),
    threadList: document.getElementById("thread-list"),
    replyTemplate: document.getElementById("reply-template-v8"),
    limit: document.getElementById("config-comment-limit")
  };

  const state = {
    activeCommentId: null,
    activeForm: null,
    restoring: true
  };

  const codePointLength = (value) => Array.from(value).length;
  const commentLimit = () => Math.min(10000, Math.max(1, Number.parseInt(root.limit.value, 10) || 1000));
  const currentIdentity = () => ({
    nickname: root.nickname.value.trim(),
    email: root.email.value.trim(),
    website: root.website.value.trim()
  });

  const identityIsReady = (identity = currentIdentity()) => {
    if (!identity.nickname) return false;
    if (root.email.required && !identity.email) return false;
    if (identity.email) {
      const probe = document.createElement("input");
      probe.type = "email";
      probe.value = identity.email;
      if (!probe.validity.valid) return false;
    }
    return !identity.website || /^https?:\/\//i.test(identity.website);
  };

  const openDatabase = () => new Promise((resolve, reject) => {
    if (!("indexedDB" in window) || !window.crypto?.subtle) {
      reject(new Error("device-storage-unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const transact = async (mode, action) => {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      let result;
      try { result = action(store); } catch (error) { database.close(); reject(error); return; }
      transaction.oncomplete = () => { database.close(); resolve(result); };
      transaction.onerror = () => { database.close(); reject(transaction.error); };
      transaction.onabort = () => { database.close(); reject(transaction.error); };
    });
  };

  const requestValue = (request) => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const getOrCreateEncryptionKey = async () => {
    const existing = await transact("readonly", (store) => requestValue(store.get(KEY_RECORD)));
    const record = await existing;
    if (record?.key) return record.key;
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    await transact("readwrite", (store) => store.put({ id: KEY_RECORD, key }));
    return key;
  };

  const saveIdentity = async (identity) => {
    if (!identityIsReady(identity)) return false;
    const key = await getOrCreateEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const savedAt = Date.now();
    const plaintext = new TextEncoder().encode(JSON.stringify(identity));
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
    await transact("readwrite", (store) => store.put({
      id: VALUE_RECORD,
      scope: IDENTITY_SCOPE,
      iv,
      ciphertext,
      savedAt,
      expiresAt: savedAt + DEVICE_TTL_MS
    }));
    return true;
  };

  const restoreIdentity = async () => {
    try {
      const valueRecord = await transact("readonly", (store) => requestValue(store.get(VALUE_RECORD)));
      const stored = await valueRecord;
      const hasCurrentLifetime = stored?.savedAt
        && stored.expiresAt === stored.savedAt + DEVICE_TTL_MS
        && stored.expiresAt > Date.now();
      if (!stored || stored.scope !== IDENTITY_SCOPE || !hasCurrentLifetime) return;
      const keyRecord = await transact("readonly", (store) => requestValue(store.get(KEY_RECORD)));
      const key = (await keyRecord)?.key;
      if (!key) return;
      const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: stored.iv }, key, stored.ciphertext);
      const identity = JSON.parse(new TextDecoder().decode(plaintext));
      root.nickname.value = identity.nickname || "";
      root.email.value = identity.email || "";
      root.website.value = identity.website || "";
      root.nickname.dispatchEvent(new Event("input", { bubbles: true }));
    } catch (_) {
      // Expired, corrupt, or inaccessible identity is ignored. Browser site
      // data remains under the visitor's control and is never cleared here.
    } finally {
      state.restoring = false;
    }
  };

  const syncIdentityToRoot = (form) => {
    const nickname = form.elements.nickname;
    const email = form.elements.email;
    const website = form.elements.website;
    root.nickname.value = nickname.value;
    root.email.value = email.value;
    root.website.value = website.value;
    root.nickname.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const syncRootToReply = () => {
    const form = state.activeForm;
    if (!form) return;
    form.elements.nickname.value = root.nickname.value;
    form.elements.email.value = root.email.value;
    form.elements.website.value = root.website.value;
    updateIdentityMode(form);
  };

  const updateIdentityMode = (form, forceEdit = false) => {
    const identity = currentIdentity();
    const ready = identityIsReady(identity);
    const summary = form.querySelector(".reply-identity-summary");
    const grid = form.querySelector(".reply-identity-grid");
    const change = form.querySelector(".identity-change");
    summary.querySelector("[data-reply-identity]").textContent = identity.nickname;
    summary.hidden = forceEdit || !ready;
    change.hidden = forceEdit || !ready;
    grid.hidden = !forceEdit && ready;
  };

  const activeDraft = () => state.activeForm?.elements.comment?.value.trim() || "";

  const closeReply = ({ restoreFocus = true } = {}) => {
    const commentId = state.activeCommentId;
    state.activeForm?.remove();
    state.activeForm = null;
    state.activeCommentId = null;
    if (restoreFocus && commentId !== null) {
      document.querySelector(`[data-comment-id="${commentId}"] .reply-action`)?.focus();
    }
  };

  const validateReply = (form) => {
    syncIdentityToRoot(form);
    const error = form.querySelector(".reply-error");
    const body = form.elements.comment.value.trim();
    let message = "";
    if (!root.nickname.value.trim()) message = "请输入昵称。";
    else if (root.email.required && !root.email.value.trim()) message = "请输入有效邮箱。";
    else if (root.email.value && !root.email.validity.valid) message = "邮箱格式不正确。";
    else if (root.website.value && !/^https?:\/\//i.test(root.website.value)) message = "网址需要以 http:// 或 https:// 开头。";
    else if (!body) message = "回复内容不能为空。";
    else if (codePointLength(body) > commentLimit()) message = `回复不能超过 ${commentLimit()} 个字符。`;
    error.textContent = message;
    error.hidden = !message;
    return !message;
  };

  const openReply = (commentElement) => {
    const commentId = Number(commentElement.dataset.commentId);
    if (state.activeCommentId === commentId) {
      state.activeForm?.elements.comment.focus();
      return;
    }
    if (state.activeForm && activeDraft() && !window.confirm("当前回复尚未发布，切换后将清空这段内容。是否继续？")) {
      state.activeForm.elements.comment.focus();
      return;
    }
    closeReply({ restoreFocus: false });

    const slot = commentElement.querySelector(".reply-slot");
    if (!slot) return;
    const form = root.replyTemplate.content.firstElementChild.cloneNode(true);
    const author = commentElement.querySelector(".comment-author")?.textContent.trim() || "该评论者";
    form.dataset.parentId = String(commentId);
    form.querySelector(".reply-parent-id").value = String(commentId);
    form.querySelector("[data-reply-author]").textContent = author;
    form.elements.nickname.value = root.nickname.value;
    form.elements.email.value = root.email.value;
    form.elements.website.value = root.website.value;
    updateIdentityMode(form);

    form.querySelector(".identity-change").addEventListener("click", () => {
      updateIdentityMode(form, true);
      form.elements.nickname.focus();
    });
    [form.elements.nickname, form.elements.email, form.elements.website].forEach((control) => {
      control.addEventListener("input", () => syncIdentityToRoot(form));
    });
    form.elements.comment.addEventListener("input", () => {
      form.querySelector(".reply-count").textContent = `${codePointLength(form.elements.comment.value)}/${commentLimit()}`;
    });
    form.querySelector(".cancel-reply").addEventListener("click", () => closeReply());
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!validateReply(form)) return;
      await saveIdentity(currentIdentity());
      const parentId = form.querySelector(".reply-parent-id").value;
      closeReply({ restoreFocus: false });
      root.status.textContent = `回复已提交至 #${parentId}，可能需要审核后显示。`;
      document.querySelector(`[data-comment-id="${parentId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    slot.replaceChildren(form);
    state.activeCommentId = commentId;
    state.activeForm = form;
    form.elements.comment.focus({ preventScroll: true });
    form.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  root.threadList.addEventListener("click", (event) => {
    const replyButton = event.target.closest(".reply-action");
    if (!replyButton || !root.threadList.contains(replyButton)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const commentElement = replyButton.closest("[data-comment-id]");
    if (commentElement) openReply(commentElement);
  }, true);

  [root.nickname, root.email, root.website].forEach((control) => control.addEventListener("input", syncRootToReply));
  root.form.addEventListener("submit", async () => {
    if (identityIsReady()) await saveIdentity(currentIdentity());
  }, true);

  const previousPrototype = window.EcokuPrototype;
  window.EcokuPrototypeV8 = Object.freeze({
    scope: IDENTITY_SCOPE,
    deviceDays: DEVICE_DAYS,
    getActiveReply: () => ({ commentId: state.activeCommentId, draft: activeDraft() }),
    restoreIdentity,
    previousPrototype
  });

  restoreIdentity();
})();
