output "user_pool_id" {
  value = aws_cognito_user_pool.this.id
}

output "user_pool_client_id" {
  value = aws_cognito_user_pool_client.this.id
}

output "hosted_ui_url" {
  value = "https://${aws_cognito_user_pool_domain.this.domain}.auth.${var.aws_region}.amazoncognito.com/oauth2/authorize"
}

output "s3_bucket" {
  value = aws_s3_bucket.frontend.id
}

output "cloudfront_domain" {
  value = aws_cloudfront_distribution.frontend.domain_name
}

output "dynamodb_table" {
  value = aws_dynamodb_table.tweets.id
}

output "dynamodb_tasks_table" {
  value = aws_dynamodb_table.tasks.id
}

output "report_lambda_arn" {
  value = aws_lambda_function.report.arn
}
