data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda"
  output_path = "${path.module}/lambda/build.zip"
}

resource "aws_iam_role" "lambda" {
  name               = "${var.project}-${var.env}-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json

  tags = {
    Project = var.project
    Env     = var.env
  }
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "lambda_policy" {
  statement {
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:*"]
  }

  statement {
    actions = [
      "dynamodb:PutItem",
      "dynamodb:GetItem",
      "dynamodb:Scan",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
    ]
    resources = [aws_dynamodb_table.tweets.arn]
  }
}

resource "aws_iam_role_policy" "lambda" {
  name   = "${var.project}-${var.env}-lambda-policy"
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.lambda_policy.json
}

resource "aws_iam_role" "report_lambda" {
  name               = "${var.project}-${var.env}-report-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json

  tags = {
    Project = var.project
    Env     = var.env
  }
}

data "aws_iam_policy_document" "report_lambda_policy" {
  statement {
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:*"]
  }

  statement {
    actions   = ["bedrock:InvokeModel"]
    resources = ["*"]
  }

  statement {
    actions = [
      "dynamodb:Scan",
      "dynamodb:Query",
      "dynamodb:GetItem"
    ]
    resources = [aws_dynamodb_table.tweets.arn]
  }

  # Model access via AWS Marketplace (required for some Bedrock models)
  statement {
    actions = [
      "aws-marketplace:ViewSubscriptions",
      "aws-marketplace:Subscribe"
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "report_lambda" {
  name   = "${var.project}-${var.env}-report-lambda-policy"
  role   = aws_iam_role.report_lambda.id
  policy = data.aws_iam_policy_document.report_lambda_policy.json
}

resource "aws_iam_role" "ai_lambda" {
  name               = "${var.project}-${var.env}-ai-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json

  tags = {
    Project = var.project
    Env     = var.env
  }
}

data "aws_iam_policy_document" "ai_lambda_policy" {
  statement {
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:*"]
  }

  statement {
    actions   = ["bedrock:InvokeModel"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "ai_lambda" {
  name   = "${var.project}-${var.env}-ai-lambda-policy"
  role   = aws_iam_role.ai_lambda.id
  policy = data.aws_iam_policy_document.ai_lambda_policy.json
}

data "aws_caller_identity" "current" {}

resource "aws_lambda_function" "tweets" {
  function_name = "${var.project}-${var.env}-tweets"
  role          = aws_iam_role.lambda.arn
  handler       = "index.handler"
  runtime       = "nodejs24.x"
  timeout       = 30

  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  environment {
    variables = {
      TABLE_NAME   = aws_dynamodb_table.tweets.name
      SHARED_TOKEN = var.shared_token
    }
  }

  tags = {
    Project = var.project
    Env     = var.env
  }
}

resource "aws_lambda_function" "report" {
  function_name = "${var.project}-${var.env}-report"
  role          = aws_iam_role.report_lambda.arn
  handler       = "report.handler"
  runtime       = "nodejs24.x"
  timeout       = 30

  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  environment {
    variables = {
      BEDROCK_MODEL_ID = var.bedrock_model_id
      SHARED_TOKEN     = var.shared_token
      TABLE_NAME       = aws_dynamodb_table.tweets.name
    }
  }

  tags = {
    Project = var.project
    Env     = var.env
  }
}

resource "aws_lambda_function" "ai_execute" {
  function_name = "${var.project}-${var.env}-ai-execute"
  role          = aws_iam_role.ai_lambda.arn
  handler       = "ai_execute.handler"
  runtime       = "nodejs24.x"
  timeout       = 30

  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  environment {
    variables = {
      BEDROCK_MODEL_ID = var.bedrock_model_id
      SHARED_TOKEN     = var.shared_token
    }
  }

  tags = {
    Project = var.project
    Env     = var.env
  }
}

resource "aws_apigatewayv2_api" "http" {
  name          = "${var.project}-${var.env}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_credentials = false
    allow_headers     = ["Content-Type", "Authorization"]
    allow_methods     = ["GET", "POST", "OPTIONS"]
    allow_origins     = compact([var.frontend_local_url, var.frontend_prod_url])
  }
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.tweets.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "report" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.report.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_integration" "ai_execute" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.ai_execute.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "get_tweets" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /tweets"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "post_tweets" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /tweets"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "post_reports" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /reports"
  target    = "integrations/${aws_apigatewayv2_integration.report.id}"
}

resource "aws_apigatewayv2_route" "post_ai_execute" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /ai/execute"
  target    = "integrations/${aws_apigatewayv2_integration.ai_execute.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.tweets.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*/tweets"
}

resource "aws_lambda_permission" "apigw_report" {
  statement_id  = "AllowAPIGatewayInvokeReport"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.report.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*/reports"
}

resource "aws_lambda_permission" "apigw_ai_execute" {
  statement_id  = "AllowAPIGatewayInvokeAiExecute"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ai_execute.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*/ai/execute"
}
