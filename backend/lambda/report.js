"use strict";

const AWS = require("aws-sdk");
const bedrock = new AWS.BedrockRuntime({ region: process.env.AWS_REGION || "us-east-1" });
const dynamo = new AWS.DynamoDB.DocumentClient();
const MODEL_ID = process.env.BEDROCK_MODEL_ID;
const SHARED_TOKEN = process.env.SHARED_TOKEN;
const TABLE = process.env.TABLE_NAME;

exports.handler = async (event) => {
  try {
    const method = event.requestContext?.http?.method || "GET";
    const route = event.rawPath || "/";

    if (method === "OPTIONS") {
      return cors(204, {});
    }

    if (!isAuthorized(event.headers)) {
      return cors(401, { message: "Unauthorized" });
    }

    if (route === "/reports" && method === "POST") {
      const body = parseBody(event.body, event.isBase64Encoded);
      const date = (body?.date || today()).trim();
      if (!MODEL_ID) return cors(500, { message: "MODEL_ID not configured" });
      if (!TABLE) return cors(500, { message: "TABLE_NAME not configured" });

      const memoText = await fetchMemosByDate(date);
      const prompt = buildPrompt(memoText, date);
      const bedrockRes = await invokeBedrock(prompt);
      const report = bedrockRes ?? "";
      return cors(200, { report });
    }

    return cors(404, { message: "Not Found" });
  } catch (err) {
    console.error(err);
    return cors(500, { message: "Internal Server Error" });
  }
};

function parseBody(body, isBase64Encoded) {
  if (body == null) return null;
  try {
    const str = isBase64Encoded ? Buffer.from(body, "base64").toString("utf-8") : body;
    return JSON.parse(str);
  } catch (_e) {
    return null;
  }
}

function cors(statusCode, body) {
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

function buildPrompt(text, date) {
  const content = `以下の ${date} の業務メモをもとに、日報を3〜4文（または箇条書き）でまとめてください。前置きや署名は不要です。\n\nメモ:\n${text || "（メモなし）"}`;
  return [
    {
      role: "user",
      content: [{ type: "text", text: content }],
    },
  ];
}

async function invokeBedrock(messages) {
  try {
    const params = {
      modelId: MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        messages,
        max_tokens: 400,
        temperature: 0.5,
      }),
    };
    const res = await bedrock.invokeModel(params).promise();
    if (!res || !res.body) return null;
    const payload = JSON.parse(res.body.toString());
    const content = payload.content || payload.output || payload.message || payload.text;
    if (Array.isArray(content)) {
      const textBlock = content.find((c) => c.text) || content[0];
      return textBlock?.text || JSON.stringify(payload);
    }
    if (typeof content === "string") return content;
    return JSON.stringify(payload);
  } catch (e) {
    console.error("Bedrock invoke error", e);
    return `日報生成に失敗しました: ${e.message}`;
  }
}

async function fetchMemosByDate(date) {
  const res = await dynamo
    .scan({
      TableName: TABLE,
      FilterExpression: "#d = :d",
      ExpressionAttributeNames: { "#d": "created_date" },
      ExpressionAttributeValues: { ":d": date },
      Limit: 200,
    })
    .promise();
  const items = res.Items || [];
  const texts = items.map((i) => `- ${i.text || ""}`).join("\n");
  return texts;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
