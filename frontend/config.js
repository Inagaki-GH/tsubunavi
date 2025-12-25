// 本番モードでAPI Gatewayに接続する設定
// shared_token は terraform.tfvars で設定した値に置き換えてください（このファイルをコミットしない運用を推奨）
window.API_CONFIG = {
  baseUrl: "https://k5b9gbeg6g.execute-api.us-east-1.amazonaws.com",
  token: "tsubunavitokenvalue",
  mode: "api"
};
