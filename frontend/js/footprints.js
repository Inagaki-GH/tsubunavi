const AI_ENDPOINT = (window.API_CONFIG?.aiEndpoint || window.API_CONFIG?.baseUrl || "").replace(/\/$/, "");
const AI_TOKEN = window.API_CONFIG?.aiToken || window.API_CONFIG?.token || "";
const AI_MODEL_ID = window.API_CONFIG?.modelId || "";
const USE_AI = (window.API_CONFIG?.mode || "local").toLowerCase() === "api" && AI_ENDPOINT && AI_TOKEN;

// つぶやきから苦悩を分析し、類似経験者を提案
async function analyzeTweetForStruggle(userId, tweetText) {
  try {
    if (!USE_AI) throw new Error("AI mode is disabled");
    const response = await fetch(`${AI_ENDPOINT}/ai/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_TOKEN}`
      },
      body: JSON.stringify({
        model_id: AI_MODEL_ID,
        payload: {
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 512,
          messages: [{
            role: 'user',
            content: `以下のつぶやきから苦悩を分析してJSON形式で回答してください：\n\nつぶやき: "${tweetText}"\n\n{
  "hasStruggle": true/false,
  "struggleType": "苦悩の種類",
  "suggestion": "提案文",
  "matchedUsers": [
    {"userId": "user_xxx", "userName": "〇〇さん", "similarity": "類似点"}
  ]
}`
          }]
        }
      })
    });
    
    const data = await response.json();
    const analysis = JSON.parse(data.response.content[0].text);
    
    if (analysis.hasStruggle && analysis.matchedUsers.length > 0) {
      showStruggleSuggestion(analysis);
    }
  } catch (error) {
    console.error('AI苦悩分析エラー:', error);
    // フォールバック
    const mockAnalysis = {
      hasStruggle: /難しい|困|わからない|不安|成長.*感じ|実感.*ない/.test(tweetText),
      struggleType: "成長実感なし",
      suggestion: "似た経験を持つ先輩がいます。足跡を見てみませんか？",
      matchedUsers: [
        {
          userId: "user_456",
          userName: "田中さん",
          similarity: "2年前に同じように成長実感がなく悩んでいました"
        }
      ]
    };
    
    if (mockAnalysis.hasStruggle && mockAnalysis.matchedUsers.length > 0) {
      showStruggleSuggestion(mockAnalysis);
    }
  }
}

// AI提案を表示
function showStruggleSuggestion(data) {
  // 既存の提案を削除
  const existing = document.querySelector('.struggle-suggestion');
  if (existing) existing.remove();
  
  const suggestion = document.createElement('div');
  suggestion.className = 'struggle-suggestion';
  suggestion.innerHTML = `
    <button class="close-suggestion" onclick="this.parentElement.remove()">×</button>
    <div class="ai-message">
      <p><strong>💡 ${data.suggestion}</strong></p>
      ${data.matchedUsers.map(user => `
        <div class="matched-user">
          <span>👤 ${user.userName}</span>
          <small>${user.similarity}</small>
          <button onclick="requestFootprintView('${user.userId}')" data-user="${user.userId}">足跡閲覧依頼を送る</button>
        </div>
      `).join('')}
    </div>
  `;
  document.body.appendChild(suggestion);
  
  // 10秒後に自動で消える
  setTimeout(() => {
    if (suggestion.parentElement) suggestion.remove();
  }, 10000);
}

// 足跡閲覧依頼を送信
function requestFootprintView(ownerId) {
  const requesterId = getCurrentUserId();
  
  // モック（本番ではAPI呼び出し）
  const mockResponse = {
    requestId: `req_${requesterId}_${ownerId}`,
    status: "pending",
    message: `${ownerId}に閲覧依頼を送信しました`
  };
  
  // ホーム画面に依頼を追加
  const requests = JSON.parse(localStorage.getItem('viewRequests') || '[]');
  const newRequest = {
    id: mockResponse.requestId,
    requesterName: 'あなた',
    reason: '成長の参考にさせていただきたいです',
    timestamp: Date.now()
  };
  requests.push(newRequest);
  localStorage.setItem('viewRequests', JSON.stringify(requests));
  
  alert(`✅ ${mockResponse.message}\n\n承認されると足跡が閲覧できるようになります。`);
  
  // 提案を閉じる
  const suggestion = document.querySelector('.struggle-suggestion');
  if (suggestion) suggestion.remove();
  
  // デモ用: 3秒後に自動承認して軌跡を表示
  setTimeout(() => {
    alert('🎉 閲覧が承認されました！成長の軌跡を表示します。');
    showJourney(ownerId);
  }, 3000);
}

// 閲覧依頼を承認/拒否
function respondToViewRequest(requestId, approved) {
  const message = approved ? '承認しました' : '拒否しました';
  alert(`✅ ${message}`);
}

// 承認済みの場合のみ成長の軌跡を表示
async function showJourney(userId) {
  const requesterId = getCurrentUserId();
  
  try {
    if (!USE_AI) throw new Error("AI mode is disabled");
    const response = await fetch(`${AI_ENDPOINT}/ai/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_TOKEN}`
      },
      body: JSON.stringify({
        model_id: AI_MODEL_ID,
        payload: {
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: `ユーザー${userId}の苦悩克服の軌跡を時系列で生成してJSON配列で回答してください：\n\n[
  {
    "timestamp": "2024-01-15",
    "phase": "苦悩期/模索期/成長期/克服期",
    "content": "その時の状況",
    "action": "取った行動",
    "insight": "得られた気づき"
  }
]`
          }]
        }
      })
    });
    
    const data = await response.json();
    const journey = JSON.parse(data.response.content[0].text);
    
    displayJourney(journey);
    
  } catch (error) {
    console.error('AI軌跡生成エラー:', error);
    // フォールバック
    const mockJourney = [
      {
        timestamp: "2023-01-15",
        phase: "苦悩期",
        content: "毎日タスクをこなすだけで、本当に成長しているのか不安だった",
        action: "小さな目標を設定してみた",
        insight: "達成感が可視化されて前向きになれた"
      },
      {
        timestamp: "2023-03-20",
        phase: "模索期",
        content: "新しい技術に挑戦してみたが、すぐには結果が出なかった",
        action: "学習ログをつけ始めた",
        insight: "振り返ると確実に進歩していた"
      },
      {
        timestamp: "2023-06-10",
        phase: "成長期",
        content: "後輩に教える機会があり、自分の理解度を確認できた",
        action: "アウトプットを意識した",
        insight: "教えることで自分も成長した"
      },
      {
        timestamp: "2023-09-01",
        phase: "克服期",
        content: "1年前の自分と比べて明らかにできることが増えていた",
        action: "定期的な振り返りを習慣化",
        insight: "成長は日々の積み重ねだと実感"
      }
    ];
    
    displayJourney(mockJourney);
  }
}

function displayJourney(journey) {
  const modal = document.getElementById('journeyModal');
  const thread = document.getElementById('journey-thread');
  
  thread.innerHTML = journey.map(step => `
    <div class="journey-step ${step.phase}">
      <div class="timestamp">📅 ${step.timestamp}</div>
      <div class="phase-badge">${step.phase}</div>
      <div class="content">${step.content}</div>
      <div class="action">💡 ${step.action}</div>
      <div class="insight">✨ ${step.insight}</div>
    </div>
  `).join('');
  
  modal.style.display = 'block';
}

function getCurrentUserId() {
  return 'user_current';
}
