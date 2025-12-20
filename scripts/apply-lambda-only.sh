#!/usr/bin/env bash
set -euo pipefail

# Apply only the Lambda-related Terraform targets to shorten update time.
# Usage: ./scripts/apply-lambda-only.sh [path-to-tfvars]

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF_DIR="${ROOT_DIR}/backend"
TFVARS_FILE="${1:-${TF_DIR}/prod.tfvars}"

if [[ ! -f "${TFVARS_FILE}" ]]; then
  echo "tfvars not found: ${TFVARS_FILE}" >&2
  exit 1
fi

cd "${TF_DIR}"

terraform apply \
  -var-file="${TFVARS_FILE}" \
  -target=aws_lambda_function.tweets \
  -target=aws_lambda_function.report \
  -target=aws_lambda_function.ai_execute \
  -auto-approve
