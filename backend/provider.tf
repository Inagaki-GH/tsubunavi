provider "aws" {
  region = var.aws_region
}

terraform {
  backend "s3" {
    bucket = "tsubunavi-tfbackend"
    key    = "tsubunavi/terraform.tfstate"
    region = "us-east-1"
  }
}
