(() => {
  const STORAGE_KEY = "tsubunavi_user_id";

  function handleLogin() {
    const input = document.getElementById("login-username");
    const userId = (input?.value || "").trim();
    if (!userId) {
      alert("ユーザーIDを入力してください");
      return;
    }
    localStorage.setItem(STORAGE_KEY, userId);
    location.href = "home_tsubunavi.html";
  }

  document.getElementById("login-submit")?.addEventListener("click", handleLogin);
})();
