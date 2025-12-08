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

const tweetStorage = {
  key: "tsubunavi:tweets",
  load(fallback) {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      return fallback;
    } catch (e) {
      return fallback;
    }
  },
  save(tweets) {
    try {
      localStorage.setItem(this.key, JSON.stringify(tweets));
    } catch (e) {
      // noop
    }
  },
};

async function loadTweets() {
  const res = await fetch("./fixtures/tweets.json");
  const fallback = await res.json();
  state.tweets = tweetStorage.load(fallback);
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
  const text = textarea.value.trim();
  if (!text) return;
  const visibility = document.querySelector("input[name='visibility']:checked")?.value || "private";
  const result = applyRule(text, visibility);

  const newTweet = {
    id: `tweet-${Date.now()}`,
    text,
    visibility,
    extracted_skills: result.extracted_skills,
    extracted_stance: result.extracted_stance,
    gained_points: result.gained_points,
  };
  state.tweets.push(newTweet);
  tweetStorage.save(state.tweets);

  textarea.value = "";
  renderTweets();
  renderAnalysis(newTweet);
}

function bindEvents() {
  document.getElementById("tweet-submit").addEventListener("click", handleTweetSubmit);
}

async function init() {
  await loadTweets();
  renderTweets();
  renderAnalysis(state.tweets[state.tweets.length - 1]);
  bindEvents();
}

document.addEventListener("DOMContentLoaded", init);
