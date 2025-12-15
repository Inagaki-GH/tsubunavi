# つぶなび（ローカルモック）
- 社内AIハッカソンのプロダクト
- われわれの「最強のAI相棒」

## セットアップ
1. Node 24系を用意
2. 初期化と依存追加
   ```bash
   npm init -y
   npm install --save-dev lite-server
   # lite-serverの依存不足が出た場合は適宜追加（例: moment）
   npm install --save-dev moment
   ```
3. `package.json` の `scripts` に開発サーバを追加
   ```json
   {
     "scripts": {
       "dev": "lite-server"
     }
   }
   ```

## サーバ起動
```bash
npm run dev
```
- `http://localhost:3000`（デフォルト）で `index.html` を配信（中身はTweet専用ビューと同等）
- `file://` で開くと `fixtures/*.json` が読めず動かないので、必ず `npm run dev` を使用
- `tweet.html`（Tweet & Log単体ビュー）も同じサーバで閲覧可能

### Tweetページだけ開く
```bash
npm run dev:tweet
```
- `http://localhost:3000/tweet.html` を自動で開く（`bs-config-tweet.json` を使用）

## API接続の設定（フロント→API Gateway）
- `frontend/config.example.js` を `config.js` にコピーし、`baseUrl` にAPI GatewayのURL、`token` にTerraformの`shared_token`値を設定、`mode` を `"api"` にすると本番モードでAPIに接続します（`config.js`はコミットしない）。
- `mode` が未設定または `"local"` の場合はローカルfixturesのみで表示し、APIにはアクセスしません（ローカルストレージ保存なし）。
- 参考: 現在デプロイ済みのAPI Gateway URLは `https://ydprwb200e.execute-api.us-east-1.amazonaws.com`。`token` はTerraformの`shared_token`に合わせて各自設定してください。

### よくある確認ポイント（Local mode になる場合）
- `config.js` の `token` がプレースホルダ（change-meなど）のままになっていないか。
- `config.js` の `mode` が `"api"` になっているか（大文字小文字含めて確認）。
- 変更後にブラウザをリロード（キャッシュクリア）しているか。
- Networkタブで `config.js` が200/304で読まれているかを確認し、コンソールに `API mode (...)` と表示されるか確認する。

## Terraformの適用手順（アクセスキー + MFAセッショントークン利用）
1. AWSの一時クレデンシャルを取得（例: `aws sts get-session-token --serial-number arn:aws:iam::<account>:mfa/<user> --token-code <MFAコード>`）
2. 取得した`AccessKeyId`/`SecretAccessKey`/`SessionToken` を環境変数にセット  
   ```bash
   export AWS_ACCESS_KEY_ID=XXXXXXXX
   export AWS_SECRET_ACCESS_KEY=YYYYYYYY
   export AWS_SESSION_TOKEN=ZZZZZZZZ
   export AWS_DEFAULT_REGION=us-east-1
   ```
3. Terraformの初期化（初回のみ）  
   ```bash
   cd backend
   terraform init
   ```
4. tfvarsを用意し、`shared_token` やバケット名などを設定（`prod.tfvars` を利用する場合は適宜編集）。
5. 適用  
   ```bash
   terraform apply -var-file=prod.tfvars
   ```
6. 反映後、`AWS_SESSION_TOKEN` の有効期限が切れたら再取得してください。

## Bedrockモデル設定
- 日報生成Lambdaのモデルは変数で切り替え可能。デフォルトは `anthropic.claude-3-haiku-20240307-v1:0`（オンデマンド対応モデル）。  
- `backend/variables.tf` の `bedrock_model_id` を変更するか、`terraform apply -var 'bedrock_model_id=...'` で上書きしてください。

## API呼び出し（ローカル開発）
- PoCではCognitoを使わず、共有Bearerトークンで保護しています（API Gateway + Lambda内で検証）。
- Terraformの `shared_token` に設定した値をフロント/クライアントで保持し、`Authorization: Bearer <shared_token>` を付けて `GET/POST /tweets` を呼び出してください。
- トークンはリポジトリにコミットせず、`.env.local` 等で管理してください。

## ディレクトリ構成（想定）
- `index.html` / `style.css` / `app.js`
- `fixtures/skills.json` `fixtures/tweets.json` `fixtures/matches.json` `fixtures/will.json`
- `image/logo_placeholder.svg` `image/avatar_placeholder.svg`
