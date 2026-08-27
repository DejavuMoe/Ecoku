(function () {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const manifestUrl = new URL("./smoji.json", window.location.href);
  let manifestPromise = null;
  let manifestController = null;
  let openPicker = null;

  function codePointLength(value) {
    return Array.from(value).length;
  }

  function exactKeys(value, expected) {
    const actual = Object.keys(value).sort();
    return actual.length === expected.length && expected.slice().sort().every((key, index) => key === actual[index]);
  }

  function validId(value) {
    return typeof value === "string" && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(value);
  }

  function validLabel(value) {
    return typeof value === "string" && codePointLength(value) >= 1 && codePointLength(value) <= 40 && !/[\]\r\n]/.test(value);
  }

  function validateManifest(value, sourceUrl) {
    if (!value || typeof value !== "object" || !exactKeys(value, ["version", "packs"]) || value.version !== 1 || !Array.isArray(value.packs) || value.packs.length < 1 || value.packs.length > 32) {
      throw new TypeError("不是 smoji.json v1");
    }
    const packIds = new Set();
    let itemTotal = 0;
    const packs = value.packs.map((pack) => {
      if (!pack || typeof pack !== "object" || !exactKeys(pack, ["id", "label", "items"]) || !validId(pack.id) || !validLabel(pack.label) || !Array.isArray(pack.items) || pack.items.length < 1 || pack.items.length > 300 || packIds.has(pack.id)) {
        throw new TypeError("表情包结构无效");
      }
      packIds.add(pack.id);
      const itemIds = new Set();
      const items = pack.items.map((item) => {
        if (!item || typeof item !== "object" || !exactKeys(item, ["id", "label", "src"]) || !validId(item.id) || !validLabel(item.label) || typeof item.src !== "string" || itemIds.has(item.id)) {
          throw new TypeError("表情条目结构无效");
        }
        itemIds.add(item.id);
        const src = new URL(item.src, sourceUrl);
        if (src.origin !== sourceUrl.origin || !["http:", "https:"].includes(src.protocol) || src.username || src.password || src.hash) {
          throw new TypeError("表情图片不是清单同源直链");
        }
        return { id: item.id, label: item.label, src: src.href };
      });
      itemTotal += items.length;
      return { id: pack.id, label: pack.label, items };
    });
    if (itemTotal > 2000) throw new TypeError("表情条目过多");
    return { version: 1, packs, itemTotal };
  }

  async function fetchManifest() {
    const forceFailure = byId("force-load-error")?.checked;
    const sourceUrl = forceFailure ? new URL("./missing-smoji.json", window.location.href) : manifestUrl;
    manifestController = new AbortController();
    const timeout = window.setTimeout(() => manifestController?.abort(), 8000);
    try {
      const response = await fetch(sourceUrl, {
        credentials: "omit",
        referrerPolicy: "no-referrer",
        signal: manifestController.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const declaredLength = Number(response.headers.get("content-length") || 0);
      if (declaredLength > 262144) throw new Error("清单超过 256 KiB");
      const text = await response.text();
      if (new TextEncoder().encode(text).byteLength > 262144) throw new Error("清单超过 256 KiB");
      return validateManifest(JSON.parse(text), sourceUrl);
    } finally {
      window.clearTimeout(timeout);
      manifestController = null;
    }
  }

  function loadManifest() {
    if (!manifestPromise) {
      const state = byId("lazy-state");
      if (state) state.textContent = "正在请求 smoji.json…";
      manifestPromise = fetchManifest().then((manifest) => {
        if (state) state.textContent = `已按需加载 ${manifest.packs.length} 组 · ${manifest.itemTotal} 个`;
        return manifest;
      }).catch((error) => {
        manifestPromise = null;
        if (state) state.textContent = "smoji.json 加载失败，评论仍可使用";
        throw error;
      });
    }
    return manifestPromise;
  }

  function updateCounter(textarea) {
    const counter = document.querySelector(`[data-counter-for="${textarea.id}"]`);
    if (counter) counter.textContent = `${codePointLength(textarea.value)}/${textarea.maxLength}`;
  }

  function insertAtSelection(textarea, value) {
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? start;
    const prefix = start > 0 && !/\s/.test(textarea.value[start - 1]) ? " " : "";
    const suffix = end < textarea.value.length && !/\s/.test(textarea.value[end]) ? " " : "";
    textarea.setRangeText(`${prefix}${value}${suffix}`, start, end, "end");
    textarea.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  }

  function closeCurrentPicker(returnFocus) {
    if (!openPicker) return;
    const { picker, trigger } = openPicker;
    picker.remove();
    trigger.setAttribute("aria-expanded", "false");
    openPicker = null;
    if (returnFocus) trigger.focus();
  }

  function renderPack(panel, manifest, packIndex, textarea, trigger) {
    const tabs = panel.querySelector(".smoji-tabs");
    const grid = panel.querySelector(".smoji-grid");
    const pack = manifest.packs[packIndex];
    tabs.querySelectorAll(".smoji-tab").forEach((tab, index) => {
      tab.setAttribute("aria-selected", String(index === packIndex));
      tab.tabIndex = index === packIndex ? 0 : -1;
    });
    grid.replaceChildren();
    pack.items.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "smoji-item";
      button.setAttribute("aria-label", item.label);
      const image = document.createElement("img");
      image.src = item.src;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.referrerPolicy = "no-referrer";
      button.append(image);
      button.addEventListener("click", () => {
        const marker = `![smoji:${item.label}](${item.src})`;
        insertAtSelection(textarea, marker);
        closeCurrentPicker(false);
        textarea.focus();
      });
      grid.append(button);
    });
  }

  function showManifest(panel, manifest, textarea, trigger) {
    panel.querySelector(".smoji-loading").hidden = true;
    panel.querySelector(".smoji-error").hidden = true;
    panel.querySelector(".smoji-content").hidden = false;
    const tabs = panel.querySelector(".smoji-tabs");
    tabs.replaceChildren();
    manifest.packs.forEach((pack, index) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "smoji-tab";
      tab.textContent = pack.label;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(index === 0));
      tab.tabIndex = index === 0 ? 0 : -1;
      tab.addEventListener("click", () => renderPack(panel, manifest, index, textarea, trigger));
      tab.addEventListener("keydown", (event) => {
        if (!event.key.startsWith("Arrow")) return;
        event.preventDefault();
        const direction = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
        const next = (index + direction + manifest.packs.length) % manifest.packs.length;
        tabs.children[next].focus();
        renderPack(panel, manifest, next, textarea, trigger);
      });
      tabs.append(tab);
    });
    renderPack(panel, manifest, 0, textarea, trigger);
  }

  async function populatePicker(panel, textarea, trigger) {
    panel.querySelector(".smoji-loading").hidden = false;
    panel.querySelector(".smoji-error").hidden = true;
    panel.querySelector(".smoji-content").hidden = true;
    try {
      const manifest = await loadManifest();
      if (panel.isConnected) showManifest(panel, manifest, textarea, trigger);
    } catch {
      if (!panel.isConnected) return;
      panel.querySelector(".smoji-loading").hidden = true;
      panel.querySelector(".smoji-error").hidden = false;
    }
  }

  function openForTrigger(trigger) {
    if (openPicker?.trigger === trigger) {
      closeCurrentPicker(true);
      return;
    }
    closeCurrentPicker(false);
    const textarea = byId(trigger.dataset.target);
    const slot = trigger.closest(".candidate-composer").querySelector("[data-smoji-slot]");
    const template = byId("smoji-picker-template");
    const picker = template.content.firstElementChild.cloneNode(true);
    const pickerId = `smoji-picker-${trigger.dataset.target}`;
    picker.id = pickerId;
    trigger.setAttribute("aria-controls", pickerId);
    trigger.setAttribute("aria-expanded", "true");
    slot.replaceChildren(picker);
    openPicker = { picker, trigger };
    picker.querySelector(".smoji-close").addEventListener("click", () => closeCurrentPicker(true));
    picker.querySelector("[data-smoji-retry]").addEventListener("click", () => populatePicker(picker, textarea, trigger));
    void populatePicker(picker, textarea, trigger);
  }

  const markerPattern = /!\[smoji:([^\]\r\n]{1,40})\]\((https?:\/\/[^()\s]+|\.\/[^()\s]+)\)/g;

  function renderSmojiContent(element, content) {
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const match of content.matchAll(markerPattern)) {
      fragment.append(document.createTextNode(content.slice(cursor, match.index)));
      const wrapper = document.createElement("span");
      wrapper.className = "smoji-inline";
      wrapper.setAttribute("role", "img");
      wrapper.setAttribute("aria-label", `表情：${match[1]}`);
      const image = document.createElement("img");
      image.src = new URL(match[2], window.location.href).href;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.referrerPolicy = "no-referrer";
      wrapper.append(image);
      fragment.append(wrapper);
      cursor = match.index + match[0].length;
    }
    fragment.append(document.createTextNode(content.slice(cursor)));
    element.replaceChildren(fragment);
  }

  function initCommentCandidate() {
    const template = byId("smoji-picker-template");
    if (!template) return;
    document.querySelectorAll("[data-smoji-trigger]").forEach((trigger) => trigger.addEventListener("click", () => openForTrigger(trigger)));
    document.querySelectorAll("textarea[id]").forEach((textarea) => {
      textarea.addEventListener("input", () => updateCounter(textarea));
      updateCounter(textarea);
    });
    document.querySelectorAll("[data-smoji-content]").forEach((element) => renderSmojiContent(element, element.dataset.smojiContent));
    byId("comment-form").addEventListener("submit", (event) => event.preventDefault());
    byId("reply-composer").addEventListener("submit", (event) => event.preventDefault());
    byId("reset-loader").addEventListener("click", () => {
      manifestController?.abort();
      manifestPromise = null;
      closeCurrentPicker(false);
      byId("lazy-state").textContent = "尚未请求 smoji.json";
    });
    byId("force-load-error").addEventListener("change", () => {
      manifestController?.abort();
      manifestPromise = null;
      closeCurrentPicker(false);
      byId("lazy-state").textContent = "尚未请求 smoji.json";
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && openPicker) closeCurrentPicker(true);
    });
  }

  function initAdminCandidate() {
    const scenario = byId("admin-scenario-select");
    if (!scenario) return;
    const enabled = byId("smoji-enabled");
    const url = byId("smoji-url");
    const row = byId("smoji-url-row");
    const error = byId("smoji-url-error");
    function applyScenario() {
      const value = scenario.value;
      enabled.checked = value !== "disabled";
      row.hidden = value === "disabled";
      url.value = value === "invalid" ? "http://user:secret@stickers.example.test/smoji.json?token=demo" : "https://cdn.example.test/ecoku/smoji.json";
      url.setAttribute("aria-invalid", String(value === "invalid"));
      error.hidden = value !== "invalid";
    }
    scenario.addEventListener("change", applyScenario);
    enabled.addEventListener("change", () => {
      row.hidden = !enabled.checked;
      if (!enabled.checked) scenario.value = "disabled";
    });
    document.querySelector(".admin-site-form").addEventListener("submit", (event) => event.preventDefault());
    applyScenario();
  }

  initCommentCandidate();
  initAdminCandidate();
})();
