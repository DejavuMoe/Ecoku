(() => {
  "use strict";

  // Revision 17 adds the production composer tools (sticker picker and preview) so the
  // paper-and-ink footer can be reviewed as it ships. Fixtures stay local and nothing persists.
  const PACKS = [
    {
      label: "猫猫",
      items: [
        { label: "挥手", src: "../smoji-candidate/fixtures/cat-wave.svg" },
        { label: "开心", src: "../smoji-candidate/fixtures/cat-happy.svg" },
        { label: "思考", src: "../smoji-candidate/fixtures/cat-thinking.svg" }
      ]
    },
    {
      label: "纸片",
      items: [
        { label: "谢谢", src: "../smoji-candidate/fixtures/paper-thanks.svg" },
        { label: "收到", src: "../smoji-candidate/fixtures/paper-ok.svg" }
      ]
    }
  ];
  const MARKER = /!\[smoji:([^\]\r\n]+)\]\(([^()\s]+)\)/g;
  const knownSources = new Set(PACKS.flatMap((pack) => pack.items.map((item) => item.src)));

  const createElement = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  const renderPreview = (preview, content) => {
    preview.replaceChildren();
    const text = content.trim();
    if (!text) {
      preview.textContent = "暂无可预览内容。";
      return;
    }
    let cursor = 0;
    for (const match of text.matchAll(MARKER)) {
      preview.append(document.createTextNode(text.slice(cursor, match.index)));
      if (knownSources.has(match[2])) {
        const image = createElement("img", "smoji-inline");
        image.src = match[2];
        image.alt = `[表情：${match[1]}]`;
        preview.append(image);
      } else {
        preview.append(document.createTextNode(match[0]));
      }
      cursor = match.index + match[0].length;
    }
    preview.append(document.createTextNode(text.slice(cursor)));
  };

  const closePanel = (control) => {
    const panel = control.querySelector(".smoji-panel");
    const trigger = control.querySelector(".smoji-trigger");
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  };

  const showPack = (panel, index) => {
    const grid = panel.querySelector(".smoji-grid");
    grid.replaceChildren();
    PACKS[index].items.forEach((item) => {
      const button = createElement("button", "smoji-item");
      button.type = "button";
      button.title = item.label;
      button.dataset.label = item.label;
      button.dataset.src = item.src;
      const image = createElement("img");
      image.src = item.src;
      image.alt = item.label;
      button.append(image);
      grid.append(button);
    });
    panel.querySelectorAll(".smoji-tab").forEach((tab, tabIndex) => {
      tab.setAttribute("aria-selected", String(tabIndex === index));
    });
  };

  const populate = (panel) => {
    if (panel.dataset.loaded === "true") return;
    const tabs = createElement("div", "smoji-tabs");
    tabs.setAttribute("role", "tablist");
    PACKS.forEach((pack, index) => {
      const tab = createElement("button", "smoji-tab", pack.label);
      tab.type = "button";
      tab.setAttribute("role", "tab");
      tab.dataset.pack = String(index);
      tabs.append(tab);
    });
    const grid = createElement("div", "smoji-grid");
    grid.setAttribute("role", "tabpanel");
    panel.replaceChildren(tabs, grid);
    panel.dataset.loaded = "true";
    showPack(panel, 0);
  };

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    document.querySelectorAll(".smoji-control").forEach((control) => {
      if (!control.contains(target)) closePanel(control);
    });

    const previewTrigger = target.closest(".preview-trigger");
    if (previewTrigger) {
      const form = previewTrigger.closest("form");
      const preview = form?.querySelector(".composer-preview");
      const textarea = form?.querySelector("textarea");
      if (!preview || !textarea) return;
      const opening = preview.hidden;
      preview.hidden = !opening;
      previewTrigger.setAttribute("aria-pressed", String(opening));
      if (opening) renderPreview(preview, textarea.value);
      return;
    }

    const smojiTrigger = target.closest(".smoji-trigger");
    if (smojiTrigger) {
      const control = smojiTrigger.closest(".smoji-control");
      const panel = control.querySelector(".smoji-panel");
      const opening = panel.hidden;
      populate(panel);
      panel.hidden = !opening;
      smojiTrigger.setAttribute("aria-expanded", String(opening));
      if (opening) panel.focus();
      return;
    }

    const tab = target.closest(".smoji-tab");
    if (tab) {
      showPack(tab.closest(".smoji-panel"), Number(tab.dataset.pack));
      return;
    }

    const item = target.closest(".smoji-item");
    if (item) {
      const form = item.closest("form");
      const textarea = form?.querySelector("textarea");
      if (!textarea) return;
      const marker = `![smoji:${item.dataset.label}](${item.dataset.src})`;
      const start = textarea.selectionStart ?? textarea.value.length;
      const end = textarea.selectionEnd ?? start;
      textarea.setRangeText(marker, start, end, "end");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      closePanel(item.closest(".smoji-control"));
      textarea.focus();
    }
  });

  document.addEventListener("input", (event) => {
    const textarea = event.target;
    if (!(textarea instanceof HTMLTextAreaElement)) return;
    const preview = textarea.closest("form")?.querySelector(".composer-preview");
    if (preview && !preview.hidden) renderPreview(preview, textarea.value);
  });
})();
