terraform {
  required_version = ">= 1.14.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.0"
    }
  }
}

locals {
  frontend_base_urls = compact([
    var.frontend_local_url,
    var.frontend_prod_url,
  ])

  callback_urls = local.frontend_base_urls

  logout_urls = [
    for url in local.frontend_base_urls :
    "${trimsuffix(url, "/")}/logout/"
  ]
}

resource "aws_cognito_user_pool" "this" {
  name                     = "${var.project}-user-pool"
  alias_attributes         = ["email"]
  auto_verified_attributes = ["email"]

  tags = {
    Project = var.project
    Env     = var.env
  }
}

resource "aws_cognito_user_pool_client" "this" {
  name                                 = "${var.project}-public-client"
  user_pool_id                         = aws_cognito_user_pool.this.id
  generate_secret                      = false
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
  supported_identity_providers         = ["COGNITO"]

  callback_urls = local.callback_urls
  logout_urls   = local.logout_urls
}

resource "aws_cognito_user_pool_domain" "this" {
  domain       = var.cognito_domain_prefix
  user_pool_id = aws_cognito_user_pool.this.id
}
