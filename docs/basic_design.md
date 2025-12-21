つぶなび 基本設計（Vanilla実装ガイド）
==================================

概要
- 日々の「つぶやき」からタスク抽出・感情分析・日報生成を行うキャリア支援プロダクト。
- 3画面構成（ホーム/あしあとと里/夜の焚火広場）で、成長可視化と匿名エール体験を提供する。

画面構成（MVP）
- `home_tsubunavi.html`: つぶやき・タスク・日報・エール通知をまとめたホーム。
- `forest_tsubunavi.html`: あしあとと里（スキル可視化/探索マップ）。
- `bonfire_premium.html`: 夜の焚火広場（匿名エール/応援体験）。

画面設計（UI構成イメージ）
- ホーム（home_tsubunavi.html）
  - つぶやき投稿: 自由入力、リアルタイムで感情/タスク分析。
  - AIタスク整形: つぶやきからタスク化（例: 「API設計書を作成する予定」→「API設計書の作成」）。
  - タスクボード: 3カラム（待機中/実施中/完了）。ドラッグ&ドロップで更新。
  - 日報自動生成: つぶやき履歴とタスクをまとめて要約。
  - エール通知: 「◯名からエールが届いています」を表示（一定時間で消去）。
- あしあとと里（forest_tsubunavi.html）
  - スキル可視化: 里ごとにスキルをグループ化し、開拓済み/未開拓を区別。
  - 足跡システム: 成長の軌跡を表示し、クリックで詳細表示。
- 夜の焚火広場（bonfire_premium.html）
  - ピックアップ先人: 類似スキルの先人を提示。
  - さまよえる子羊: タスク滞留者の匿名表示。
  - エール送信: 3種類のエールボタン（💪/🔥/🌟）。送信数のみカウント。

状態モデル（MVP）
- `state.tweets`: つぶやき配列 `{id,text,emotion,tasks[],created_at}`
- `state.tasks`: タスク配列 `{id,title,status}`（待機中/実施中/完了）
- `state.report`: 日報草案 `{date,summary,tasks_by_category[],insights}`
- `state.cheers`: エール通知 `{count,updated_at}`
- `state.villages`: 里/スキル構成 `{id,name,level,locked}`
- `state.footprints`: 足跡ログ `{id,village_id,detail}`

フィクスチャ読み込み
- 起動時に`fetch('./fixtures/skills.json')`等で読み込み、`Promise.all`完了後に初期描画。
- `fixtures`ディレクトリは`index.html`と同階層。必ず`npm run dev`でHTTP起動して読み込む。

主な関数（app.js）
- `renderSkills(state)`: 現在値と`delta_today`をレイヤーで表示（バー+当日ハイライト）。
- `renderTweets(state)`: 投稿履歴と解析結果カードを一覧表示。
- `renderMatches(state)`: 共通項タグと候補カードを表示。
- `renderDaily(state)`: 今日の経験値サマリと日報ドラフトを表示（任意セクション）。
- `handleTweetSubmit()`: 入力テキストをルールベースでタグ抽出 → `delta_today`更新 → 各描画を再実行。

解析ルール（モック）
- つぶやき文から感情タグ（ポジティブ/ネガティブ/タスク）を判定。
- タスク抽出はパターンマッチで実施（20種類以上を想定）。

visibility仕様
- 許容値: `"private"` または `"public"`。
- 解析結果カード表示: `"private"` → 「プライベート」表記、`"public"` → 「公開」表記。

モード仕様
- 許容値: `"memo"`（メモモード/蓄積のみ/AI応答なし）、`"consult"`（相談モード/AI応答あり）。
- ローカルモックでは `"consult"` 選択時に固定のスタブ応答テキスト `ai_reply` を表示するだけで、外部APIは呼ばない。

スタイル指針
- RPG風の視覚表現を含めた「成長が見える」UIを重視。
- ホームは情報密度高め、焚火広場は温かみのある配色を採用。

プロンプトテンプレ（VSCode拡張向け）
- 「外部CDNなし」「type='module'を使わない」「プレーンCSS/JSのみ」「sectionごとに`data-section`属性を付与」「アクセシビリティを考慮しheading階層を正しく」など制約を冒頭に記載。

動作フロー（ホーム）
1) つぶやき投稿
2) 感情分析・タスク抽出
3) タスクボード更新
4) 日報草案の更新

API設計（バックエンド）
- 認証: `Authorization: Bearer <SHARED_TOKEN>` を必須（ローカルモックは省略可）。
- 共通: `Content-Type: application/json`、レスポンスはJSON。

1) つぶやき
- `GET /tweets`
  - 概要: つぶやき一覧取得（最新順）。
  - 200: `[{"id":"tweet-...","text":"...","emotion":"positive","tasks":["..."],"created_at":1730000000}]`
- `POST /tweets`
  - 概要: つぶやき投稿。感情分析/タスク抽出はサーバ側で実施。
  - body: `{ "text":"...", "visibility":"private" }`
  - 201: `{ "id":"tweet-...","text":"...","emotion":"task","tasks":["..."],"created_at":1730000000 }`

2) 日報
- `POST /reports`
  - 概要: 指定日のつぶやき/タスクから日報草案を生成。
  - body: `{ "date":"YYYY-MM-DD" }`
  - 200: `{ "date":"YYYY-MM-DD","summary":"...","tasks_by_category":[...],"insights":["..."] }`

3) 汎用AI実行（Bedrockゲートウェイ）
- `POST /ai/execute`
  - 概要: フロントが組み立てたBedrockペイロードをそのまま代理実行。
  - body: `{ "model_id":"...", "payload":{...} }`
  - 200: `{ "model_id":"...","response":{...},"request_id":"..." }`

4) タスク（将来拡張）
- `GET /tasks`
  - 概要: タスクボードの一覧取得。
- `PATCH /tasks/{task_id}`
  - 概要: ステータス更新（待機中/実施中/完了）。

5) エール（将来拡張）
- `POST /cheers`
  - 概要: 匿名エール送信（カウント更新）。

インフラ/スタブ方針
- 本番想定: フロントは S3 + CloudFront（静的配信）、API は API Gateway + Lambda、データは DynamoDB、LLMは Bedrock を想定。
- ローカル検証: フロントは `npm run dev` のみで完結。API呼び出しは行わず `API_MODE=stub` 前提のローカルスタブレスポンス、AIも `AI_MODE=stub` で固定応答。
- スタブ実装: `apiClient` を一箇所に置き、`API_MODE=stub|aws` / `AI_MODE=stub|bedrock` で切替。stub時はハードコードレスポンス、AWS時はAPI Gateway/Bedrockを呼ぶ。
- CORS/接続: AWS接続時は `http://localhost:3000` をCORS許可。認証情報をフロントに埋め込まない（将来はCognito等で取得）。
- データ永続: ローカルは localStorage でTweetのみ永続。DynamoDB接続は後続フェーズで同インターフェースに差し替える。

Bedrock汎用Lambda（ゲートウェイ）方針
- 目的: フロントがプロンプトを構成し、LambdaがBedrock呼び出しを代理することで、署名・許可・制限をサーバ側に集約する。
- 使い分け: 相談モードや日報生成など、LLM呼び出しが必要な機能は汎用Lambdaに統一して委譲する想定。
- リクエスト責務（フロント）:
  - `use_case`（例: `consult`, `report`）と入力本文を渡す。
  - 必要に応じて `model_id` を指定するが、許容モデルはサーバ側のallowlistで制限。
- リクエスト責務（Lambda）:
  - 認証トークン検証（フロントに秘匿情報は持たせない）。
  - `model_id`/`max_tokens`/`temperature` などの範囲チェック。
  - Bedrock呼び出し結果を共通フォーマットで返却（`text`, `usage`, `model_id`, `request_id`）。
- 例: `POST /ai/execute`
  - body: `{ "use_case": "report", "input": "...", "model_id": "anthropic.claude-3-5-sonnet-20240620-v1:0" }`
  - response: `{ "text": "...", "model_id": "...", "usage": { "input_tokens": 0, "output_tokens": 0 } }`
- 既存APIとの整合:
  - 日報生成は暫定で専用エンドポイント（`POST /reports`）を持ち、将来的に汎用Lambdaへ統合する。

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
