// app/api/news/route.js

const ENERGY_QUERY = "Hormuz OR Saudi OR OPEC OR LNG OR shale OR UAE OR crude oil OR natural gas";
const MOWER_QUERY = "lawn mower OR small engine OR Briggs Stratton OR housing starts OR EPA engine";

let cache = { energy: null, mower: null, updatedAt: 0 };
const CACHE_TTL = 12 * 60 * 60 * 1000;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "energy";

  if (Date.now() - cache.updatedAt < CACHE_TTL && cache[type]) {
    return Response.json({ items: cache[type], cached: true });
  }

  const newsApiKey = process.env.NEWSDATA_API_KEY;
  const groqApiKey = process.env.GROQ_API_KEY;

  if (!newsApiKey || !groqApiKey) {
    return Response.json(
      { error: "APIキーが未設定です。NEWSDATA_API_KEY と GROQ_API_KEY を確認してください。" },
      { status: 500 }
    );
  }

  try {
    // ── Step1: NewsData.io からニュース取得 ──────────────
    const query = type === "energy" ? ENERGY_QUERY : MOWER_QUERY;
    const newsUrl = new URL("https://newsdata.io/api/1/latest");
    newsUrl.searchParams.set("apikey", newsApiKey);
    newsUrl.searchParams.set("q", query);
    newsUrl.searchParams.set("language", "en");

    const newsRes = await fetch(newsUrl.toString());

    // HTTPエラーチェック
    if (!newsRes.ok) {
      throw new Error(`NewsData.io HTTP error: ${newsRes.status}`);
    }

    const newsData = await newsRes.json();

    // レスポンス内容をログ（Vercelのログで確認できる）
    console.log("NewsData response status:", newsData.status);
    console.log("NewsData results type:", typeof newsData.results);
    console.log("NewsData results isArray:", Array.isArray(newsData.results));

    // statusがsuccessでない場合
    if (newsData.status !== "success") {
      throw new Error(`NewsData.io error: ${newsData.message || newsData.status}`);
    }

    // resultsが配列でない・空の場合
    if (!Array.isArray(newsData.results) || newsData.results.length === 0) {
      return Response.json({ items: [], cached: false, debug: "no results" });
    }

    // タイトルと概要だけ抽出
    const headlines = newsData.results.slice(0, 8).map((a) => ({
      title:       (a.title       || "").slice(0, 200),
      description: (a.description || "").slice(0, 200),
      pubDate:     a.pubDate    || "",
      source:      a.source_id  || "",
      link:        a.link       || "",
    }));

    // ── Step2: Groq で要約・スコアリング ─────────────────
    const systemPrompt = type === "energy"
      ? `You are an energy market investment analyst.
Return ONLY a JSON array. No markdown, no explanation, no code blocks.
Each element: { "headline": "Japanese title", "summary": "2-sentence Japanese summary", "region": "region in Japanese", "urgency": "HIGH or MEDIUM or LOW", "tag": "HORMUZ or OPEC or LNG or SHALE or SAUDI or UAE or ENERGY" }`
      : `You are a US lawn mower and small engine industry analyst.
Return ONLY a JSON array. No markdown, no explanation, no code blocks.
Each element: { "headline": "Japanese title", "summary": "1-2 sentence Japanese summary", "impact": <integer -5 to 5>, "reason": "one sentence in Japanese" }`;

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        max_tokens: 1500,
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: `Analyze these articles:\n${JSON.stringify(headlines, null, 2)}` },
        ],
      }),
    });

    const groqData = await groqRes.json();

    if (!groqRes.ok) {
      throw new Error(`Groq error: ${groqData.error?.message || "unknown"}`);
    }

    const rawText = groqData.choices?.[0]?.message?.content || "[]";
    const cleaned = rawText.replace(/```json|```/g, "").trim();
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);

    let items = [];
    if (jsonMatch) {
      try { items = JSON.parse(jsonMatch[0]); } catch { items = []; }
    }
    if (!Array.isArray(items)) items = [];

    const enriched = items.map((item, i) => ({
      ...item,
      id:        i,
      link:      headlines[i]?.link    || "",
      source:    headlines[i]?.source  || "",
      pubDate:   headlines[i]?.pubDate || "",
      fetchedAt: Date.now(),
    }));

    cache[type]     = enriched;
    cache.updatedAt = Date.now();

    return Response.json({ items: enriched, cached: false, updatedAt: Date.now() });

  } catch (err) {
    console.error("News API error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
