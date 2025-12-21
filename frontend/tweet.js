(function () {
  const API_BASE = window.API_CONFIG?.baseUrl || null;
  const API_TOKEN = window.API_CONFIG?.token || null;
  const API_MODE = (window.API_CONFIG?.mode || "local").toLowerCase();
  const USE_API = API_MODE === "api" && API_BASE && API_TOKEN;
  const STORAGE_USER_KEY = "tsubunavi_user_id";
  const DEFAULT_USER_ID = "user_12345";

  const state = {
    tweets: [],
  };

  const visibilityLabel = {
    private: "プライベート",
    public: "公開",
  };

  const keywordRules = [
    { words: ["バグ", "不具合", "デグレ"], skill: "問題解決", stance: "自省", delta: 2, points: 15 },
    { words: ["顧客", "提案", "商談"], skill: "顧客折衝", stance: "本質志向", delta: 2, points: 10 },
    { words: ["設計", "レビュー"], skill: "設計力", stance: "丁寧さ", delta: 2, points: 8 },
  ];

  async function loadTweets() {
    if (USE_API) {
      setApiStatus(`API mode (${API_BASE}) - fetching...`);
      await fetchTweetsFromApi();
    } else {
      const res = await fetch("./fixtures/tweets.json");
      const fallback = await res.json();
      state.tweets = normalizeTweets(fallback);
      setApiStatus("Local mode (fixturesのみ)");
    }
  }

  function renderTweets() {
    const list = document.getElementById("tweet-list");
    list.innerHTML = "";
    state.tweets.slice().reverse().forEach((t) => {
      const item = document.createElement("div");
      item.className = "tweet-item";
      item.innerHTML = `
        <div class="tweet-meta">visibility: ${visibilityLabel[t.visibility] || "-"}</div>
        <div class="tweet-text">${t.text}</div>
        <div class="chips">
          ${t.extracted_skills.map((s) => `<span class="pill">${s}</span>`).join("")}
          ${t.extracted_stance.map((s) => `<span class="pill">${s}</span>`).join("")}
        </div>
        <div class="tweet-meta">経験値: +${t.gained_points}pt</div>
      `;
      list.appendChild(item);
    });
  }

  function renderAnalysis(last) {
    const pointsEl = document.getElementById("analysis-points");
    const skillsEl = document.getElementById("analysis-skills");
    const stanceEl = document.getElementById("analysis-stance");
    if (!last) {
      pointsEl.textContent = "経験値: +0pt";
      skillsEl.textContent = "抽出スキルタグ: -";
      stanceEl.textContent = "抽出スタンスタグ: -";
      return;
    }
    pointsEl.textContent = `経験値: +${last.gained_points}pt`;
    skillsEl.textContent = `抽出スキルタグ: ${last.extracted_skills.join(", ") || "-"}`;
    stanceEl.textContent = `抽出スタンスタグ: ${last.extracted_stance.join(", ") || "-"}`;
  }

  function applyRule(text, visibility) {
    for (const rule of keywordRules) {
      if (rule.words.some((w) => text.includes(w))) {
        return {
          extracted_skills: [rule.skill],
          extracted_stance: [rule.stance],
          gained_points: rule.points,
          visibility,
        };
      }
    }
    return {
      extracted_skills: [],
      extracted_stance: [],
      gained_points: 2,
      visibility,
    };
  }

  function handleTweetSubmit() {
    const textarea = document.getElementById("tweet-text");
    if (!textarea) {
      console.warn("tweet-submit: textarea not found");
      return;
    }
    const raw = textarea.value;
    const text = raw; // トリムせずそのまま送信
    console.debug("tweet-submit: input", { raw, text, rawLen: raw.length });
    const visibility = document.querySelector("input[name='visibility']:checked")?.value || "private";
    const result = applyRule(text.trim(), visibility);

    const newTweet = {
      id: `tweet-${Date.now()}`,
      text,
      visibility,
      extracted_skills: result.extracted_skills,
      extracted_stance: result.extracted_stance,
      gained_points: result.gained_points,
    };
    if (USE_API) {
      console.debug("tweet-submit: post to API", { text, visibility });
      const payload = {
        text,
        visibility,
        mode: "memo",
      };
      postTweetToApi(payload).then((created) => {
        if (created) {
          // merge timestamp/id from API with local analysis fields
          const merged = {
            ...newTweet,
            id: created.id || newTweet.id,
            timestamp: created.timestamp,
          };
          state.tweets.push(merged);
          textarea.value = "";
          renderTweets();
          renderAnalysis(merged);
        } else {
          console.warn("tweet-submit: post returned null");
        }
      });
    } else {
      console.warn("tweet-submit: API mode is off. Enable config.js mode=api to send.");
      setApiStatus("API modeを有効にしてください");
    }
  }

  function bindEvents() {
    document.getElementById("tweet-submit").addEventListener("click", handleTweetSubmit);
    const reportBtn = document.getElementById("report-generate");
    const reportDate = document.getElementById("report-date");
    if (reportDate) reportDate.value = today();
    if (reportBtn) reportBtn.addEventListener("click", handleReportGenerate);
  }

  async function init() {
    setApiStatus(USE_API ? `API mode (${API_BASE})` : "Local mode");
    await loadTweets();
    renderTweets();
    renderAnalysis(state.tweets[state.tweets.length - 1]);
    bindEvents();
  }

  document.addEventListener("DOMContentLoaded", init);

  async function fetchTweetsFromApi() {
    try {
      const userId = localStorage.getItem(STORAGE_USER_KEY) || DEFAULT_USER_ID;
      const res = await fetch(`${API_BASE}/tweets?userId=${encodeURIComponent(userId)}`, {
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
        },
      });
      if (!res.ok) throw new Error(`fetch tweets failed: ${res.status}`);
      const data = await res.json();
      state.tweets = normalizeTweets(data);
      setApiStatus(`API ok (${state.tweets.length} items)`);
    } catch (e) {
      console.warn("API fetch failed", e);
      setApiStatus(`API error: ${e.message}`);
      state.tweets = [];
    }
  }

  async function postTweetToApi(payload) {
    try {
      const userId = localStorage.getItem(STORAGE_USER_KEY) || DEFAULT_USER_ID;
      const res = await fetch(`${API_BASE}/tweets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({ ...payload, userId }),
      });
      if (!res.ok) throw new Error(`post tweet failed: ${res.status}`);
      const created = await res.json();
      setApiStatus("API ok (posted)");
      return created;
    } catch (e) {
      console.warn("API post failed", e);
      setApiStatus(`API error: ${e.message}`);
      return null;
    }
  }

  function setApiStatus(text) {
    const el = document.getElementById("api-status");
    if (el) el.textContent = text;
  }

  function normalizeTweets(list) {
    if (!Array.isArray(list)) return [];
    return list.map((t) => ({
      id: t.id,
      text: t.text || "",
      visibility: t.visibility || "private",
      timestamp: t.timestamp,
      extracted_skills: t.extracted_skills || [],
      extracted_stance: t.extracted_stance || [],
      gained_points: t.gained_points || 0,
    }));
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  async function handleReportGenerate() {
    if (!USE_API) {
      setApiStatus("API modeを有効にしてください");
      return;
    }
    const dateInput = document.getElementById("report-date");
    const draftArea = document.getElementById("report-draft");
    const date = dateInput?.value || today();
    setApiStatus(`日報作成中 (${date})`);
    if (draftArea) draftArea.value = "生成中...";
    try {
      const res = await fetch(`${API_BASE}/reports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({ date }),
      });
      if (!res.ok) throw new Error(`report failed: ${res.status}`);
      const data = await res.json();
      if (draftArea) draftArea.value = data.report || "";
      setApiStatus("API ok (report)");
    } catch (e) {
      console.warn("report generation failed", e);
      if (draftArea) draftArea.value = "生成に失敗しました";
      setApiStatus(`API error: ${e.message}`);
    }
  }
})();
