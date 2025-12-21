"use strict";

const { DynamoDB } = require("aws-sdk");

const client = new DynamoDB.DocumentClient();
const TABLE = process.env.TABLE_NAME;
const SHARED_TOKEN = process.env.SHARED_TOKEN;

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
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
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
      const analysis = analyzeTweet(body.text);
      return json(201, {
        tweetId: `tweet_${Date.now()}`,
        userId: body.userId || null,
        text: body.text,
        timestamp: new Date().toISOString(),
        ...analysis,
      });
    }

    if (route === "/api/tweets" && method === "GET") {
      return json(200, []);
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
      const res = await client
        .scan({
          TableName: TABLE,
          Limit: 50,
        })
        .promise();
      const items = (res.Items || []).sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
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
      const item = {
        id: `tweet-${now}`,
        text: body.text,
        visibility: body.visibility || "private",
        mode: body.mode || "memo",
        created_at: now,
        created_date: new Date(now).toISOString().slice(0, 10), // YYYY-MM-DD
      };
      console.log("put item", item);
      const putRes = await client
        .put({
          TableName: TABLE,
          Item: item,
        })
        .promise();
      console.log("put result", putRes);

      return json(201, item);
    }

    return json(404, { message: "Not Found" });
  } catch (err) {
    console.error(err);
    return json(500, { message: "Internal Server Error" });
  }
};

function analyzeTweet(text) {
  const isTask = /作る|作成|対応|準備|実施|やる|する|しないと|まで/.test(text);
  const isPositive = /嬉しい|楽しい|良い|成功|できた|頑張|ありがと/.test(text);
  const isNegative = /難しい|困|大変|疲|辛|できない|わからない/.test(text);
  const extractedTask = isTask ? normalizeTask(text) : null;
  return {
    isTask,
    isPositive,
    isNegative,
    extractedTask,
    skill: isTask ? "課題解決" : null,
  };
}

function normalizeTask(text) {
  const patterns = [
    { regex: /(.+?)を作成する/, format: (m) => `${m[1]}の作成` },
    { regex: /(.+?)を作る/, format: (m) => `${m[1]}の作成` },
    { regex: /(.+?)の準備をしないと/, format: (m) => `${m[1]}の準備` },
    { regex: /(.+?)を準備/, format: (m) => `${m[1]}の準備` },
    { regex: /(.+?)を調査/, format: (m) => `${m[1]}の調査` },
  ];
  for (const p of patterns) {
    const m = text.match(p.regex);
    if (m) return p.format(m);
  }
  return text;
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

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
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
