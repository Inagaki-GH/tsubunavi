aws_region           = "us-east-1"
project              = "tsubunavi"
env                  = "prod"
frontend_local_url   = "http://localhost:3000"
# 本番のCloudFront URLを設定（未確定なら null のままでもOK）
frontend_prod_url    = "https://d2u8jo08sci6u0.cloudfront.net"

# Cognito Hosted UIのドメインプレフィックス（グローバルで一意にする）
cognito_domain_prefix = "tsubunavi-unique-prefix"

# APIの簡易認証用トークン（PoC用）。実運用ではSecrets等で管理し、ここには記載しない。
shared_token = "tsubunavitokenvalue"

# 静的ホスティング用S3バケット名（グローバル一意）
s3_bucket_name = "tsubunavi-frontend-unique-bucket"

# DynamoDBテーブル名（必要に応じて変更）
dynamodb_table_name = "tsubunavi-tweets"
dynamodb_tasks_table_name = "tsubunavi-tasks"
dynamodb_advice_table_name = "tsubunavi-advice"
dynamodb_daily_reports_table_name = "tsubunavi-daily-reports"

# CloudFront価格クラス（コスト調整用）
cf_price_class = "PriceClass_200"
