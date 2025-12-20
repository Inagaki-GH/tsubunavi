(function () {
  const API_BASE = window.API_CONFIG?.baseUrl || null;
  const API_TOKEN = window.API_CONFIG?.token || null;
  const API_MODE = (window.API_CONFIG?.mode || "local").toLowerCase();
  const USE_API = API_MODE === "api" && API_BASE && API_TOKEN;

  const samplePayload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: "今日の学びを1文で要約して",
      },
    ],
  };

  function init() {
    setApiStatus(USE_API ? `API mode (${API_BASE})` : "Local mode");
    const payloadEl = document.getElementById("ai-payload");
    if (payloadEl) payloadEl.value = JSON.stringify(samplePayload, null, 2);
    bindEvents();
  }

  function bindEvents() {
    const submitBtn = document.getElementById("ai-submit");
    const resetBtn = document.getElementById("ai-reset");
    if (submitBtn) submitBtn.addEventListener("click", handleExecute);
    if (resetBtn) resetBtn.addEventListener("click", resetSample);
  }

  function resetSample() {
    const payloadEl = document.getElementById("ai-payload");
    if (payloadEl) payloadEl.value = JSON.stringify(samplePayload, null, 2);
    setStatus("サンプルを復元しました");
  }

  async function handleExecute() {
    if (!USE_API) {
      setApiStatus("API modeを有効にしてください");
      return;
    }
    const modelEl = document.getElementById("ai-model");
    const payloadEl = document.getElementById("ai-payload");
    const responseEl = document.getElementById("ai-response");
    const rawPayload = payloadEl?.value || "";

    let payload;
    try {
      payload = JSON.parse(rawPayload);
    } catch (e) {
      setStatus("payloadがJSONではありません");
      if (responseEl) responseEl.value = String(e.message || e);
      return;
    }

    const requestBody = {
      payload,
    };
    const modelId = (modelEl?.value || "").trim();
    if (modelId) requestBody.model_id = modelId;

    setStatus("実行中...");
    if (responseEl) responseEl.value = "実行中...";
    try {
      const res = await fetch(`${API_BASE}/ai/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify(requestBody),
      });
      if (!res.ok) throw new Error(`request failed: ${res.status}`);
      const data = await res.json();
      if (responseEl) responseEl.value = JSON.stringify(data, null, 2);
      setStatus("完了");
    } catch (e) {
      if (responseEl) responseEl.value = String(e.message || e);
      setStatus("失敗");
    }
  }

  function setApiStatus(text) {
    const el = document.getElementById("api-status");
    if (el) el.textContent = text;
  }

  function setStatus(text) {
    const el = document.getElementById("ai-status");
    if (el) el.textContent = text;
  }

  document.addEventListener("DOMContentLoaded", init);
})();
