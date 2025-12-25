"use strict";

const { DynamoDB, BedrockRuntime } = require("aws-sdk");

const client = new DynamoDB.DocumentClient();
const bedrock = new BedrockRuntime({ region: process.env.AWS_REGION || "us-east-1" });
const TABLE = process.env.TABLE_NAME;
const TASK_TABLE = process.env.TASK_TABLE_NAME;
const ADVICE_TABLE = process.env.ADVICE_TABLE_NAME;
const DAILY_REPORTS_TABLE = process.env.DAILY_REPORTS_TABLE_NAME;
const SHARED_FOOTPRINTS_TABLE = process.env.SHARED_FOOTPRINTS_TABLE_NAME;
const SHARED_TOKEN = process.env.SHARED_TOKEN;
const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || "anthropic.claude-3-5-sonnet-20240620-v1:0";
const DEFAULT_USER_ID = "user_12345";

exports.handler = async (event) => {
  try {
    const route = event.rawPath || "/";
    const method = event.requestContext?.http?.method || "GET";
    console.log("request", { route, method, headers: event.headers });
    console.log("rawBody", { isBase64: event.isBase64Encoded, len: event.body ? event.body.length : 0, body: event.body });

    if (method === "OPTIONS") {
      return {
        statusCode: 204,
        headers: {
          "Access-Control-Allow-Origin": event.headers?.origin || "*",
          "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type,Authorization",
        },
      };
    }

    if (!isAuthorized(event.headers)) {
      return json(401, { message: "Unauthorized" });
    }

    if (route === "/api/tweets" && method === "POST") {
      const body = parseBody(event.body, event.isBase64Encoded);
      if (!body || !body.text) {
        return json(400, { message: "text is required" });
      }
      const analysis = await analyzeTweet(body.text);
      const now = Date.now();
      const tweetId = `tweet_${now}`;
      const timestamp = formatJstTimestamp(new Date(now));
      const userId = (body.userId || body.user_id || "").trim() || DEFAULT_USER_ID;
      const tweetItem = {
        id: tweetId,
        tweetId,
        userId,
        text: body.text,
        timestamp,
        ...analysis,
      };

      await client
        .put({
          TableName: TABLE,
          Item: tweetItem,
        })
        .promise();

      if (DAILY_REPORTS_TABLE) {
        await updateDailyReport(userId, timestamp);
      }

      if (analysis.isTask && TASK_TABLE) {
        const taskItem = {
          id: `task_${now}`,
          taskId: `task_${now}`,
          tweetId,
          userId,
          title: analysis.extractedTask || body.text,
          skill: analysis.skill || null,
          status: "pending",
          timestamp,
        };
        await client
          .put({
            TableName: TASK_TABLE,
            Item: taskItem,
          })
          .promise();
      }

      return json(201, tweetItem);
    }

    if (route === "/api/tweets" && method === "GET") {
      const userId = event.queryStringParameters?.userId || DEFAULT_USER_ID;
      const res = await client
        .scan({
          TableName: TABLE,
          Limit: 50,
        })
        .promise();
      const items = (res.Items || []).filter((item) => item.userId === userId).sort((a, b) => {
        const ta = Date.parse(a.timestamp || "") || 0;
        const tb = Date.parse(b.timestamp || "") || 0;
        return tb - ta;
      });
      return json(200, items);
    }

    if (route === "/api/tasks" && method === "GET") {
      const userId = event.queryStringParameters?.userId || DEFAULT_USER_ID;
      if (!TASK_TABLE) return json(200, []);
      const res = await client
        .scan({
          TableName: TASK_TABLE,
          Limit: 100,
        })
        .promise();
      const items = (res.Items || []).filter((item) => item.userId === userId).sort((a, b) => {
        const ta = Date.parse(a.timestamp || "") || 0;
        const tb = Date.parse(b.timestamp || "") || 0;
        return tb - ta;
      });
      return json(200, items);
    }

    if (route === "/api/advice" && method === "GET") {
      if (!ADVICE_TABLE) return json(500, { message: "Advice table not configured" });
      const userId = event.queryStringParameters?.userId || DEFAULT_USER_ID;
      const date = getJstDateYmd(Date.now());
      const adviceKey = `${userId}#${date}`;

      const existing = await client
        .get({
          TableName: ADVICE_TABLE,
          Key: { id: adviceKey },
        })
        .promise();
      if (existing.Item) {
        return json(200, existing.Item);
      }

      const memoText = await fetchRecentMemoText(userId);
      const { advice, nextAction } = await generateAdvice(memoText);
      const item = {
        id: adviceKey,
        userId,
        date,
        advice,
        next_action: nextAction,
        created_at: formatJstTimestamp(new Date()),
      };
      await client
        .put({
          TableName: ADVICE_TABLE,
          Item: item,
        })
        .promise();
      return json(200, item);
    }

    if (route === "/api/daily-report-draft" && method === "PUT") {
      if (!DAILY_REPORTS_TABLE) return json(500, { message: "Daily reports table not configured" });
      const userId = event.queryStringParameters?.userId || DEFAULT_USER_ID;
      const body = parseBody(event.body, event.isBase64Encoded) || {};
      const dateYmd = (body.date || getJstDateYmd(Date.now())).trim();
      const dateKey = dateYmd.replace(/-/g, "");
      const reportText = String(body.report_text || "").trim();
      if (!reportText) return json(400, { message: "report_text is required" });
      const id = `${userId}#${dateKey}`;
      const now = formatJstTimestamp(new Date());
      const res = await client
        .update({
          TableName: DAILY_REPORTS_TABLE,
          Key: { id },
          UpdateExpression:
            "SET userId = if_not_exists(userId, :userId), #date = if_not_exists(#date, :date), report_text = :report_text, report_updated_at = :updated_at",
          ExpressionAttributeNames: { "#date": "date" },
          ExpressionAttributeValues: {
            ":userId": userId,
            ":date": dateYmd,
            ":report_text": reportText,
            ":updated_at": now,
          },
          ReturnValues: "ALL_NEW",
        })
        .promise();
      return json(200, res.Attributes || {});
    }

    if (route === "/api/daily-reports" && method === "GET") {
      if (!DAILY_REPORTS_TABLE) return json(500, { message: "Daily reports table not configured" });
      const userId = event.queryStringParameters?.userId || DEFAULT_USER_ID;
      const res = await client
        .scan({
          TableName: DAILY_REPORTS_TABLE,
          Limit: 200,
        })
        .promise();
      const items = (res.Items || [])
        .filter((item) => item.userId === userId)
        .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
      return json(200, items);
    }

    if (route === "/api/shared-footprints" && method === "GET") {
      if (!SHARED_FOOTPRINTS_TABLE) {
        return json(500, { message: "Shared footprints table not configured" });
      }
      const res = await client
        .scan({
          TableName: SHARED_FOOTPRINTS_TABLE,
          Limit: 100,
        })
        .promise();
      const items = (res.Items || []).sort((a, b) => (b.created_at_ms || 0) - (a.created_at_ms || 0));
      return json(200, items);
    }

    if (route === "/api/shared-footprints" && method === "POST") {
      if (!SHARED_FOOTPRINTS_TABLE) {
        return json(500, { message: "Shared footprints table not configured" });
      }
      const body = parseBody(event.body, event.isBase64Encoded) || {};
      const userId = String(body.userId || body.user_id || DEFAULT_USER_ID).trim() || DEFAULT_USER_ID;
      const userName = String(body.userName || body.user_name || userId).trim() || userId;
      const content = String(body.content || "").trim();
      if (!content) return json(400, { message: "content is required" });
      const summaryInput = String(body.summary || "").trim();
      const now = Date.now();
      const item = {
        id: `footprint_${now}`,
        userId,
        userName,
        summary: summaryInput || buildFootprintSummary(content),
        content,
        created_at: formatJstTimestamp(new Date(now)),
        created_at_ms: now,
      };
      await client
        .put({
          TableName: SHARED_FOOTPRINTS_TABLE,
          Item: item,
        })
        .promise();
      return json(201, item);
    }

    if (route.startsWith("/api/tasks/") && method === "PATCH") {
      if (!TASK_TABLE) return json(404, { message: "Task table not configured" });
      const taskId = route.split("/")[3];
      if (!taskId) return json(400, { message: "taskId is required" });
      const body = parseBody(event.body, event.isBase64Encoded) || {};
      const status = String(body.status || "").trim();
      if (!status) return json(400, { message: "status is required" });
      const now = new Date().toISOString();
      try {
        const res = await client
          .update({
            TableName: TASK_TABLE,
            Key: { id: taskId },
            UpdateExpression: "SET #status = :status, updated_at = :updated_at",
            ExpressionAttributeNames: { "#status": "status" },
            ExpressionAttributeValues: {
              ":status": status,
              ":updated_at": now,
            },
            ConditionExpression: "attribute_exists(id)",
            ReturnValues: "ALL_NEW",
          })
          .promise();
        return json(200, res.Attributes || {});
      } catch (err) {
        if (err.code === "ConditionalCheckFailedException") {
          return json(404, { message: "Task not found" });
        }
        throw err;
      }
    }

    if (route === "/api/villages" && method === "GET") {
      return json(200, []);
    }

    if (route === "/api/activities" && method === "POST") {
      const body = parseBody(event.body, event.isBase64Encoded) || {};
      return json(200, {
        status: "ok",
        activityId: `activity_${Date.now()}`,
        received: body,
      });
    }

    if (route === "/api/support" && method === "POST") {
      const body = parseBody(event.body, event.isBase64Encoded) || {};
      return json(200, {
        status: "ok",
        userId: body.userId || null,
        count: 1,
      });
    }

    if (route.startsWith("/api/users/") && route.endsWith("/dashboard") && method === "GET") {
      const userId = route.split("/")[3];
      return json(200, {
        user: { userId },
        tasks: {
          pending: [],
          inprogress: [],
          done: [],
        },
        recentTweets: [],
        cheer: { count: 0 },
      });
    }

    if (route.startsWith("/api/activities/footprints/") && method === "GET") {
      const userId = route.split("/")[4];
      return json(200, {
        userId,
        currentStatus: {
          activeSkills: [],
          todaysTasks: [],
          emotionalState: {
            positive: 70,
            negative: 20,
            neutral: 10,
            dominantEmotion: "前向き",
          },
        },
        footprints: [],
        insights: {
          growingSkills: [],
          stagnantSkills: [],
          recommendedFocus: "",
          nextMilestone: "",
        },
      });
    }

    if (route.startsWith("/api/users/") && route.endsWith("/footprints") && method === "GET") {
      const userId = route.split("/")[3];
      return json(200, { userId, footprints: [] });
    }

    if (route.startsWith("/api/mentors/recommend/") && method === "GET") {
      return json(200, []);
    }

    if (route === "/tweets" && method === "GET") {
      const userId = event.queryStringParameters?.userId || DEFAULT_USER_ID;
      const res = await client
        .scan({
          TableName: TABLE,
          Limit: 50,
        })
        .promise();
      const items = (res.Items || []).filter((item) => item.userId === userId).sort((a, b) => {
        const ta = Date.parse(a.timestamp || "") || 0;
        const tb = Date.parse(b.timestamp || "") || 0;
        return tb - ta;
      });
      return json(200, items);
    }

    if (route === "/tweets" && method === "POST") {
      const body = parseBody(event.body, event.isBase64Encoded);
      console.log("parsedBody", body);
      if (!body || body.text === undefined || body.text === null) {
        console.warn("post /tweets: invalid body", { body });
        return json(400, { message: "text is required" });
      }
      const now = Date.now();
      const timestamp = formatJstTimestamp(new Date(now));
      const userId = (body.userId || body.user_id || "").trim() || DEFAULT_USER_ID;
      const item = {
        id: `tweet-${now}`,
        text: body.text,
        visibility: body.visibility || "private",
        mode: body.mode || "memo",
        userId,
        timestamp,
      };
      console.log("put item", item);
      const putRes = await client
        .put({
          TableName: TABLE,
          Item: item,
        })
        .promise();
      console.log("put result", putRes);

      if (DAILY_REPORTS_TABLE) {
        await updateDailyReport(userId, timestamp);
      }

      return json(201, item);
    }

    return json(404, { message: "Not Found" });
  } catch (err) {
    console.error(err);
    return json(500, { message: "Internal Server Error" });
  }
};

async function analyzeTweet(text) {
  const prompt = `以下のつぶやきを分析してJSONのみで回答してください。

つぶやき: "${text}"

出力JSONフォーマット:
{
  "isTask": true/false,
  "isPositive": true/false,
  "isNegative": true/false,
  "extractedTask": "タスク名（タスクがある場合のみ）",
  "skill": "関連スキル名（タスクがある場合のみ）"
}

項目説明:
- isTask: 業務タスクとして具体的に実行可能な内容が含まれる場合は true。それ以外は false。
- isPositive: ポジティブな感情や達成感が含まれる場合は true。
- isNegative: ネガティブな感情や不安・困難が含まれる場合は true。
- extractedTask: タスクがある場合のみ、短く具体的な名詞句に整形したタスク名。タスクが無い場合は空文字または null。
- skill: タスクに関連するスキル名を1つだけ記載。タスクが無い場合は空文字または null。
必ずJSONのみで回答し、前後の説明文は付けないでください。`;

  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  };

  const res = await bedrock
    .invokeModel({
      modelId: BEDROCK_MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    })
    .promise();

  const raw = decodeBody(res.body);
  const parsed = safeJsonParse(raw);
  const textOut = parsed?.content?.[0]?.text || "";
  const result = extractJson(textOut);
  return {
    isTask: Boolean(result?.isTask),
    isPositive: Boolean(result?.isPositive),
    isNegative: Boolean(result?.isNegative),
    extractedTask: result?.extractedTask || null,
    skill: result?.skill || null,
  };
}

function decodeBody(body) {
  if (!body) return "";
  if (Buffer.isBuffer(body)) return body.toString("utf-8");
  if (typeof body === "string") return body;
  if (body instanceof Uint8Array) return Buffer.from(body).toString("utf-8");
  return String(body);
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (_e) {
    return null;
  }
}

function extractJson(text) {
  const direct = safeJsonParse(text);
  if (direct) return direct;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};
  return safeJsonParse(match[0]) || {};
}

function parseBody(body, isBase64Encoded) {
  if (body == null) return null;
  let str = body;
  try {
    if (isBase64Encoded) {
      str = Buffer.from(body, "base64").toString("utf-8");
    }
    return JSON.parse(str);
  } catch (_e) {
    console.warn("parseBody failed", { isBase64Encoded, bodySnippet: String(str).slice(0, 200) });
    return null;
  }
}

function formatJstTimestamp(date) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}+09:00`;
}

function getJstDateYmd(ms) {
  const jstMs = ms + 9 * 60 * 60 * 1000;
  return new Date(jstMs).toISOString().slice(0, 10);
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
    },
    body: JSON.stringify(body),
  };
}

function isAuthorized(headers = {}) {
  if (!SHARED_TOKEN) return false;
  const auth = headers.Authorization || headers.authorization;
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) return false;
  const token = auth.slice(7).trim();
  return token && token === SHARED_TOKEN;
}

function buildFootprintSummary(content) {
  const plain = String(content || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return "共有されたあしあと";
  const short = plain.length > 60 ? `${plain.slice(0, 60)}...` : plain;
  return `🌱 ${short}`;
}

async function updateDailyReport(userId, timestamp) {
  if (!DAILY_REPORTS_TABLE) return;
  const targetDate = getJstDateYmd(Date.parse(timestamp) || Date.now());
  const dateKey = targetDate.replace(/-/g, "");
  const res = await client
    .scan({
      TableName: TABLE,
      Limit: 200,
    })
    .promise();
  const items = (res.Items || []).filter((item) => {
    if (!item || item.userId !== userId) return false;
    if (!item.timestamp) return false;
    const day = getJstDateYmd(Date.parse(item.timestamp) || 0);
    return day === targetDate;
  });
  const total = items.length;
  const positive = items.filter((i) => i.isPositive).length;
  const negative = items.filter((i) => i.isNegative).length;
  const tasks = items.filter((i) => i.isTask).length;
  const pct = (count) => (total ? Math.round((count / total) * 100) : 0);
  const reportItem = {
    id: `${userId}#${dateKey}`,
    userId,
    date: targetDate,
    total,
    positive_count: positive,
    negative_count: negative,
    task_count: tasks,
    positive_pct: pct(positive),
    negative_pct: pct(negative),
    task_pct: pct(tasks),
    updated_at: formatJstTimestamp(new Date()),
  };
  await client
    .put({
      TableName: DAILY_REPORTS_TABLE,
      Item: reportItem,
    })
    .promise();
}

async function fetchRecentMemoText(userId) {
  const res = await client
    .scan({
      TableName: TABLE,
      Limit: 200,
    })
    .promise();
  const todayMs = Date.now();
  const last7Dates = new Set(
    Array.from({ length: 7 }, (_, i) => getJstDateYmd(todayMs - i * 24 * 60 * 60 * 1000)),
  );
  const items = (res.Items || []).filter((item) => {
    if (!item || item.userId !== userId) return false;
    const mode = (item.mode || "memo").toLowerCase();
    if (mode !== "memo") return false;
    if (!item.timestamp) return false;
    const day = getJstDateYmd(Date.parse(item.timestamp) || 0);
    return last7Dates.has(day);
  });
  const texts = items.map((i) => `- ${i.text || ""}`).join("\n");
  return texts;
}

async function generateAdvice(memoText) {
  if (!memoText) {
    return {
      advice: "最近のメモがありません。今日の目標を一つだけ書くと流れが作りやすいです。",
      nextAction: "今日やることを1つだけメモする",
    };
  }
  const prompt = `以下は直近7日間のメモです。1文のアドバイスと、次の行動を1つだけ提案してください。

メモ:
${memoText}

出力JSONフォーマット:
{
  "advice": "1文のアドバイス",
  "next_action": "具体的な次の行動1つ"
}

必ずJSONのみで回答してください。`;

  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  };

  const res = await bedrock
    .invokeModel({
      modelId: BEDROCK_MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    })
    .promise();

  const raw = decodeBody(res.body);
  const parsed = safeJsonParse(raw);
  const textOut = parsed?.content?.[0]?.text || "";
  const result = extractJson(textOut);
  return {
    advice: result?.advice || "最近の動きを振り返って、優先度の高いことに集中すると良いです。",
    nextAction: result?.next_action || "今日の最優先タスクを1つ選ぶ",
  };
}
