#!/usr/bin/env bash
set -euo pipefail

# フロント（ai/tsubunavi/frontend 配下）の静的ファイルを S3 にアップロードする簡易スクリプト
# 使い方:
#   S3_BUCKET=your-bucket-name ./scripts/deploy_frontend.sh
# 必要なもの: AWS CLI v2, 適切な認証情報（環境変数/プロファイル）

if [[ -z "${S3_BUCKET:-}" ]]; then
  echo "ERROR: S3_BUCKET を指定してください。例: S3_BUCKET=tsubunavi-frontend-unique-bucket ./scripts/deploy_frontend.sh" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
FRONTEND_DIR="${ROOT_DIR}/frontend"
ENV_FILE="${ROOT_DIR}/.env"

# .envがあれば読み込む（S3_BUCKETなどを定義）
if [[ -f "${ENV_FILE}" ]]; then
  set -a
  source "${ENV_FILE}"
  set +a
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "ERROR: aws CLI が見つかりません。AWS CLI v2 をインストールしてください。" >&2
  exit 1
fi

echo "Uploading frontend assets from ${FRONTEND_DIR} to s3://${S3_BUCKET}/"
aws s3 sync "${FRONTEND_DIR}/" "s3://${S3_BUCKET}/" \
  --delete \
  --exclude "node_modules/*" \
  --exclude ".git/*"

echo "Done."
