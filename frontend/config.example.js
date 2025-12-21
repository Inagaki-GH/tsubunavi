// ローカルでAPI Gatewayに接続するための設定サンプル
// このファイルを config.js にコピーして値を設定してください。
// 本番のクレデンシャルはコミットしないでください。
window.API_CONFIG = {
  // 例: "https://abcdefghij.execute-api.us-east-1.amazonaws.com"
  baseUrl: "https://your-api-endpoint",
  // 任意: BedrockモデルID（未指定時はバックエンドのデフォルト）
  modelId: "anthropic.claude-3-5-sonnet-20240620-v1:0",
  // 任意: 別のAPIベースURL（/api のREST用）
  apiBaseUrl: "http://localhost:8000/api",
  // Terraformのshared_tokenに設定した値を入れてください
  token: "change-me",
  // "api" ならバックエンド経由、"local" ならfixtures + localStorage（デフォルトは "local"）
  mode: "local"
};
