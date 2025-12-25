variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Project name prefix"
  type        = string
  default     = "tsubunavi"
}

variable "env" {
  description = "Environment name (not split for now, so defaults to prod)"
  type        = string
  default     = "prod"
}

variable "frontend_local_url" {
  description = "Local frontend base URL for callback/logout (e.g. http://localhost:3000)"
  type        = string
  default     = "http://localhost:3000"
}

variable "frontend_prod_url" {
  description = "Production frontend base URL (CloudFront). Set when known."
  type        = string
  default     = null
}

variable "cognito_domain_prefix" {
  description = "Cognito hosted UI domain prefix (must be globally unique)"
  type        = string
}

variable "shared_token" {
  description = "Shared bearer token for PoC auth (do not commit real value)"
  type        = string
  sensitive   = true
}

variable "s3_bucket_name" {
  description = "S3 bucket name for hosting static frontend"
  type        = string
}

variable "dynamodb_table_name" {
  description = "DynamoDB table name for tweets/logs"
  type        = string
  default     = "tsubunavi-tweets"
}

variable "dynamodb_tasks_table_name" {
  description = "DynamoDB table name for tasks"
  type        = string
  default     = "tsubunavi-tasks"
}

variable "dynamodb_advice_table_name" {
  description = "DynamoDB table name for daily advice"
  type        = string
  default     = "tsubunavi-advice"
}

variable "dynamodb_daily_reports_table_name" {
  description = "DynamoDB table name for daily tweet reports"
  type        = string
  default     = "tsubunavi-daily-reports"
}

variable "bedrock_model_id" {
  description = "Bedrock model ID for report generation"
  type        = string
  default     = "anthropic.claude-3-5-sonnet-20240620-v1:0"
}

variable "cf_price_class" {
  description = "CloudFront price class"
  type        = string
  default     = "PriceClass_200"
}
