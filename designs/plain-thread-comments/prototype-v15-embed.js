(() => {
  "use strict";

  const shell = document.getElementById("embed-shell");
  const loader = document.getElementById("embed-loader");
  const status = document.getElementById("embed-status");
  const retry = document.getElementById("embed-retry");
  const unconfigured = document.getElementById("embed-unconfigured");
  const mount = document.getElementById("embed-mount");
  const failButton = document.getElementById("loader-fail-toggle");
  const unconfiguredButton = document.getElementById("unconfigured-toggle");
  const FAIL_MESSAGE = "评论服务初始化失败，请稍后重试。";

  const setState = (state) => {
    const isFail = state === "fail";
    const isUnconfigured = state === "unconfigured";
    shell.dataset.embedState = state;
    shell.setAttribute("aria-busy", "false");
    loader.hidden = !isFail;
    status.textContent = isFail ? FAIL_MESSAGE : "";
    retry.hidden = !isFail;
    unconfigured.hidden = !isUnconfigured;
    mount.hidden = isFail || isUnconfigured;
    failButton.setAttribute("aria-pressed", String(isFail));
    unconfiguredButton.setAttribute("aria-pressed", String(isUnconfigured));
  };

  failButton.addEventListener("click", () => {
    setState(shell.dataset.embedState === "fail" ? "ready" : "fail");
  });
  unconfiguredButton.addEventListener("click", () => {
    setState(shell.dataset.embedState === "unconfigured" ? "ready" : "unconfigured");
  });
  retry.addEventListener("click", () => setState("ready"));
})();
