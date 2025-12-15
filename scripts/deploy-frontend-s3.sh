#!/usr/bin/env bash
set -euo pipefail

# Upload static frontend to S3 (CloudFront fronting S3 is assumed).
# Usage: ./scripts/deploy-frontend-s3.sh <s3-bucket-name> [cloudfront-distribution-id]

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="${ROOT_DIR}/frontend"
BUCKET="${1:-}"
DIST_ID="${2:-}"

if [[ -z "${BUCKET}" ]]; then
  echo "Usage: $0 <s3-bucket-name> [cloudfront-distribution-id]" >&2
  exit 1
fi

if [[ ! -d "${SRC_DIR}" ]]; then
  echo "frontend directory not found: ${SRC_DIR}" >&2
  exit 1
fi

echo "Syncing ${SRC_DIR} -> s3://${BUCKET}/"
aws s3 sync "${SRC_DIR}/" "s3://${BUCKET}/" \
  --delete \
  --exclude "node_modules/*" \
  --exclude "bs-config*.json" \
  --exclude "package*.json" \
  --exclude "*.lock" \
  --exclude ".env*" \
  --exclude ".gitignore"

if [[ -n "${DIST_ID}" ]]; then
  echo "Creating CloudFront invalidation for distribution ${DIST_ID}"
  aws cloudfront create-invalidation --distribution-id "${DIST_ID}" --paths "/*"
fi

echo "Done."
