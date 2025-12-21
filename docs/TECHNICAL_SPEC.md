# つぶナビ 技術仕様書

## 1. プロダクト概要

### 1.1 プロダクト名
**つぶナビ（TsubuNavi）**

### 1.2 コンセプト
日々の「つぶやき」から自動でタスクを抽出し、感情を分析して日報を生成する「優しいキャリア支援プラットフォーム」

### 1.3 コアバリュー
- **自動化**: つぶやくだけでタスク管理・日報作成が完了
- **可視化**: RPG風UIでスキルの成長を直感的に表示
- **つながり**: 匿名エールで孤独を感じさせない温かいコミュニティ

---

## 2. アーキテクチャ方針

### 2.1 技術スタック選定

#### フロントエンド
**選定: HTML5 + CSS3 + Vanilla JavaScript**

**選定理由:**
- **MVPの迅速な検証**: フレームワーク不要で即座にプロトタイプ構築
- **学習コスト最小化**: 全エンジニアが理解可能な標準技術
- **Canvas API活用**: ゲーム的UIに最適（あしあとと里の実装）
- **依存関係ゼロ**: ビルドツール不要、ブラウザで即実行

**将来の移行候補:**
- React + TypeScript（スケール時）
- Next.js（SSR/SEO対応時）

#### バックエンド（本番想定）
**選定: Python + FastAPI**

**選定理由:**
- **AI/ML統合**: スキル分析にLLM（Amazon Bedrock）を活用
- **高速開発**: FastAPIの自動ドキュメント生成、型安全性
- **AWS統合**: boto3でAWSサービスとシームレス連携
- **非同期処理**: 大量の業務ログ分析に対応

#### データベース
**選定: Amazon DynamoDB**

**選定理由:**
- **スケーラビリティ**: 社員数増加に自動対応
- **低レイテンシ**: リアルタイムスキル更新に最適
- **サーバーレス**: 運用コスト最小化
- **柔軟なスキーマ**: スキル定義の変更に強い

#### AI/分析
**選定: Amazon Bedrock (Claude 3.5 Sonnet)**

**選定理由:**
- **高精度な文脈理解**: 業務ログからスキル抽出
- **日本語対応**: 社内コミュニケーション分析
- **マネージドサービス**: インフラ管理不要
- **コスト効率**: 従量課金、初期投資不要

---

## 3. システム構成

### 3.1 MVP（現在のモック）
```
[ブラウザ]
  ├─ home_tsubunavi.html      # ホーム画面（つぶやき・タスク・日報）
  ├─ forest_tsubunavi.html    # あしあとと里（スキル可視化）
  └─ bonfire_premium.html     # 夜の焚火広場（エール機能）
```

### 3.2 本番環境（想定）
```
[フロントエンド]
  └─ S3 + CloudFront (静的ホスティング)

[API層]
  └─ API Gateway + Lambda (FastAPI)

[データ層]
  ├─ DynamoDB (ユーザー/スキルデータ)
  └─ S3 (業務ログ保存)

[AI/分析層]
  ├─ Amazon Bedrock (スキル分析)
  └─ Lambda (バッチ処理)

[連携]
  ├─ Slack API (業務ログ取得)
  ├─ GitHub API (コミット分析)
  └─ Jira API (タスク分析)
```

---

## 4. 主要機能の技術詳細

### 4.1 ホーム画面（home_tsubunavi.html）

**技術要素:**
- **SVG + CSS Animation**: スキルレーダーチャート
- **Drag & Drop API**: タスクボードのカンバン機能
- **localStorage**: エール通知の一時保存
- **正規表現**: つぶやきからのタスク抽出・感情分析

**主要機能:**
1. **つぶやき投稿**
   - 自由形式のテキスト入力
   - リアルタイムで感情分析（ポジティブ/ネガティブ/タスク）
   
2. **AIタスク整形**
   - 20種類以上のパターンマッチング
   - 例: 「API設計書を作成する予定」→「API設計書の作成」
   
3. **タスクボード**
   - 3カラム構成（待機中/実施中/完了）
   - ドラッグ&ドロップでステータス変更
   - 完了時にレベルアップアニメーション
   
4. **日報自動生成**
   - つぶやき履歴から自動要約
   - タスクをカテゴリ別に分類
   - 感情を考慮した気づきを生成
   
5. **エール通知**
   - 焚火広場からの匿名エールを表示
   - 「◯名からエールが届いています」
   - 5秒後に自動消去

**データフロー（本番想定）:**
```
1. つぶやき投稿
2. API: POST /api/tweets (感情分析・タスク抽出)
3. Bedrock: 自然言語処理でタスク整形
4. DynamoDB: つぶやき・タスク保存
5. フロントエンド: タスクボード更新
```

### 4.2 あしあとと里（forest_tsubunavi.html）

**技術要素:**
- **Canvas API**: 2Dゲーム描画
- **requestAnimationFrame**: 60FPS アニメーション
- **イベントリスナー**: クリック操作

**主要機能:**
1. **スキル可視化**
   - 里ごとにスキルをグループ化
   - 開拓済み/未開拓の視覚的区別
   
2. **未開拓の里の演出**
   - 虹色の光の輪（6方向回転）
   - キラキラ星（8つ回転＆点滅）
   - バウンスする疑問符
   - 回転する点線枠
   - 必要レベル表示
   
3. **足跡システム**
   - 成長の軌跡を視覚化
   - クリックで詳細表示

**データフロー（本番想定）:**
```
1. Canvas初期化
2. API: GET /api/users/{userId}/footprints
3. API: GET /api/villages
4. Canvas: リアルタイム描画ループ
```

### 4.3 夜の焚火広場（bonfire_premium.html）

**技術要素:**
- **CSS Animation**: 焚火の揺らぎ
- **localStorage**: 匿名エールの保存
- **温かみのあるデザイン**: オレンジ系グラデーション

**主要機能:**
1. **ピックアップ先人**
   - スキル類似度でマッチング
   - 先輩のキャリアパスを表示
   
2. **さまよえる子羊**
   - タスク滞留者を匿名表示
   - 3種類のエールボタン（💪がんばれ、🔥負けるな、🌟応援してる）
   - 完全匿名（人数のみカウント）
   
3. **エール送信**
   - localStorageにカウント保存
   - ホーム画面で通知表示

**データフロー（本番想定）:**
```
1. エールボタンクリック
2. API: POST /api/support (匿名カウント)
3. DynamoDB: エール数更新
4. WebSocket: リアルタイム通知
```

---

## 5. データモデル

### 5.1 ユーザーテーブル（DynamoDB）
```json
{
  "userId": "user_12345",
  "name": "田中 健太",
  "role": "エンジニア",
  "joinYear": 2023,
  "skills": {
    "コミュニケーション": {"level": 6, "exp": 450},
    "課題解決": {"level": 5, "exp": 320},
    "システム設計": {"level": 4, "exp": 180}
  },
  "totalLevel": 25
}
```

### 5.2 つぶやきテーブル（DynamoDB）
```json
{
  "tweetId": "tweet_12345",
  "userId": "user_12345",
  "text": "今日は新しいAPI設計書を作成する予定です。楽しみ！",
  "timestamp": "2025-01-20T09:00:00Z",
  "isTask": true,
  "isPositive": true,
  "isNegative": false,
  "extractedTask": "API設計書の作成"
}
```

### 5.3 タスクテーブル（DynamoDB）
```json
{
  "taskId": "task_67890",
  "userId": "user_12345",
  "title": "API設計書の作成",
  "status": "done",
  "skill": "システム設計",
  "createdAt": "2025-01-20T09:00:00Z",
  "completedAt": "2025-01-20T15:30:00Z"
}
```

### 5.4 エールテーブル（DynamoDB）
```json
{
  "supportId": "support_11111",
  "recipientId": "user_12345",
  "count": 3,
  "timestamp": "2025-01-20T16:00:00Z",
  "isRead": false
}
```

---

## 6. API設計

### 6.1 エンドポイント一覧

```
POST   /api/tweets                         # つぶやき投稿
GET    /api/tweets/{userId}                # つぶやき履歴取得
POST   /api/tasks                          # タスク作成
PUT    /api/tasks/{taskId}/status          # タスクステータス更新
GET    /api/tasks/{userId}                 # タスク一覧取得
POST   /api/reports/generate               # 日報生成
GET    /api/users/{userId}/dashboard       # ダッシュボードデータ
GET    /api/villages                       # 里一覧
POST   /api/support                        # 匿名エール送信
GET    /api/support/{userId}               # エール受信数取得
```

### 6.2 API例（FastAPI）

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class Tweet(BaseModel):
    userId: str
    text: str

@app.post("/api/tweets")
async def post_tweet(tweet: Tweet):
    # Bedrockでタスク抽出・感情分析
    analysis = analyze_tweet_with_bedrock(tweet.text)
    
    # タスクがあれば自動登録
    if analysis['isTask']:
        task = create_task(
            userId=tweet.userId,
            title=analysis['extractedTask'],
            skill=analysis['skill']
        )
    
    # DynamoDBに保存
    save_tweet(tweet, analysis)
    
    return {
        "status": "success",
        "analysis": analysis,
        "task": task if analysis['isTask'] else None
    }
```

---

## 7. セキュリティ・プライバシー

### 7.1 認証・認可
- **AWS Cognito**: ユーザー認証
- **IAM Role**: API権限管理

### 7.2 データ保護
- **匿名化**: 「さまよえる子羊」は個人特定不可
- **暗号化**: DynamoDB暗号化（at-rest）
- **アクセス制御**: 自分のデータのみ閲覧可能

---

## 8. スケーラビリティ

### 8.1 想定負荷
- **ユーザー数**: 1,000名（初期）→ 10,000名（3年後）
- **API呼び出し**: 10,000 req/day → 100,000 req/day
- **データ量**: 1GB → 100GB

### 8.2 スケール戦略
- **Lambda Auto Scaling**: トラフィック増加に自動対応
- **DynamoDB On-Demand**: 容量自動調整
- **CloudFront CDN**: 静的コンテンツ配信高速化

---

## 9. コスト試算（月額）

### 9.1 初期（1,000ユーザー）
- Lambda: $50
- DynamoDB: $30
- Bedrock: $100
- S3/CloudFront: $20
- **合計: 約$200/月**

### 9.2 スケール後（10,000ユーザー）
- Lambda: $300
- DynamoDB: $200
- Bedrock: $800
- S3/CloudFront: $100
- **合計: 約$1,400/月**

---

## 10. 開発ロードマップ

### Phase 1: MVP検証（現在）
- ✅ モックUI作成
- ✅ コンセプト検証

### Phase 2: α版（3ヶ月）
- バックエンドAPI構築
- Slack連携実装
- 10名でクローズドβ

### Phase 3: β版（6ヶ月）
- AI分析精度向上
- GitHub/Jira連携
- 100名で社内展開

### Phase 4: 本番（12ヶ月）
- 全社展開
- モバイルアプリ対応
- 他社への展開検討

---

## 11. 技術的課題と対策

### 11.1 スキル分析精度
**課題**: 業務ログからの正確なスキル抽出  
**対策**: 
- Few-shot学習でプロンプト最適化
- 人間のフィードバックループ導入

### 11.2 リアルタイム性
**課題**: スキル更新の即時反映  
**対策**:
- DynamoDB Streams + Lambda
- WebSocket（API Gateway）でプッシュ通知

### 11.3 プライバシー保護
**課題**: エール機能での個人特定リスク  
**対策**: 
- 完全匿名化（人数のみ表示）
- 送信者情報は一切保存しない
- 受信者も匿名（「さまよえる子羊」）

---

## 12. まとめ

つぶナビは、**つぶやくだけ**で**タスク管理・日報作成・スキル成長**が完結する、優しいキャリア支援プラットフォームです。

**技術選定の3原則:**
1. **MVPファースト**: 複雑さを避け、検証を最優先
2. **AWSネイティブ**: マネージドサービスで運用負荷最小化
3. **AI活用**: 自然言語処理で手動入力を最小化

**差別化ポイント:**
- つぶやきベースの自然なインターフェース
- AIによるタスク自動整形
- 匿名エールで孤独を感じさせない
- RPG風UIで楽しく継続

**次のアクション:**
- [ ] FastAPIでAPI実装開始
- [ ] Bedrock統合（タスク抽出・感情分析）
- [ ] DynamoDBテーブル設計
- [ ] WebSocket実装（リアルタイム通知）
