つぶなび 基本設計（Vanilla実装ガイド）
==================================

概要
- 外部SaaS/LLM APIなし、Node 24系（現行LTS） + 静的HTML/CSS/JSで完結。
- サーバは`npm run dev`で`lite-server`を起動し`http://localhost`配信（ライブリロード付き）。`file://`は禁止（CORS回避）。
- フレームワーク/ライブラリ不使用。ESM非使用でも動く1ファイルJS前提。外部CDNやフォントは使わない。
- パッケージ方針: 依存は最小（`lite-server`のみ想定）。バージョンは常に最新安定（LTS系）を採用し、固定しない。

画面分割
- `index.html`にセクションを固定配置（Hero / My Career Roadmap / Tweet & Log / Match & Consult / Daily Sync）。
- `app.js`でセクションのルートDOMを取得し、描画関数で中身を差し替える。

画面設計（UI構成イメージ）
- レイアウト: 横2カラム（左: Tweet & Log / Daily / 最近のつぶやき、右: Roadmap / Match）。PC幅想定、モバイルは縦並びに崩してOK。
- Tweet & Logセクション
  - 入力: テキストエリア（プレースホルダ「今日の現場で感じたこと、学んだことをつぶやこう（140文字以内）」）。
  - 公開範囲: ラジオ（社内限定/公開）。
  - モード選択: 「メモモード（蓄積のみ/AI応答なし）」と「相談モード（AI応答あり）」をラジオなどで切替。ローカルモックでは相談モードはスタブ応答を表示するのみ。
  - 送信ボタン、直近解析結果カード（経験値、抽出スキルタグ、スタンスタグを列挙）。
  - 最近のつぶやきリスト: 日付+本文のカードリスト。
- My Career Roadmap
  - Will表示: Goal/期間/現在ステータスをテキストで表示。
  - スキルバー: 各スキルのベース値バー（pt表記）と「今日+Xpt」の上乗せバーを色分け表示。
  - 交差点メモ: 別ルート提案の短文（例: 「技術特化のスペシャリストルートも狙えます」）。
- Match & Consult
  - 共通タグ表示（例: 顧客折衝、課題分解、フロント志向）。
  - 候補カード: 顔写真（省略可）、氏名/役職/共通タグ、メッセージ案ボタン。
  - メッセージ案モーダル: 定型文を表示するだけで送信なし。
- Daily Sync（任意）
  - 初期表示あり。初期値は+0ptとする。
  - 今日の経験値獲得レポート（例: Total:+25pt）。
  - 日報ドラフトのダミーテキストを表示。

状態モデル（app.js）
- `state.skills`: fixturesのスキルノード配列 `{id,name,category,level,delta_today,recommended_action}`
- `state.tweets`: つぶやき配列 `{id,text,visibility,mode,extracted_skills,extracted_stance,gained_points,ai_reply?}`
- `state.matches`: マッチ候補配列 `{id,name,role,common_tags,message_suggestion}`
- `state.will`: Will設定 `{goal_role,timeline,traits}` を固定値で保持
- `state.tweetInput`: 投稿フォームの一時値（text, visibility, mode）

フィクスチャ読み込み
- 起動時に`fetch('./fixtures/skills.json')`等で読み込み、`Promise.all`完了後に初期描画。
- `fixtures`ディレクトリは`index.html`と同階層。必ず`npm run dev`でHTTP起動して読み込む。

主な関数（app.js）
- `renderSkills(state)`: 現在値と`delta_today`をレイヤーで表示（バー+当日ハイライト）。
- `renderTweets(state)`: 投稿履歴と解析結果カードを一覧表示。
- `renderMatches(state)`: 共通項タグと候補カードを表示。
- `renderDaily(state)`: 今日の経験値サマリと日報ドラフトを表示（任意セクション）。
- `handleTweetSubmit()`: 入力テキストをルールベースでタグ抽出 → `delta_today`更新 → 各描画を再実行。

タグ抽出ルール例（app.jsにハードコード）
- `"バグ","不具合","デグレ"` → `extracted_skills += ["問題解決"]`
- `"顧客","提案","商談"` → `extracted_skills += ["顧客折衝"]`
- `"設計","レビュー"` → `extracted_skills += ["設計力"]`
- スタンスタグ例: `"振り返り","学び"` → `extracted_stance += ["自省"]`
- `gained_points`/`delta_today`は固定値（例:+2pt）で加算し、同一セッション内のみ有効。

visibility仕様
- 許容値: `"private"` または `"public"`。
- 解析結果カード表示: `"private"` → 「プライベート」表記、`"public"` → 「公開」表記。

モード仕様
- 許容値: `"memo"`（メモモード/蓄積のみ/AI応答なし）、`"consult"`（相談モード/AI応答あり）。
- ローカルモックでは `"consult"` 選択時に固定のスタブ応答テキスト `ai_reply` を表示するだけで、外部APIは呼ばない。

スタイル指針（style.css）
- CSS変数で`--bg`,`--fg`,`--accent`など基本色と`--radius`,`--shadow`を定義。
- 共通ユーティリティ: 余白ユーティリティ（必要最小限）、`.card`、フレックス/グリッド簡易クラス。
- フォントはシステムUIで統一し、外部CDNフォントは使わない。

プロンプトテンプレ（VSCode拡張向け）
- 「外部CDNなし」「type='module'を使わない」「プレーンCSS/JSのみ」「sectionごとに`data-section`属性を付与」「アクセシビリティを考慮しheading階層を正しく」など制約を冒頭に記載。

動作フロー
1) `npm run dev`でサーバ起動 → 初期`fetch` → stateセット → 各セクションをrender
2) 投稿フォームでつぶやき入力 → ルール抽出 → state更新 → render

インフラ/スタブ方針
- 本番想定: フロントは S3 + CloudFront（静的配信）、API は API Gateway + Lambda、データは DynamoDB、LLMは Bedrock を想定。
- ローカル検証: フロントは `npm run dev` のみで完結。API呼び出しは行わず `API_MODE=stub` 前提のローカルスタブレスポンス、AIも `AI_MODE=stub` で固定応答。
- スタブ実装: `apiClient` を一箇所に置き、`API_MODE=stub|aws` / `AI_MODE=stub|bedrock` で切替。stub時はハードコードレスポンス、AWS時はAPI Gateway/Bedrockを呼ぶ。
- CORS/接続: AWS接続時は `http://localhost:3000` をCORS許可。認証情報をフロントに埋め込まない（将来はCognito等で取得）。
- データ永続: ローカルは localStorage でTweetのみ永続。DynamoDB接続は後続フェーズで同インターフェースに差し替える。

認証方針（Cognito）
- フロー: Authorization Code + PKCE を採用（Implicit/ROPCは非採用）。Cognito標準ドメインを使用し、クライアントはパブリックのみ。
- リダイレクト: ローカル `http://localhost:3000`、本番は CloudFront ドメインを Callback/Logout として登録。ログアウトパスは `/logout/` を使用。
- 構成: ユーザプールは email + username。外部IdPなし、ポリシーはデフォルト（必要に応じてMFA等は後日設定）。
- トークン管理: フロントでは`sessionStorage`/メモリ利用を前提に、リフレッシュトークンを取得する構成を想定（セキュリティ重視で`localStorage`は避ける）。

フィクスチャJSONサンプル（`fixtures/`）
- skills.json
```json
[
  {
    "id": "skill-impl",
    "name": "実装能力 (Java/Python)",
    "category": "engineering",
    "level": 70,
    "delta_today": 0,
    "recommended_action": "コードレビューで設計意図を説明する"
  },
  {
    "id": "skill-aws",
    "name": "クラウド活用 (AWS)",
    "category": "cloud",
    "level": 40,
    "delta_today": 0,
    "recommended_action": "ECSのタスク定義を更新しデプロイする"
  }
]
```
- tweets.json
```json
[
  {
    "id": "tweet-1",
    "text": "今日のバグ対応、根本原因が仕様の認識違いだと特定できた。ヒアリング大事。（社内限定）",
    "visibility": "private",
    "mode": "memo",
    "extracted_skills": ["問題解決"],
    "extracted_stance": ["自省"],
    "gained_points": 15
  },
  {
    "id": "tweet-2",
    "text": "顧客要望の背景に本質課題がありそう。追加ヒアリングを提案。（公開）",
    "visibility": "public",
    "mode": "consult",
    "extracted_skills": ["顧客折衝"],
    "extracted_stance": ["本質志向"],
    "gained_points": 10,
    "ai_reply": "ヒアリングの論点を3つに絞ると進めやすいです。次回は課題の優先度を明確にして合意を取りましょう。"
  }
]
```
- matches.json
```json
[
  {
    "id": "match-1",
    "name": "佐藤めぐみ",
    "role": "営業部 / プリセールス",
    "common_tags": ["顧客折衝", "課題発見", "契約交渉"],
    "message_suggestion": "共通タグが多いので、プリセールス視点での顧客折衝のポイントを教えてもらえませんか？"
  },
  {
    "id": "match-2",
    "name": "鈴木一郎",
    "role": "開発部 / シニアPM",
    "common_tags": ["課題分解", "要件整理", "プロジェクト推進"],
    "message_suggestion": "要件整理の進め方で壁に当たっています。プロジェクト推進のコツを伺いたいです。"
  }
]
```
- will.json（任意）
```json
{
  "goal_role": "PM",
  "timeline": "3年でPMになる",
  "traits": ["順張り", "顧客志向", "整理整頓"]
}
```

データ管理 / 擬似DB設計
- 永続層は持たず、`fixtures/*.json` を初期データとして `fetch` でロードし、以降の更新はメモリ状態のみ（ブラウザリロードで初期化）。
- ファイルと主キー:
  - skills.json: `id`（必須/ユニーク）
  - tweets.json: `id`（必須/ユニーク）
  - matches.json: `id`（必須/ユニーク）
  - will.json: 単一オブジェクト（主キー不要）
- フィールド型ルール:
  - 数値: `level`/`delta_today`/`gained_points` は数値型（pt単位）。
  - 列挙: `visibility` は `"private"` | `"public"` のみ。
  - 配列: `extracted_skills`/`extracted_stance`/`common_tags` は文字列配列。
  - 任意: `recommended_action`/`message_suggestion` は文字列。顔写真パスは省略可（未使用）。
- 更新ポリシー:
  - 投稿後の追加/加算はブラウザメモリ上で`state`にのみ反映し、JSONファイルは書き換えない。
  - デモ後の初期化はブラウザリロードで実施（リセットボタンなし）。
