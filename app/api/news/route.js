// app/api/news/route.js
// ─────────────────────────────────────────────────────────
//  サーバーサイドAPI: ニュース取得 → Groq（Llama3）で要約
//  Groq = 完全無料・クレカ不要
//  登録: https://console.groq.com
// ─────────────────────────────────────────────────────────

const ENERGY_QUERY =
  "Hormuz OR Saudi OR OPEC OR LNG OR shale OR UAE OR ADNOC OR Aramco OR \"crude oil\" OR \"natural gas\"";

const MOWER_QUERY =
  "\"lawn mower\" OR \"small engine\" OR \"Briggs Stratton\" OR \"Kohler engine\" OR \"outdoor power\" OR \"housing starts\" OR \"EPA engine\"";

// ── 12時間キャッシュ（無料枠を節約）──────────────────────
let cache = { energy: null, mower: null, updatedAt: 0 };
const CACHE_TTL = 12 * 60 * 60 * 1000;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "energy";

  // キャッシュが有効ならそのまま返す
  if (Date.now() - cache.updatedAt < CACHE_TTL && cache[type]) {
    return Response.json({ items: cache[type], cached: true });
  }

  const newsApiKey = process.env.NEWSDATA_API_KEY;
  const groqApiKey = process.env.GROQ_API_KEY;

  if (!newsApiKey || !groqApiKey) {
    return Response.json(
      { error: "APIキーが未設定です。VercelのEnvironment Variablesを確認してください。\n必要なキー: NEWSDATA_API_KEY, GROQ_API_KEY" },
      { status: 500 }
    );
  }

  try {
    // ── Step1: NewsData.io からニュース取得 ──────────────
    const query = type === "energy" ? ENERGY_QUERY : MOWER_QUERY;
    const newsUrl = new URL("https://newsdata.io/api/1/news");
    newsUrl.searchParams.set("apikey", newsApiKey);
    newsUrl.searchParams.set("q", query);
    newsUrl.searchParams.set("language", "en");
    newsUrl.searchParams.set("size", "10");

    const newsRes = await fetch(newsUrl.toString());
    const newsData = await newsRes.json();

    if (!newsData.results || newsData.results.length === 0) {
      return Response.json({ items: [], cached: false });
    }

    // タイトルと概要だけ抽出（トークン節約）
    const headlines = newsData.results.slice(0, 8).map((a) => ({
      title: a.title || "",
      description: (a.description || "").slice(0, 200),
      pubDate: a.pubDate || "",
      source: a.source_id || "",
      link: a.link || "",
    }));

    // ── Step2: Groq（Llama3）で要約・スコアリング ────────
    const systemPrompt =
      type === "energy"
        ? `あなたはエネルギー市場の投資アナリストです。
英語ニュースを受け取り、以下のJSON配列のみを返してください。
マークダウン・コードブロック・前置き文は一切不要です。JSONだけ返してください。
各要素の形式:
{
  "headline": "日本語訳タイトル",
  "summary": "2文の日本語要約",
  "region": "地域名（例: 中東, 米国, サウジアラビア）",
  "urgency": "HIGH または MEDIUM または LOW",
  "tag": "HORMUZ または OPEC または LNG または SHALE または SAUDI または UAE または ENERGY のどれか"
}`
        : `あなたは米国芝刈機・小型エンジン業界の投資アナリストです。
英語ニュースを受け取り、以下のJSON配列のみを返してください。
マークダウン・コードブロック・前置き文は一切不要です。JSONだけ返してください。
各要素の形式:
{
  "headline": "日本語訳タイトル",
  "summary": "1〜2文の日本語要約",
  "impact": 影響度の数値（-5から+5の整数、ガスエンジン芝刈機ビジネスへの影響）,
  "reason": "なぜその影響度か、日本語で1文"
}`;

    const userPrompt = `以下のニュースを分析してください:\n\n${JSON.stringify(headlines, null, 2)}`;

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        max_tokens: 1500,
        temperature: 0.3,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt   },
        ],
      }),
    });

    const groqData = await groqRes.json();

    if (!groqRes.ok) {
      throw new Error(`Groq APIエラー: ${groqData.error?.message || "不明なエラー"}`);
    }

    const rawText = groqData.choices?.[0]?.message?.content || "[]";

    // JSONを安全に取り出す
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    let items = [];
    if (jsonMatch) {
      try {
        items = JSON.parse(jsonMatch[0]);
      } catch {
        items = [];
      }
    }

    // 元ニュースのリンク・日付をマージ
    const enriched = items.map((item, i) => ({
      ...item,
      id: i,
      link:      headlines[i]?.link    || "",
      source:    headlines[i]?.source  || "",
      pubDate:   headlines[i]?.pubDate || "",
      fetchedAt: Date.now(),
    }));

    // キャッシュ更新
    cache[type]     = enriched;
    cache.updatedAt = Date.now();

    return Response.json({ items: enriched, cached: false, updatedAt: Date.now() });

  } catch (err) {
    console.error("News API error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
