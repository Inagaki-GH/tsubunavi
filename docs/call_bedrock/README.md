Bedrock Call Pack
=================

目的
フロントエンド開発メンバー向けに、Bedrockの汎用呼び出し仕様と関連ファイルをまとめた共有ディレクトリ。

含まれるファイル
- ai.html: フロント検証用の汎用呼び出しUI
- ai.js: ai.htmlの動作スクリプト
- ai_execute.js: Bedrock呼び出し用のLambdaハンドラ

API仕様（汎用）
エンドポイント: `POST /ai/execute`
認証: `Authorization: Bearer <SHARED_TOKEN>`

リクエスト例
```json
{
  "model_id": "anthropic.claude-3-5-sonnet-20240620-v1:0",
  "payload": {
    "anthropic_version": "bedrock-2023-05-31",
    "max_tokens": 512,
    "messages": [
      { "role": "user", "content": "今日の学びを1文で要約して" }
    ]
  }
}
```

レスポンス例
```json
{
  "model_id": "anthropic.claude-3-5-sonnet-20240620-v1:0",
  "response": {
    "id": "msg_123",
    "type": "message",
    "role": "assistant",
    "content": [{ "type": "text", "text": "..." }]
  },
  "request_id": "abc-123"
}
```

フロント利用のポイント
- `frontend/config.js` の `baseUrl` と `token` を設定し、`mode: "api"` にする。
- `ai.html` を開き、`payload` にBedrockのリクエストJSONを記載して実行。

バックエンド利用のポイント
- `ai_execute.js` は `payload` をそのまま Bedrock に転送する汎用ゲートウェイ。
- `model_id` 未指定時は環境変数 `BEDROCK_MODEL_ID` を使用。
- 認証は `SHARED_TOKEN`（Bearer）を利用。
