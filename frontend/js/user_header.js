(() => {
  const STORAGE_USER_KEY = "tsubunavi_user_id";
  const DEFAULT_USER_NAME = "田中 健太";

  function resolveUserName() {
    const stored = localStorage.getItem(STORAGE_USER_KEY);
    const trimmed = stored ? stored.trim() : "";
    return trimmed || DEFAULT_USER_NAME;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const el = document.getElementById("userName");
    if (el) el.textContent = resolveUserName();
  });
})();
