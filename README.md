# 🌍 World Monitor — 投資情報ダッシュボード

エネルギー地政学・原油価格・芝刈機エンジンビジネス影響分析ダッシュボード。

---

## ✅ セットアップ手順（コピペするだけ）

### Step 1｜GitHubにアップロード

1. https://github.com にログイン
2. 右上の「＋」→「New repository」
3. Repository name: `world-monitor`
4. 「Create repository」をクリック
5. 「uploading an existing file」をクリック
6. このフォルダの中身を**すべてドラッグ＆ドロップ**
   - ⚠️ `.env.local` は**アップロードしない**（APIキーが漏れるため）
7. 「Commit changes」をクリック

---

### Step 2｜Vercelにデプロイ

1. https://vercel.com にアクセス
2. 「Sign up with GitHub」でログイン
3. 「Add New Project」→ `world-monitor` を選択
4. 「Environment Variables」に以下を入力：

```
NEWSDATA_API_KEY    = NewsData.ioのダッシュボードにあるAPIキー
ANTHROPIC_API_KEY   = console.anthropic.com にあるAPIキー
```

5. 「Deploy」をクリック → 数分で公開されます 🎉

---

### Step 3｜APIキーの取得

#### NewsData.io（ニュース・無料）
1. https://newsdata.io にアクセス
2. 「Get API Key」→ メールアドレスで登録
3. ダッシュボードの「API Key」をコピー

#### Anthropic（Claude AI・要約用）
1. https://console.anthropic.com にアクセス
2. 「API Keys」→「Create Key」
3. キーをコピー（最初の$5分は無料）

---

## 💰 月額コスト試算（1人・1日3回更新）

| サービス      | 無料枠      | 月使用量   | 費用    |
|-------------|-----------|----------|--------|
| NewsData.io | 200件/日   | ~90件/日  | **¥0** |
| Claude API  | $5クレジット | ~$0.3/月 | **¥0** |
| Vercel      | 100GB帯域  | 数MB     | **¥0** |
| GitHub      | 無制限      | 少量      | **¥0** |

---

## 🗂 ファイル構成

```
world-monitor/
├── app/
│   ├── layout.js          ← HTMLの土台
│   ├── page.js            ← メインダッシュボード
│   ├── globals.css        ← デザイン
│   └── api/
│       ├── news/route.js  ← ニュース取得・AI要約API
│       └── oil/route.js   ← 原油価格取得API（FREDから）
├── package.json
├── next.config.js
└── .env.local             ← ★ GitHubにはアップしないこと！
```

---

## ⚙️ データ更新の仕組み

- **原油価格**: FREDから4時間ごとに自動更新（APIキー不要）
- **ニュース**: アクセスのたびに取得（12時間キャッシュで節約）
- **AI要約**: Claude Haiku（最安モデル）でコスト最小化

---

## ❓ よくある質問

**Q: 画面を開くたびにAPIが叩かれますか？**  
A: いいえ。12時間キャッシュされるので、何人がアクセスしても1日2回しかAPIを使いません。

**Q: APIキーが漏れませんか？**  
A: `.env.local` はGitHubにアップしない設定（.gitignore）になっています。Vercelの環境変数は暗号化されて安全です。

**Q: スマホからも見られますか？**  
A: はい。Vercelが自動でURLを発行するので、スマホのブラウザでそのURLを開くだけです。
