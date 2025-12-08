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
- `http://localhost:3000`（デフォルト）で `index.html` を配信
- `file://` で開くと `fixtures/*.json` が読めず動かないので、必ず `npm run dev` を使用
- `tweet.html`（Tweet & Log単体ビュー）も同じサーバで閲覧可能

## ディレクトリ構成（想定）
- `index.html` / `style.css` / `app.js`
- `fixtures/skills.json` `fixtures/tweets.json` `fixtures/matches.json` `fixtures/will.json`
- `image/logo_placeholder.svg` `image/avatar_placeholder.svg`
