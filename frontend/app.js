const state = {
  skills: [],
  tweets: [],
  matches: [],
  will: null,
  tweetInput: {
    text: "",
    visibility: "private",
  },
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

// ---- つぶやきストレージ（ローカル専用）
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
      // localStorageが利用できない場合は何もしない
    }
  },
};

async function loadFixtures() {
  const [skillsRes, tweetsRes, matchesRes, willRes] = await Promise.all([
    fetch("./fixtures/skills.json"),
    fetch("./fixtures/tweets.json"),
    fetch("./fixtures/matches.json"),
    fetch("./fixtures/will.json"),
  ]);
  state.skills = await skillsRes.json();
  const tweets = await tweetsRes.json();
  state.tweets = tweetStorage.load(tweets);
  state.matches = await matchesRes.json();
  state.will = await willRes.json();
}

function renderWill() {
  const box = document.getElementById("will-box");
  if (!state.will) return;
  box.innerHTML = `
    <div class="label">Will（目標設定）</div>
    <div>Goal: ${state.will.timeline}</div>
    <div>現在のステータス: 順張り系経路探索中</div>
    <div>Traits: ${state.will.traits.join(" / ")}</div>
  `;
}

function renderSkills() {
  const container = document.getElementById("skills");
  container.innerHTML = "";
  state.skills.forEach((skill) => {
    const baseWidth = Math.min(100, skill.level);
    const deltaWidth = Math.min(100, skill.level + skill.delta_today) - baseWidth;
    const wrapper = document.createElement("div");
    wrapper.className = "skill";
    wrapper.innerHTML = `
      <div class="skill-label">
        <span>${skill.name}</span>
        <span class="mono">${skill.level}pt <span style="color:#36c65f;">+${skill.delta_today}pt</span></span>
      </div>
      <div class="bar">
        <div class="base" style="width:${baseWidth}%;"></div>
        <div class="delta" style="left:${baseWidth}%; width:${deltaWidth}%;"></div>
      </div>
      <div class="note">推奨アクション: ${skill.recommended_action}</div>
    `;
    container.appendChild(wrapper);
  });
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

function renderDaily() {
  const totalEl = document.getElementById("daily-total");
  const draftEl = document.getElementById("daily-draft");
  const total = state.tweets.reduce((sum, t) => sum + (t.gained_points || 0), 0);
  totalEl.textContent = `Total: +${total}pt`;
  const last = state.tweets[state.tweets.length - 1];
  draftEl.textContent = last
    ? `今日: ${last.text} / 抽出: ${[...last.extracted_skills, ...last.extracted_stance].join(", ")}`
    : "日報ドラフトをここに表示します。";
}

function renderMatches() {
  const tagBox = document.getElementById("match-tags");
  const list = document.getElementById("matches");
  const tags = new Set();
  state.matches.forEach((m) => m.common_tags.forEach((t) => tags.add(t)));
  tagBox.innerHTML = Array.from(tags)
    .map((t) => `<span class="pill">${t}</span>`)
    .join("");

  list.innerHTML = "";
  state.matches.forEach((m) => {
    const item = document.createElement("div");
    item.className = "match-item";
    item.innerHTML = `
      <div class="name">${m.name}</div>
      <div class="role">${m.role}</div>
      <div class="chips">${m.common_tags.map((t) => `<span class="pill">${t}</span>`).join("")}</div>
      <div style="margin-top:8px;"><button class="ghost-small" type="button" data-msg="${m.message_suggestion}">メッセージ案を表示</button></div>
    `;
    item.querySelector("button").addEventListener("click", () => {
      alert(m.message_suggestion);
    });
    list.appendChild(item);
  });
}

function applyRule(text, visibility) {
  for (const rule of keywordRules) {
    if (rule.words.some((w) => text.includes(w))) {
      return {
        extracted_skills: [rule.skill],
        extracted_stance: [rule.stance],
        gained_points: rule.points,
        delta: rule.delta,
        visibility,
      };
    }
  }
  return {
    extracted_skills: [],
    extracted_stance: [],
    gained_points: 2,
    delta: 1,
    visibility,
  };
}

function handleTweetSubmit() {
  const textarea = document.getElementById("tweet-text");
  const text = textarea.value.trim();
  if (!text) return;
  const visibility = document.querySelector("input[name='visibility']:checked")?.value || "private";
  const result = applyRule(text, visibility);

  // update tweets
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

  // update skills delta
  result.extracted_skills.forEach((s) => {
    const target = state.skills.find((sk) => sk.name.includes(s));
    if (target) {
      target.delta_today += result.delta;
    }
  });

  textarea.value = "";
  renderTweets();
  renderAnalysis(newTweet);
  renderSkills();
  renderDaily();
}

function bindEvents() {
  document.getElementById("tweet-submit").addEventListener("click", handleTweetSubmit);
}

async function init() {
  await loadFixtures();
  renderWill();
  renderSkills();
  renderTweets();
  renderAnalysis(state.tweets[state.tweets.length - 1]);
  renderDaily();
  renderMatches();
  bindEvents();
}

document.addEventListener("DOMContentLoaded", init);
