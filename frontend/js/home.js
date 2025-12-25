(() => {
        'use strict';

        const STORAGE_USER_KEY = "tsubunavi_user_id";
        const DEFAULT_USER_ID = "user_12345";
        let taskIdCounter = 4;
        let reportSaved = false;
        const tweets = [];
        const API_ENDPOINT = (window.API_CONFIG?.baseUrl || '').replace(/\/$/, '');
        const API_TOKEN = window.API_CONFIG?.token || '';
        const AI_MODEL_ID = window.API_CONFIG?.modelId || 'anthropic.claude-3-haiku-20240307-v1:0';
        const USE_API = (window.API_CONFIG?.mode || 'local').toLowerCase() === 'api' && API_ENDPOINT && API_TOKEN;
        
        // エールメッセージを読み込んで表示
        function loadCheerMessages() {
            const supportCount = parseInt(localStorage.getItem('supportCount') || '0');
            const container = document.getElementById('cheerMessages');
            
            if (supportCount > 0) {
                const cheerDiv = document.createElement('div');
                cheerDiv.className = 'cheer-message';
                cheerDiv.innerHTML = `
                    <div class="cheer-icon">💚</div>
                    <div class="cheer-text">
                        ${supportCount}名からエールが届いています。<br>
                        あなたは一人じゃない！
                    </div>
                `;
                container.appendChild(cheerDiv);
                
                // 表示後に削除
                setTimeout(() => {
                    localStorage.removeItem('supportCount');
                }, 5000);
            }
        }
        
        // ページ読み込み時に実行
        const userNameEl = document.getElementById('userName');
        if (userNameEl) {
            const storedId = localStorage.getItem(STORAGE_USER_KEY);
            const displayName = (storedId && storedId.trim()) ? storedId.trim() : '田中 健太';
            userNameEl.textContent = displayName;
        }
        loadCheerMessages();
        loadViewRequests();
        loadPublicFootprints();
        loadTweetsFromApi();
        loadTasksFromApi();
        loadDailyAdvice();
        loadDailyReports();
        setReportDateDefault();
        const reportContent = document.getElementById('reportContent');
        if (reportContent) {
            reportContent.addEventListener('input', () => {
                reportSaved = false;
            });
        }

        async function loadTweetsFromApi() {
            if (!USE_API) return;
            try {
                const userId = localStorage.getItem(STORAGE_USER_KEY) || DEFAULT_USER_ID;
                const res = await fetch(`${API_ENDPOINT}/api/tweets?userId=${encodeURIComponent(userId)}`, {
                    headers: { 'Authorization': `Bearer ${API_TOKEN}` },
                    method: 'GET'
                });
                if (!res.ok) throw new Error(`tweets api failed: ${res.status}`);
                const data = await res.json();
                const filtered = (Array.isArray(data) ? data : []).filter((t) => (t.userId || DEFAULT_USER_ID) === userId);
                const normalized = filtered.map(normalizeApiTweet);
                tweets.length = 0;
                normalized.forEach(t => tweets.push(t));
                renderTweetHistory();
            } catch (e) {
                console.warn('load tweets error', e);
            }
        }

        async function loadTasksFromApi() {
            if (!USE_API) return;
            try {
                const userId = localStorage.getItem(STORAGE_USER_KEY) || DEFAULT_USER_ID;
                const res = await fetch(`${API_ENDPOINT}/api/tasks?userId=${encodeURIComponent(userId)}`, {
                    headers: { 'Authorization': `Bearer ${API_TOKEN}` }
                });
                if (!res.ok) throw new Error(`tasks api failed: ${res.status}`);
                const data = await res.json();
                const filtered = (Array.isArray(data) ? data : []).filter((t) => (t.userId || DEFAULT_USER_ID) === userId);
                renderTaskBoard(filtered);
            } catch (e) {
                console.warn('load tasks error', e);
            }
        }

        async function loadDailyAdvice() {
            if (!USE_API) return;
            try {
                const userId = localStorage.getItem(STORAGE_USER_KEY) || DEFAULT_USER_ID;
                const res = await fetch(`${API_ENDPOINT}/api/advice?userId=${encodeURIComponent(userId)}`, {
                    headers: { 'Authorization': `Bearer ${API_TOKEN}` },
                    method: 'GET'
                });
                if (!res.ok) throw new Error(`advice api failed: ${res.status}`);
                const data = await res.json();
                const advice = data?.advice || '';
                const nextAction = data?.next_action || '';
                const message = `
                    <strong>おはようございます、${userId}さん！</strong><br>
                    ${advice}${nextAction ? `<br>次の行動: ${nextAction}` : ''}
                `;
                const el = document.getElementById('aiMessage');
                if (el) el.innerHTML = message;
            } catch (e) {
                console.warn('load advice error', e);
            }
        }

        async function loadDailyReports() {
            if (!USE_API) {
                loadSavedReportsLocal();
                return;
            }
            try {
                const userId = localStorage.getItem(STORAGE_USER_KEY) || DEFAULT_USER_ID;
                const res = await fetch(`${API_ENDPOINT}/api/daily-reports?userId=${encodeURIComponent(userId)}`, {
                    headers: { 'Authorization': `Bearer ${API_TOKEN}` },
                    method: 'GET'
                });
                if (!res.ok) throw new Error(`daily reports api failed: ${res.status}`);
                const data = await res.json();
                renderDailyReports(Array.isArray(data) ? data : []);
            } catch (e) {
                console.warn('load daily reports error', e);
            }
        }

        
        function analyzeTweet(text) {
            if (USE_API) {
                return fetch(`${API_ENDPOINT}/ai/execute`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${API_TOKEN}`
                    },
                    body: JSON.stringify({
                        model_id: AI_MODEL_ID,
                        payload: {
                            anthropic_version: 'bedrock-2023-05-31',
                            max_tokens: 512,
                            messages: [{
                                role: 'user',
                                content: `以下のつぶやきを分析してJSON形式で回答してください：\n\nつぶやき: "${text}"\n\n{
  "isTask": true/false,
  "isPositive": true/false,
  "isNegative": true/false,
  "extractedTask": "タスク名（タスクがある場合のみ）",
  "skill": "関連スキル名（タスクがある場合のみ）"
}`
                            }]
                        }
                    })
                })
                .then(response => response.json())
                .then(data => {
                    try {
                        const raw = data?.response?.content?.[0]?.text || '';
                        const parsed = safeJsonFromText(raw);
                        if (!parsed) throw new Error('no json');
                        return parsed;
                    } catch (e) {
                        console.error('JSONパースエラー:', e);
                        return fallbackAnalysis(text);
                    }
                })
                .catch(error => {
                    console.error('AI呼び出しエラー:', error);
                    return fallbackAnalysis(text);
                });
            }
            
            return Promise.resolve(fallbackAnalysis(text));
        }
        
        function fallbackAnalysis(text) {
            const isTask = /作る|作成|対応|準備|実施|やる|する|しないと|まで/.test(text);
            const isPositive = /嬉しい|楽しい|良い|成功|できた|頑張|ありがと/.test(text);
            const isNegative = /難しい|困|大変|疲|辛|できない|わからない/.test(text);
            return { isTask, isPositive, isNegative };
        }
        
        async function postTweet() {
            const input = document.getElementById('tweetInput');
            const text = input.value.trim();
            if (!text) return;
            
            const analysis = await analyzeTweet(text);
            const now = new Date();
            const timestamp = now.toISOString();
            tweets.unshift({ text, time: now, timestamp, ...analysis });
            input.value = '';
            
            renderTweetHistory();
            
            if (analysis.isTask) {
                addTaskFromTweet(text, analysis);
            }
            
            if (USE_API) {
                const userId = localStorage.getItem(STORAGE_USER_KEY) || DEFAULT_USER_ID;
                fetch(`${API_ENDPOINT}/api/tweets`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${API_TOKEN}`
                    },
                    body: JSON.stringify({ text, userId })
                }).then(() => {
                    loadTasksFromApi();
                    loadDailyReports();
                })
                  .catch(err => console.error('tweet api error', err));
            }

            // 苦悩分析（バックグラウンド）
            if (analysis.isNegative) {
                analyzeTweetForStruggle('user_current', text);
            }
            
            // あしあとをlocalStorageに保存
            saveFootprint(text, analysis, now);
            
            const responses = [
                `「${text.substring(0, 20)}...」ですね。その気持ち、よくわかります！一緒に頑張りましょう💪`,
                `つぶやきありがとうございます！${text.includes('難しい') ? '難しいときこそ成長のチャンスです' : '順調そうですね'}✨`,
                `「${text.substring(0, 15)}...」いいですね！その調子で進めていきましょう🚀`
            ];
            
            document.getElementById('aiMessage').innerHTML = `<strong>健太さん、</strong><br>${responses[Math.floor(Math.random() * responses.length)]}`;
            
            const msg = document.createElement('div');
            msg.textContent = '✨ つぶやきを投稿しました！';
            msg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: linear-gradient(135deg, #FFB74D 0%, #FF9800 100%); color: white; padding: 25px 50px; border-radius: 30px; font-size: 20px; font-weight: bold; z-index: 9999; box-shadow: 0 10px 30px rgba(255, 152, 0, 0.4); font-family: "Zen Maru Gothic", sans-serif;';
            document.body.appendChild(msg);
            setTimeout(() => msg.remove(), 2000);
        }
        
        function saveFootprint(text, analysis, time) {
            const footprints = JSON.parse(localStorage.getItem('footprints') || '[]');
            
            // スキルを判定
            let skill = '業務タスク';
            if (text.includes('会議') || text.includes('コミュニケーション') || text.includes('相談') || text.includes('話')) {
                skill = 'コミュニケーション';
            } else if (text.includes('設計') || text.includes('アーキテクチャ') || text.includes('API')) {
                skill = 'システム設計';
            } else if (text.includes('解決') || text.includes('調査') || text.includes('問題')) {
                skill = '課題解決';
            } else if (text.includes('リーダー') || text.includes('チーム') || text.includes('マネジメント')) {
                skill = 'リーダーシップ';
            } else if (text.includes('提案') || text.includes('アイデア') || text.includes('企画')) {
                skill = '提案力';
            }
            
            // 感情を表す絵文字
            let emotion = '💭';
            if (analysis.isPositive) emotion = '😊';
            if (analysis.isNegative) emotion = '😰';
            
            const footprint = {
                text: text.substring(0, 50),
                skill: skill,
                emotion: emotion,
                isPositive: analysis.isPositive,
                isNegative: analysis.isNegative,
                timestamp: time.getTime(),
                date: `${time.getMonth() + 1}/${time.getDate()}`
            };
            
            footprints.push(footprint);
            // 最大20個まで保存
            if (footprints.length > 20) {
                footprints.shift();
            }
            
            localStorage.setItem('footprints', JSON.stringify(footprints));
        }

        function safeJsonFromText(text) {
            if (!text) return null;
            try {
                return JSON.parse(text);
            } catch (_e) {
                const match = text.match(/\{[\s\S]*\}/);
                if (!match) return null;
                try {
                    return JSON.parse(match[0]);
                } catch (_e2) {
                    return null;
                }
            }
        }
        
        function addTaskFromTweet(text, analysis) {
            const taskId = `task${taskIdCounter++}`;
            const taskCard = document.createElement('div');
            taskCard.className = 'task-card';
            taskCard.draggable = true;
            taskCard.id = taskId;
            taskCard.dataset.skill = analysis.skill || '業務タスク';
            taskCard.ondragstart = drag;
            
            // AIがタスクを整形
            const taskTitle = analysis.extractedTask || extractTaskTitle(text);
            
            taskCard.innerHTML = `
                <div class="task-title">${taskTitle}</div>
                <div class="skill-tags"><span class="skill-tag">${analysis.skill || '業務タスク'}</span></div>
            `;
            document.querySelector('[data-column="pending"]').appendChild(taskCard);
        }

        function renderTaskBoard(items) {
            const columns = {
                pending: document.querySelector('[data-column="pending"]'),
                inprogress: document.querySelector('[data-column="inprogress"]'),
                done: document.querySelector('[data-column="done"]')
            };
            Object.values(columns).forEach(col => {
                if (!col) return;
                const existing = Array.from(col.querySelectorAll('.task-card'));
                existing.forEach(card => card.remove());
            });

            items.forEach((task) => {
                const status = (task.status || 'pending').toLowerCase();
                const target = columns[status] || columns.pending;
                if (!target) return;

                const taskCard = document.createElement('div');
                taskCard.className = 'task-card';
                taskCard.draggable = true;
                taskCard.id = task.id || task.taskId || `task_${Date.now()}`;
                taskCard.dataset.taskId = task.id || task.taskId || '';
                taskCard.dataset.skill = task.skill || '業務タスク';
                taskCard.ondragstart = drag;

                const title = task.title || task.extractedTask || '';
                const skill = task.skill || '業務タスク';
                taskCard.innerHTML = `
                    <div class="task-title">${title}</div>
                    <div class="skill-tags"><span class="skill-tag">${skill}</span></div>
                `;
                target.appendChild(taskCard);
            });
        }
        
        function extractTaskTitle(text) {
            // タスクパターンのマッピング
            const patterns = [
                { regex: /(.+?)を作成する/, format: (m) => `${m[1]}の作成` },
                { regex: /(.+?)を作る/, format: (m) => `${m[1]}の作成` },
                { regex: /(.+?)の準備をしないと/, format: (m) => `${m[1]}の準備` },
                { regex: /(.+?)を準備/, format: (m) => `${m[1]}の準備` },
                { regex: /(.+?)を調査/, format: (m) => `${m[1]}の調査` },
                { regex: /(.+?)を実装/, format: (m) => `${m[1]}の実装` },
                { regex: /(.+?)を開発/, format: (m) => `${m[1]}の開発` },
                { regex: /(.+?)を確認/, format: (m) => `${m[1]}の確認` },
                { regex: /(.+?)を修正/, format: (m) => `${m[1]}の修正` },
                { regex: /(.+?)をテスト/, format: (m) => `${m[1]}のテスト` },
                { regex: /(.+?)をレビュー/, format: (m) => `${m[1]}のレビュー` },
                { regex: /(.+?)を対応/, format: (m) => `${m[1]}への対応` },
                { regex: /(.+?)をまとめる/, format: (m) => `${m[1]}のまとめ` },
                { regex: /(.+?)を終わらせる/, format: (m) => `${m[1]}の完了` },
                { regex: /(.+?)を始める/, format: (m) => `${m[1]}の開始` },
                { regex: /(.+?)を進める/, format: (m) => `${m[1]}の推進` },
                { regex: /(.+?)を見つける/, format: (m) => `${m[1]}の発見` },
                { regex: /調査を進めて(.+?)を見つけ/, format: (m) => `${m[1]}の調査` },
                { regex: /(.+?)をする必要がある/, format: (m) => `${m[1]}` },
                { regex: /(.+?)する予定/, format: (m) => `${m[1]}` }
            ];
            
            // パターンマッチング
            for (const pattern of patterns) {
                const match = text.match(pattern.regex);
                if (match) {
                    return pattern.format(match);
                }
            }
            
            // マッチしない場合は最初の30文字
            return text.substring(0, 30) + (text.length > 30 ? '...' : '');
        }
        
        function renderTweetHistory() {
            const container = document.getElementById('tweetHistory');
            container.innerHTML = '';
            const selectedDate = getSelectedReportDate();
            const targetDate = selectedDate || new Date().toISOString().slice(0, 10);
            const todaysTweets = tweets.filter((tweet) => {
                if (tweet.timestamp) return String(tweet.timestamp).slice(0, 10) === targetDate;
                if (tweet.time) return isSameDay(tweet.time, new Date(targetDate));
                return false;
            });

            if (todaysTweets.length === 0) {
                container.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">今日のつぶやきはまだありません</div>';
                return;
            }
            
            todaysTweets.forEach(tweet => {
                const item = document.createElement('div');
                item.className = 'tweet-item';
                const timeStr = `${tweet.time.getHours()}:${String(tweet.time.getMinutes()).padStart(2, '0')}`;
                
                let tags = '';
                if (tweet.isTask) tags += '<span class="tag tag-task">📋 業務タスク</span>';
                if (tweet.isPositive) tags += '<span class="tag tag-positive">😊 ポジティブ</span>';
                if (tweet.isNegative) tags += '<span class="tag tag-negative">😰 ネガティブ</span>';
                
                item.innerHTML = `
                    <div class="tweet-header">
                        <span class="tweet-time">${timeStr}</span>
                    </div>
                    <div class="tweet-text">${tweet.text}</div>
                    <div class="tweet-tags">${tags}</div>
                `;
                container.appendChild(item);
            });
        }

        function isSameDay(a, b) {
            const da = a instanceof Date ? a : new Date(a);
            const db = b instanceof Date ? b : new Date(b);
            if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
            return da.getFullYear() === db.getFullYear() &&
                da.getMonth() === db.getMonth() &&
                da.getDate() === db.getDate();
        }
        
        function generateReport() {
            if (USE_API) {
                return generateReportFromApi();
            }
            const selectedDate = getSelectedReportDate();
            const dateStr = formatDateJaFromYmd(selectedDate);
            
            const schedule = [
                '09:00-10:00 チームミーティング',
                '10:00-12:00 開発作業',
                '13:00-15:00 コードレビュー',
                '15:00-17:00 課題対応'
            ];
            
            const taskTweets = tweets.filter(t => t.isTask);
            const positiveTweets = tweets.filter(t => t.isPositive);
            const negativeTweets = tweets.filter(t => t.isNegative);
            
            let tasks = '';
            if (taskTweets.length > 0) {
                const taskSummary = summarizeTasks(taskTweets);
                tasks = taskSummary.map(t => `・ ${t}`).join('\n');
            } else {
                tasks = '・ 通常業務を実施しました';
            }
            
            let insights = '';
            if (positiveTweets.length > 0) {
                insights += summarizePositive(positiveTweets) + '\n\n';
            }
            if (negativeTweets.length > 0) {
                insights += summarizeNegative(negativeTweets);
            }
            if (!insights) {
                insights = '・ 順調に業務を進めることができました';
            }
            
            const report = `${dateStr}の日報

■今日のスケジュール
${schedule.join('\n')}

■取り組んだこと
${tasks}

■気づき
${insights}`;
            
            document.getElementById('reportContent').value = report;
            reportSaved = false;
            document.getElementById('reportCard').style.display = 'block';
            document.getElementById('reportCard').scrollIntoView({ behavior: 'smooth' });
        }

        async function generateReportFromApi() {
            const date = getSelectedReportDate();
            try {
                const res = await fetch(`${API_ENDPOINT}/reports`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${API_TOKEN}`
                    },
                    body: JSON.stringify({ date })
                });
                if (!res.ok) throw new Error(`report api failed: ${res.status}`);
                const data = await res.json();
                const report = data?.report || '';
                document.getElementById('reportContent').value = report;
                reportSaved = false;
                document.getElementById('reportCard').style.display = 'block';
                document.getElementById('reportCard').scrollIntoView({ behavior: 'smooth' });
            } catch (e) {
                console.error('report api error', e);
                const msg = '日報生成に失敗しました';
                document.getElementById('reportContent').value = msg;
                reportSaved = false;
                document.getElementById('reportCard').style.display = 'block';
            }
        }

        function normalizeApiTweet(item) {
            const time = item?.timestamp ? new Date(item.timestamp) : new Date();
            return {
                text: item?.text || '',
                time,
                timestamp: item?.timestamp || null,
                isTask: Boolean(item?.isTask),
                isPositive: Boolean(item?.isPositive),
                isNegative: Boolean(item?.isNegative)
            };
        }

        function renderDailyReports(items) {
            const normalized = (items || []).map((item, index) => {
                const date = String(item.date || '');
                const content = String(item.report_text || '');
                const hasContent = Boolean(content.trim());
                const title = hasContent ? generateReportTitle(content) : '日報（下書き未保存）';
                const stats = buildReportStatsLine(item);
                const body = hasContent
                    ? content
                    : `${stats || '日報本文が未保存です。'}\n\n日報本文が未保存です。`;
                return {
                    id: buildReportContentId(date, index),
                    date,
                    title,
                    status: hasContent ? '保存済み' : '未保存',
                    statusClass: hasContent ? '' : 'pending',
                    content: body
                };
            });
            renderReportList(normalized);
        }

        
        function summarizeTasks(taskTweets) {
            const keywords = {
                '設計': ['設計', 'API', 'アーキテクチャ'],
                '実装': ['実装', '開発', 'コーディング', '作成'],
                'レビュー': ['レビュー', '確認'],
                '修正': ['修正', 'バグ', 'デバッグ'],
                '会議': ['会議', 'ミーティング', '打ち合わせ'],
                '調査': ['調査', '調べ', 'フレームワーク'],
                'テスト': ['テスト', 'テストケース']
            };
            
            const summary = [];
            const categorized = new Set();
            
            for (const [category, words] of Object.entries(keywords)) {
                const matched = taskTweets.filter(t => 
                    words.some(w => t.text.includes(w)) && !categorized.has(t.text)
                );
                if (matched.length > 0) {
                    summary.push(`${category}業務を実施しました`);
                    matched.forEach(t => categorized.add(t.text));
                }
            }
            
            const uncategorized = taskTweets.filter(t => !categorized.has(t.text));
            if (uncategorized.length > 0) {
                summary.push('その他の業務タスクに対応しました');
            }
            
            return summary.length > 0 ? summary : ['通常業務を実施しました'];
        }
        
        function summarizePositive(positiveTweets) {
            const hasSuccess = positiveTweets.some(t => /成功|できた|完了/.test(t.text));
            const hasGood = positiveTweets.some(t => /良い|嬉しい|楽しい/.test(t.text));
            
            if (hasSuccess && hasGood) {
                return '・ タスクを順調に完了でき、チームとの連携もスムーズに進められました';
            } else if (hasSuccess) {
                return '・ 計画していたタスクを完了することができました';
            } else if (hasGood) {
                return '・ チームとのコミュニケーションが充実しています';
            }
            return '・ 業務を順調に進めることができました';
        }
        
        function summarizeNegative(negativeTweets) {
            const hasDifficult = negativeTweets.some(t => /難しい|困/.test(t.text));
            const hasTired = negativeTweets.some(t => /疲|大変/.test(t.text));
            
            if (hasDifficult && hasTired) {
                return '・ 複雑な課題に対応中ですが、引き続き解決に向けて取り組んでいきます';
            } else if (hasDifficult) {
                return '・ 技術的な課題がありますが、調査と検討を進めています';
            } else if (hasTired) {
                return '・ 業務量が多い状況ですが、優先順位をつけて対応しています';
            }
            return '・ いくつかの課題がありますが、解決に向けて進めています';
        }
        
        async function saveReport() {
            const text = document.getElementById('reportContent').value;
            if (!text) {
                alert('日報の内容を入力してください。');
                return;
            }
            const date = getSelectedReportDate();
            try {
                if (USE_API) {
                    await saveReportDraft(text, date);
                } else {
                    saveReportLocal(text, date);
                }
                reportSaved = true;
                alert('日報を保存しました！');
                loadDailyReports();
            } catch (e) {
                console.error('save error', e);
                alert('日報の保存に失敗しました。');
            }
        }

        async function copyReport() {
            const text = document.getElementById('reportContent').value;
            if (!text) return;
            if (USE_API && !reportSaved) {
                alert('日報が保存されていません。まず日報を保存してください。');
                return;
            }
            try {
                await navigator.clipboard.writeText(text);
                const msg = document.createElement('div');
                msg.textContent = '✅ 日報をコピーしました！';
                msg.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: linear-gradient(135deg, #FFB74D 0%, #FF9800 100%); color: white; padding: 25px 50px; border-radius: 30px; font-size: 20px; font-weight: bold; z-index: 9999; box-shadow: 0 10px 30px rgba(255, 152, 0, 0.4); font-family: "Zen Maru Gothic", sans-serif;';
                document.body.appendChild(msg);
                setTimeout(() => msg.remove(), 2000);
            } catch (e) {
                console.error('copy error', e);
            }
        }

        function getLocalDateYmd() {
            const d = new Date();
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        }

        function formatDateJaFromYmd(ymd) {
            if (!ymd) return '';
            const parts = ymd.split('-');
            if (parts.length !== 3) return ymd;
            const [y, m, d] = parts;
            return `${y}年${Number(m)}月${Number(d)}日`;
        }

        function getSelectedReportDate() {
            const input = document.getElementById('reportDate');
            const fallback = getLocalDateYmd();
            if (!input) return fallback;
            return input.value || fallback;
        }

        function setReportDateDefault() {
            const input = document.getElementById('reportDate');
            if (!input) return;
            if (!input.value) {
                input.value = getLocalDateYmd();
            }
            input.addEventListener('change', () => {
                reportSaved = false;
                renderTweetHistory();
            });
        }

        function saveReportLocal(text, date) {
            const targetDate = date || getLocalDateYmd();
            const title = generateReportTitle(text);
            const savedReports = JSON.parse(localStorage.getItem('savedReports') || '{}');
            savedReports[targetDate] = {
                title,
                content: text,
                date: targetDate,
                timestamp: Date.now()
            };
            localStorage.setItem('savedReports', JSON.stringify(savedReports));
        }

        function loadSavedReportsLocal() {
            const savedReports = JSON.parse(localStorage.getItem('savedReports') || '{}');
            const reports = Object.values(savedReports).sort((a, b) => new Date(b.date) - new Date(a.date));
            const normalized = reports.map((report, index) => ({
                id: buildReportContentId(report.date, index),
                date: report.date || '',
                title: report.title || generateReportTitle(report.content || ''),
                status: '保存済み',
                statusClass: '',
                content: report.content || ''
            }));
            renderReportList(normalized);
        }

        function buildReportStatsLine(item) {
            const positive = Number(item.positive_pct || 0);
            const negative = Number(item.negative_pct || 0);
            const task = Number(item.task_pct || 0);
            if (!positive && !negative && !task) return '';
            return `ポジティブ${positive}%：ネガティブ${negative}%：タスク登録${task}%`;
        }

        function buildReportContentId(date, index) {
            const base = String(date || `unknown-${index}`);
            const safe = base.replace(/[^0-9a-zA-Z_-]/g, '');
            return `content-${safe || `idx-${index}`}`;
        }

        function renderReportList(items) {
            const container = document.getElementById('reportList');
            if (!container) return;
            if (!items.length) {
                container.innerHTML = '<div class="tweet-item">日報がまだありません。</div>';
                return;
            }
            container.innerHTML = items.map((item) => {
                const displayDate = item.date ? item.date.replace(/-/g, '/') : '';
                const statusClass = item.statusClass ? ` ${item.statusClass}` : '';
                const body = String(item.content || '').replace(/\n/g, '<br>');
                return `
                    <div class="report-item">
                        <div class="report-header" onclick="toggleReportContent('${item.id}')">
                            <div class="report-date">${displayDate} ${item.title}</div>
                            <div class="report-status${statusClass}">${item.status}</div>
                        </div>
                        <div id="${item.id}" class="report-content">
                            ${body}
                        </div>
                    </div>
                `;
            }).join('');
        }

        function toggleReportContent(contentId) {
            const contentDiv = document.getElementById(contentId);
            if (!contentDiv) return;
            const isHidden = contentDiv.style.display === 'none' || getComputedStyle(contentDiv).display === 'none';
            contentDiv.style.display = isHidden ? 'block' : 'none';
        }

        function generateReportTitle(content) {
            const titles = [
                'システム設計スキル向上への取り組み',
                'チームコミュニケーション強化の一日',
                '技術学習と実装検討の成果',
                'プロジェクト進捗と課題解決',
                '新技術習得への挑戦',
                'コードレビューと品質向上',
                'API設計とアーキテクチャ検討',
                'チーム連携と効率化の実践'
            ];
            if (!content) return titles[0];
            if (content.includes('API') || content.includes('設計')) {
                return 'API設計とシステム開発の進展';
            }
            if (content.includes('チーム') || content.includes('会議')) {
                return 'チームコミュニケーション強化の一日';
            }
            if (content.includes('学習') || content.includes('調査')) {
                return '技術学習と知識向上への取り組み';
            }
            return titles[Math.floor(Math.random() * titles.length)];
        }

        async function saveReportDraft(text, date) {
            if (!USE_API) return;
            const userId = localStorage.getItem(STORAGE_USER_KEY) || DEFAULT_USER_ID;
            const targetDate = date || getLocalDateYmd();
            const res = await fetch(`${API_ENDPOINT}/api/daily-report-draft?userId=${encodeURIComponent(userId)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_TOKEN}`
                },
                body: JSON.stringify({ date: targetDate, report_text: text })
            });
            if (!res.ok) throw new Error(`save report failed: ${res.status}`);
            return res.json();
        }

        function generateFootprint() {
            const feedbackCard = document.getElementById('feedbackCard');
            const footprintCard = document.getElementById('footprintCard');
            const feedbackContent = document.getElementById('feedbackContent');
            const footprintContent = document.getElementById('footprintContent');
            const summaryText = '今週は「計画→実行→振り返り」の流れが安定しています。来週は「共有」を意識するとさらに伸びます。';
            const summarySkill = '課題解決';
            if (feedbackContent) {
                feedbackContent.textContent = '直近の日報の傾向から、前向きな行動が継続できています。この調子で小さな達成を積み上げていきましょう。';
            }
            if (footprintContent) {
                footprintContent.textContent = summaryText;
            }
            const footprints = JSON.parse(localStorage.getItem('footprints') || '[]');
            const now = new Date();
            const date = `${now.getMonth() + 1}/${now.getDate()}`;
            const exists = footprints.some(fp => fp.type === 'summary' && fp.date === date && fp.text === summaryText);
            if (!exists) {
                footprints.push({
                    text: summaryText,
                    skill: summarySkill,
                    emotion: '🌱',
                    isPositive: true,
                    isNegative: false,
                    timestamp: now.getTime(),
                    date,
                    type: 'summary'
                });
                localStorage.setItem('footprints', JSON.stringify(footprints));
            }
            if (feedbackCard) feedbackCard.style.display = 'block';
            if (footprintCard) footprintCard.style.display = 'block';
        }

        function buildFootprintSummary(text) {
            const trimmed = String(text || '').replace(/\s+/g, ' ').trim();
            if (!trimmed) return '🌱 成長のあしあと';
            const short = trimmed.length > 60 ? `${trimmed.slice(0, 60)}...` : trimmed;
            return `🌱 ${short}`;
        }

        function shareFootprint() {
            const footprintContent = document.getElementById('footprintContent');
            if (!footprintContent) return;
            const contentHtml = footprintContent.innerHTML.trim();
            const contentText = footprintContent.textContent.trim();
            if (!contentText) {
                alert('あしあとがまだありません。');
                return;
            }
            const userId = localStorage.getItem(STORAGE_USER_KEY) || DEFAULT_USER_ID;
            const userName = document.getElementById('userName')?.textContent?.trim() || userId;
            const summary = buildFootprintSummary(contentText);
            const timestamp = new Date().toLocaleString('ja-JP');

            const sharedFootprints = JSON.parse(localStorage.getItem('sharedFootprints') || '[]');
            sharedFootprints.unshift({
                id: Date.now(),
                userName,
                summary,
                content: contentHtml,
                timestamp,
                date: new Date().toISOString()
            });
            if (sharedFootprints.length > 10) {
                sharedFootprints.pop();
            }
            localStorage.setItem('sharedFootprints', JSON.stringify(sharedFootprints));

            if (USE_API) {
                fetch(`${API_ENDPOINT}/api/shared-footprints`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${API_TOKEN}`
                    },
                    body: JSON.stringify({
                        userId,
                        userName,
                        summary,
                        content: contentHtml
                    })
                }).catch((err) => {
                    console.warn('shared footprint api error', err);
                });
            }

            alert('🔥 あしあとを夜のたき火広場にシェアしました！\n他のユーザーが閲覧できるようになりました。');
        }

        function copyFootprint() {
            const text = document.getElementById('footprintContent')?.textContent || '';
            if (!text) return;
            navigator.clipboard.writeText(text).then(() => {
                alert('日報をコピーしました！');
            });
        }
        
        function allowDrop(ev) { ev.preventDefault(); }
        function drag(ev) { ev.dataTransfer.setData("text", ev.target.id); }
        function drop(ev) {
            ev.preventDefault();
            const data = ev.dataTransfer.getData("text");
            const task = document.getElementById(data);
            const column = ev.target.closest('.kanban-column');
            
            if (column) {
                column.appendChild(task);
                const status = column.dataset.column || 'pending';
                const taskId = task?.dataset?.taskId || task?.id || '';
                if (USE_API && taskId) {
                    updateTaskStatus(taskId, status).catch((err) => {
                        console.warn('task status update failed', err);
                        loadTasksFromApi();
                    });
                }
                
                if (column.dataset.column === 'done') {
                    const skill = task.dataset.skill;

                    // 風船アニメーション
                    const balloons = ['🎈', '🎉', '✨', '🌟', '💫'];
                    for (let i = 0; i < 8; i++) {
                        setTimeout(() => {
                            const balloon = document.createElement('div');
                            balloon.className = 'balloon';
                            balloon.textContent = balloons[Math.floor(Math.random() * balloons.length)];
                            balloon.style.left = Math.random() * window.innerWidth + 'px';
                            balloon.style.bottom = '0px';
                            balloon.style.animationDelay = Math.random() * 0.5 + 's';
                            document.body.appendChild(balloon);
                            setTimeout(() => balloon.remove(), 3000);
                        }, i * 100);
                    }
                    
                    document.getElementById('aiMessage').innerHTML = `<strong>おめでとうございます！</strong><br>「${task.querySelector('.task-title').textContent}」を完了しました！`;
                }
            }
        }
        
        function closeJourney() {
            document.getElementById('journeyModal').style.display = 'none';
        }
        
        function getCurrentUserId() {
            return 'user_current';
        }

        async function updateTaskStatus(taskId, status) {
            if (!USE_API) return;
            const userId = localStorage.getItem(STORAGE_USER_KEY) || DEFAULT_USER_ID;
            const res = await fetch(`${API_ENDPOINT}/api/tasks/${encodeURIComponent(taskId)}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_TOKEN}`
                },
                body: JSON.stringify({ status, userId })
            });
            if (!res.ok) {
                throw new Error(`task update failed: ${res.status}`);
            }
            return res.json();
        }
        
        // 閲覧依頼を読み込み
        function loadViewRequests() {
            const requests = JSON.parse(localStorage.getItem('viewRequests') || '[]');
            const container = document.getElementById('viewRequests');
            
            if (requests.length > 0) {
                container.innerHTML = requests.map(req => `
                    <div class="view-request">
                        <div class="request-header">📩 あしあと閲覧依頼</div>
                        <div class="request-content">
                            <strong>${req.requesterName}</strong>さんがあなたのあしあとの閲覧を希望しています。<br>
                            理由: ${req.reason}
                        </div>
                        <div class="request-buttons">
                            <button class="approve-btn" onclick="approveRequest('${req.id}', 'full')">✅ 全て公開</button>
                            <button class="approve-btn" onclick="approveRequest('${req.id}', 'blur')">🔒 AIぼかし公開</button>
                            <button class="reject-btn" onclick="rejectRequest('${req.id}')">❌ 拒否</button>
                        </div>
                    </div>
                `).join('');
            }
        }
        
        // 依頼を承認
        function approveRequest(requestId, type) {
            const requests = JSON.parse(localStorage.getItem('viewRequests') || '[]');
            const updatedRequests = requests.filter(req => req.id !== requestId);
            localStorage.setItem('viewRequests', JSON.stringify(updatedRequests));
            
            // 承認情報を保存
            const approvals = JSON.parse(localStorage.getItem('footprintApprovals') || '{}');
            approvals[requestId] = { type, approved: true, timestamp: Date.now() };
            localStorage.setItem('footprintApprovals', JSON.stringify(approvals));
            
            alert(`✅ 閲覧を承認しました（${type === 'full' ? '全て公開' : 'AIぼかし公開'}）`);
            loadViewRequests();
            loadPublicFootprints();
        }
        
        // 依頼を拒否
        function rejectRequest(requestId) {
            const requests = JSON.parse(localStorage.getItem('viewRequests') || '[]');
            const updatedRequests = requests.filter(req => req.id !== requestId);
            localStorage.setItem('viewRequests', JSON.stringify(updatedRequests));
            
            alert('❌ 閲覧依頼を拒否しました');
            loadViewRequests();
        }
        
        // 公開あしあとを読み込み
        function loadPublicFootprints() {
            const approvals = JSON.parse(localStorage.getItem('footprintApprovals') || '{}');
            const footprints = JSON.parse(localStorage.getItem('footprints') || '[]');
            const container = document.getElementById('viewRequests');
            
            const approvedRequests = Object.values(approvals).filter(a => a.approved);
            
            if (approvedRequests.length > 0 && footprints.length > 0) {
                const publicSection = document.createElement('div');
                publicSection.className = 'public-footprints';
                publicSection.innerHTML = `
                    <div style="font-weight: bold; margin-bottom: 15px; color: #FF9800;">👀 公開中のあしあと</div>
                    ${footprints.slice(0, 5).map(fp => `
                        <div class="footprint-item">
                            <div class="footprint-header">
                                <span>${fp.emotion}</span>
                                <span class="footprint-date">${fp.date}</span>
                            </div>
                            <div class="footprint-text">${fp.text}</div>
                            <div class="footprint-skill">スキル: ${fp.skill}</div>
                        </div>
                    `).join('')}
                    <div style="text-align: center; margin-top: 15px;">
                        <button class="tweet-button" onclick="stopSharing()">🔒 公開停止</button>
                    </div>
                `;
                container.appendChild(publicSection);
            }
        }
        
        // 公開停止
        function stopSharing() {
            localStorage.removeItem('footprintApprovals');
            alert('🔒 あしあとの公開を停止しました');
            loadPublicFootprints();
        }
        
        // デモ用: 閲覧依頼を生成
        function createDemoRequest() {
            const requests = JSON.parse(localStorage.getItem('viewRequests') || '[]');
            const newRequest = {
                id: 'req_' + Date.now(),
                requesterName: '山田 太郎',
                reason: '同じような悩みを抱えており、参考にさせていただきたいです',
                timestamp: Date.now()
            };
            requests.push(newRequest);
            localStorage.setItem('viewRequests', JSON.stringify(requests));
            loadViewRequests();
        }
        
        // デモ用ボタンを追加（開発時のみ）
        setTimeout(() => {
            if (JSON.parse(localStorage.getItem('viewRequests') || '[]').length === 0) {
                createDemoRequest();
            }
        }, 2000);

        // Expose handlers used by inline HTML
        window.postTweet = postTweet;
        window.generateReport = generateReport;
        window.copyReport = copyReport;
        window.saveReport = saveReport;
        window.generateFootprint = generateFootprint;
        window.shareFootprint = shareFootprint;
        window.copyFootprint = copyFootprint;
        window.allowDrop = allowDrop;
        window.drag = drag;
        window.drop = drop;
        window.closeJourney = closeJourney;
        window.approveRequest = approveRequest;
        window.rejectRequest = rejectRequest;
        window.stopSharing = stopSharing;
        window.toggleReportContent = toggleReportContent;
    })();
    
