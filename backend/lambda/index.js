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
