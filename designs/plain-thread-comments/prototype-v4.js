(() => {
  "use strict";

  const elements = {
    controls: document.querySelector(".preview-controls"),
    toggle: document.getElementById("form-config-toggle"),
    panel: document.getElementById("form-config-panel"),
    emailRequired: document.getElementById("config-email-required"),
    websiteRequired: document.getElementById("config-website-required"),
    placeholder: document.getElementById("config-placeholder"),
    requirements: document.getElementById("identity-requirements"),
    form: document.getElementById("comment-form"),
    nickname: document.getElementById("nickname"),
    email: document.getElementById("email"),
    website: document.getElementById("website"),
    comment: document.getElementById("comment-input"),
    submit: document.getElementById("submit-button"),
    count: document.getElementById("character-count"),
    error: document.getElementById("form-error"),
    status: document.getElementById("status-line")
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

  const settings = () => ({
    emailRequired: elements.emailRequired.checked,
    websiteRequired: elements.websiteRequired.checked,
    placeholder: elements.placeholder.value.trim() || "写下评论（仅支持纯文本）"
  });

  const validate = (showError = false) => {
    const config = settings();
    const nicknameReady = elements.nickname.value.trim().length > 0;
    const emailValue = elements.email.value.trim();
    const emailReady = (!config.emailRequired && emailValue.length === 0)
      || (emailValue.length > 0 && elements.email.validity.valid);
    const websiteValue = elements.website.value.trim();
    const websiteReady = (!config.websiteRequired && websiteValue.length === 0)
      || safeWebsite(websiteValue) !== null;
    const commentReady = elements.comment.value.trim().length > 0;
    const ready = nicknameReady && emailReady && websiteReady && commentReady;

    elements.submit.disabled = !ready;
    elements.count.textContent = `${elements.comment.value.length}/1000`;

    if (!showError || ready) {
      elements.error.hidden = true;
      elements.error.textContent = "";
      return ready;
    }

    if (!nicknameReady) {
      elements.error.textContent = "请输入昵称。";
      elements.nickname.focus();
    } else if (!emailReady) {
      elements.error.textContent = config.emailRequired ? "请输入有效邮箱。" : "邮箱格式不正确。";
      elements.email.focus();
    } else if (!websiteReady) {
      elements.error.textContent = config.websiteRequired
        ? "请输入以 http:// 或 https:// 开头的网址。"
        : "网址需要以 http:// 或 https:// 开头。";
      elements.website.focus();
    } else {
      elements.error.textContent = "评论内容不能为空。";
      elements.comment.focus();
    }
    elements.error.hidden = false;
    return false;
  };

  const applySettings = () => {
    const config = settings();
    elements.email.required = config.emailRequired;
    elements.website.required = config.websiteRequired;
    elements.website.removeAttribute("placeholder");
    elements.comment.placeholder = config.placeholder;
    elements.requirements.textContent = [
      "昵称必填",
      config.emailRequired ? "邮箱必填" : "邮箱可选",
      config.websiteRequired ? "网址必填" : "网址可选"
    ].join(" · ");
    validate(false);
  };

  const setPanelOpen = (open) => {
    elements.panel.hidden = !open;
    elements.controls.dataset.settingsOpen = String(open);
    elements.toggle.setAttribute("aria-expanded", String(open));
    if (open) elements.emailRequired.focus();
  };

  elements.toggle.addEventListener("click", () => {
    setPanelOpen(elements.toggle.getAttribute("aria-expanded") !== "true");
  });

  [elements.emailRequired, elements.websiteRequired].forEach((control) => {
    control.addEventListener("change", applySettings);
  });
  elements.placeholder.addEventListener("input", applySettings);

  [elements.nickname, elements.email, elements.website, elements.comment].forEach((control) => {
    control.addEventListener("input", () => validate(false));
  });

  elements.form.addEventListener("submit", (event) => {
    const config = settings();
    const optionalEmailIsEmpty = !config.emailRequired && elements.email.value.trim().length === 0;
    if (!optionalEmailIsEmpty) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    if (!validate(true)) return;

    elements.comment.value = "";
    validate(false);
    elements.status.textContent = "评论已提交；空邮箱会按未提供处理。";
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.panel.hidden) {
      setPanelOpen(false);
      elements.toggle.focus();
    }
  });

  applySettings();
})();
