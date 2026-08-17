(() => {
  "use strict";

  const providerSelect = document.getElementById("config-captcha-provider");
  const legacyTurnstileEnabled = document.getElementById("config-turnstile-enabled");
  const turnstilePreviewControls = Array.from(document.querySelectorAll("[data-turnstile-preview]"));
  const capPreviewControls = Array.from(document.querySelectorAll("[data-cap-preview]"));
  const capFailure = document.getElementById("config-cap-fail");
  const commentSection = document.getElementById("comment-section");
  const capTimers = new WeakMap();

  if (!(providerSelect instanceof HTMLSelectElement) || !(legacyTurnstileEnabled instanceof HTMLInputElement)) {
    throw new Error("CAPTCHA provider preview controls are unavailable.");
  }

  const provider = () => providerSelect.value === "turnstile"
    ? "turnstile"
    : providerSelect.value === "cap"
      ? "cap"
      : "off";

  const createElement = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  const createSVG = (className, viewBox) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", className);
    svg.setAttribute("viewBox", viewBox);
    return svg;
  };

  const setCapState = (slot, next) => {
    const widget = slot.querySelector("cap-widget.ecoku-cap-prototype");
    if (!widget) return;
    widget.dataset.state = next;
    slot.dataset.state = next;
    const trigger = widget.querySelector(".cap-prototype-trigger");
    const captcha = widget.querySelector(".cap-prototype-captcha");
    const label = widget.querySelector(".cap-prototype-label");
    if (!(trigger instanceof HTMLButtonElement) || !captcha || !label) return;

    trigger.disabled = next === "verifying";
    if (next === "verifying") {
      captcha.dataset.state = "verifying";
      label.textContent = "正在验证…";
      trigger.setAttribute("aria-label", "正在进行真人验证，请稍候");
      return;
    }
    if (next === "solved") {
      captcha.dataset.state = "done";
      label.textContent = "验证已完成";
      trigger.setAttribute("aria-label", "真人验证已通过");
      return;
    }
    if (next === "error") {
      captcha.dataset.state = "error";
      label.textContent = "验证失败，请重试";
      trigger.setAttribute("aria-label", "验证失败，请重试");
      return;
    }
    delete captcha.dataset.state;
    label.textContent = "点击进行真人验证";
    trigger.setAttribute("aria-label", "点击进行真人验证");
  };

  const mountCap = (slot) => {
    if (slot.querySelector("cap-widget.ecoku-cap-prototype")) return;
    const previous = capTimers.get(slot);
    if (previous) window.clearTimeout(previous);

    slot.hidden = false;
    slot.dataset.captchaProvider = "cap";
    // Keep the legacy v13 observer satisfied while this review candidate layers Cap on top.
    slot.dataset.kind = "off";
    slot.dataset.mounted = "true";

    const widget = createElement("cap-widget", "ecoku-cap-prototype");
    widget.dataset.state = "idle";
    widget.dataset.prototypeOnly = "true";
    widget.setAttribute("required", "");
    widget.setAttribute("data-cap-api-endpoint", "https://cap.example.com/SITE_KEY/");
    widget.setAttribute("data-cap-disable-haptics", "");
    widget.setAttribute("data-cap-i18n-initial-state", "点击进行真人验证");
    widget.setAttribute("data-cap-i18n-verifying-label", "正在验证…");
    widget.setAttribute("data-cap-i18n-solved-label", "验证已完成");
    widget.setAttribute("data-cap-i18n-error-label", "验证失败，请重试");
    widget.setAttribute("data-cap-i18n-verify-aria-label", "点击进行真人验证");
    widget.setAttribute("data-cap-i18n-verifying-aria-label", "正在进行真人验证，请稍候");
    widget.setAttribute("data-cap-i18n-verified-aria-label", "真人验证已通过");
    widget.setAttribute("data-cap-i18n-required-label", "请先完成人机验证");
    widget.setAttribute("data-cap-i18n-error-aria-label", "验证失败，请重试");

    const captcha = createElement("div", "cap-prototype-captcha");
    const trigger = createElement("button", "cap-prototype-trigger");
    trigger.type = "button";
    const checkbox = createElement("span", "cap-prototype-checkbox");
    checkbox.setAttribute("aria-hidden", "true");
    const progress = createSVG("cap-prototype-progress-ring", "0 0 32 32");
    const progressBackground = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    progressBackground.setAttribute("class", "cap-prototype-progress-ring-bg");
    progressBackground.setAttribute("cx", "16");
    progressBackground.setAttribute("cy", "16");
    progressBackground.setAttribute("r", "14");
    const progressCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    progressCircle.setAttribute("class", "cap-prototype-progress-ring-circle");
    progressCircle.setAttribute("cx", "16");
    progressCircle.setAttribute("cy", "16");
    progressCircle.setAttribute("r", "14");
    progress.append(progressBackground, progressCircle);

    const checkmark = createSVG("cap-prototype-state-icon cap-prototype-checkmark", "0 0 24 24");
    const checkmarkPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    checkmarkPath.setAttribute("d", "m5 12 5 5L20 7");
    checkmarkPath.setAttribute("fill", "none");
    checkmarkPath.setAttribute("stroke", "currentColor");
    checkmarkPath.setAttribute("stroke-linecap", "round");
    checkmarkPath.setAttribute("stroke-linejoin", "round");
    checkmarkPath.setAttribute("stroke-width", "2");
    checkmark.appendChild(checkmarkPath);

    const errorIcon = createSVG("cap-prototype-state-icon cap-prototype-error-icon", "0 0 24 24");
    const errorCircle = document.createElementNS("http://www.w3.org/2000/svg", "path");
    errorCircle.setAttribute("d", "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z");
    errorCircle.setAttribute("fill", "none");
    errorCircle.setAttribute("stroke", "currentColor");
    errorCircle.setAttribute("stroke-width", "1.8");
    const errorMark = document.createElementNS("http://www.w3.org/2000/svg", "path");
    errorMark.setAttribute("d", "M12 7v6M12 16.5v.5");
    errorMark.setAttribute("fill", "none");
    errorMark.setAttribute("stroke", "currentColor");
    errorMark.setAttribute("stroke-linecap", "round");
    errorMark.setAttribute("stroke-width", "2");
    errorIcon.append(errorCircle, errorMark);

    checkbox.append(progress, checkmark, errorIcon);
    const labelWrapper = createElement("span", "cap-prototype-label-wrapper");
    const label = createElement("span", "cap-prototype-label", "点击进行真人验证");
    labelWrapper.appendChild(label);
    trigger.append(checkbox, labelWrapper);
    const credits = createElement("span", "cap-prototype-credits", "Cap");
    credits.setAttribute("aria-hidden", "true");
    captcha.append(trigger, credits);
    widget.appendChild(captcha);
    slot.replaceChildren(widget);

    trigger.addEventListener("click", () => {
      if (widget.dataset.state === "verifying" || widget.dataset.state === "solved") return;
      setCapState(slot, "verifying");
      const timer = window.setTimeout(() => {
        setCapState(slot, capFailure?.checked ? "error" : "solved");
      }, 760);
      capTimers.set(slot, timer);
    });
    setCapState(slot, "idle");
  };

  const syncCapSlots = () => {
    if (provider() !== "cap") return;
    document.querySelectorAll(".captcha-slot").forEach(mountCap);
  };

  const syncProvider = () => {
    const selected = provider();
    const turnstile = selected === "turnstile";
    const cap = selected === "cap";
    turnstilePreviewControls.forEach((control) => { control.hidden = !turnstile; });
    capPreviewControls.forEach((control) => { control.hidden = !cap; });

    if (legacyTurnstileEnabled.checked !== turnstile) {
      legacyTurnstileEnabled.checked = turnstile;
      legacyTurnstileEnabled.dispatchEvent(new Event("change", { bubbles: true }));
    }

    document.querySelectorAll(".captcha-slot").forEach((slot) => {
      if (cap) {
        mountCap(slot);
        return;
      }
      delete slot.dataset.captchaProvider;
    });
  };

  providerSelect.addEventListener("change", syncProvider);
  capFailure?.addEventListener("change", () => {
    document.querySelectorAll(".captcha-slot").forEach((slot) => {
      const timer = capTimers.get(slot);
      if (timer) window.clearTimeout(timer);
      setCapState(slot, "idle");
    });
  });

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (provider() !== "cap" || !(form instanceof HTMLFormElement) || !form.classList.contains("composer")) return;
    const slot = form.querySelector(".captcha-slot");
    if (!slot) return;
    if (slot.dataset.state === "solved") {
      window.queueMicrotask(() => setCapState(slot, "idle"));
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    const error = form.querySelector(".form-error, .reply-error");
    if (error) {
      error.textContent = slot.dataset.state === "error"
        ? "验证服务暂时不可用，请稍后重试。"
        : "请完成人机验证后再发布。";
      error.hidden = false;
    }
    slot.querySelector(".cap-prototype-trigger")?.focus();
  }, true);

  new MutationObserver(syncCapSlots).observe(commentSection, { childList: true, subtree: true });

  window.EcokuCaptchaPrototype = Object.freeze({
    provider,
    sync: syncProvider,
    states: () => Array.from(document.querySelectorAll(".captcha-slot")).map((slot) => slot.dataset.state || "idle")
  });

  syncProvider();
})();
