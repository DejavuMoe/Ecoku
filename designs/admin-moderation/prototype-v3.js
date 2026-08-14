(() => {
  "use strict";

  const elements = {
    open: document.getElementById("site-settings-button"),
    dialog: document.getElementById("site-settings-dialog"),
    form: document.getElementById("site-settings-form"),
    siteName: document.getElementById("settings-site-name"),
    siteTriggerLabel: document.getElementById("site-trigger-label"),
    emailRequired: document.getElementById("settings-email-required"),
    websiteRequired: document.getElementById("settings-website-required"),
    placeholder: document.getElementById("settings-placeholder"),
    preview: document.getElementById("settings-preview"),
    cancel: document.getElementById("cancel-settings"),
    save: document.getElementById("save-settings"),
    toast: document.getElementById("toast"),
    live: document.getElementById("live-region")
  };

  const settingsBySite = new Map();
  let lastTrigger = null;
  let toastTimer = 0;

  const currentSite = () => elements.siteTriggerLabel.textContent.trim() || "当前站点";

  const currentSettings = () => settingsBySite.get(currentSite()) ?? {
    emailRequired: true,
    websiteRequired: false,
    placeholder: "写下评论（仅支持纯文本）"
  };

  const announce = (message) => {
    elements.live.textContent = "";
    window.setTimeout(() => {
      elements.live.textContent = message;
    }, 20);
  };

  const showToast = (message) => {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    toastTimer = window.setTimeout(() => {
      elements.toast.hidden = true;
    }, 2800);
    announce(message);
  };

  const syncPreview = () => {
    elements.preview.textContent = [
      "昵称必填",
      elements.emailRequired.checked ? "邮箱必填" : "邮箱可选",
      elements.websiteRequired.checked ? "网址必填" : "网址可选"
    ].join(" · ");
  };

  const openDialog = () => {
    lastTrigger = document.activeElement;
    const config = currentSettings();
    elements.siteName.textContent = currentSite();
    elements.emailRequired.checked = config.emailRequired;
    elements.websiteRequired.checked = config.websiteRequired;
    elements.placeholder.value = config.placeholder;
    syncPreview();
    elements.dialog.showModal();
    window.setTimeout(() => elements.emailRequired.focus(), 0);
  };

  elements.open.addEventListener("click", openDialog);
  elements.emailRequired.addEventListener("change", syncPreview);
  elements.websiteRequired.addEventListener("change", syncPreview);

  elements.save.addEventListener("click", (event) => {
    event.preventDefault();
    settingsBySite.set(currentSite(), {
      emailRequired: elements.emailRequired.checked,
      websiteRequired: elements.websiteRequired.checked,
      placeholder: elements.placeholder.value.trim()
    });
    elements.dialog.close("save");
    showToast("站点评论表单设置已保存。");
  });

  elements.cancel.addEventListener("click", () => {
    elements.dialog.close("cancel");
  });

  elements.dialog.addEventListener("close", () => {
    if (lastTrigger instanceof HTMLElement) lastTrigger.focus();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && elements.dialog.open) {
      elements.dialog.close("cancel");
    }
  });
})();
