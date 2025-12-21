"use strict";

const { BedrockRuntime } = require("aws-sdk");

const bedrock = new BedrockRuntime({ region: process.env.AWS_REGION || "us-east-1" });
const SHARED_TOKEN = process.env.SHARED_TOKEN;
const DEFAULT_MODEL_ID = "anthropic.claude-3-5-sonnet-20240620-v1:0";

exports.handler = async (event) => {
  try {
    const route = event.rawPath || "/";
    const method = event.requestContext?.http?.method || "GET";
    console.log("request", { route, method, headers: event.headers });

    if (method === "OPTIONS") {
      return {
        statusCode: 204,
        headers: corsHeaders(event.headers),
      };
    }

    if (!isAuthorized(event.headers)) {
      return json(401, { message: "Unauthorized" });
    }

    if (route === "/ai/execute" && method === "POST") {
      const body = parseBody(event.body, event.isBase64Encoded);
      if (!body) {
        return json(400, { message: "request body is required" });
      }
      const modelId = DEFAULT_MODEL_ID;
      if (!modelId) {
        return json(400, { message: "model_id is required" });
      }
      const payload = body.payload ?? body.input ?? null;
      if (!payload) {
        return json(400, { message: "payload is required" });
      }

      const invokeParams = {
        modelId,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(payload),
      };

      const res = await bedrock.invokeModel(invokeParams).promise();
      const raw = decodeBody(res.body);
      const parsed = safeJsonParse(raw);
      return json(200, {
        model_id: modelId,
        response: parsed ?? raw,
        request_id: res?.$response?.requestId || null,
      });
    }

    return json(404, { message: "Not Found" });
  } catch (err) {
    console.error(err);
    return json(500, { message: "Internal Server Error" });
  }
};

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

function json(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

function corsHeaders(headers = {}) {
  return {
    "Access-Control-Allow-Origin": headers.origin || "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  };
}

function isAuthorized(headers = {}) {
  if (!SHARED_TOKEN) return false;
  const auth = headers.Authorization || headers.authorization;
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) return false;
  const token = auth.slice(7).trim();
  return token && token === SHARED_TOKEN;
}
