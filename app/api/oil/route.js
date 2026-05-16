// app/api/oil/route.js
// ─────────────────────────────────────────────────────────
//  サーバーサイドAPI: FRED（米連邦準備銀行）から原油価格取得
//  APIキー不要・公開データ
//  取得系列:
//    DCOILWTICO  = WTI原油価格（日次）
//    DCOILBRENTEU = ブレント原油価格（日次）
//    DHHNGSP     = 天然ガス価格 Henry Hub（日次）
// ─────────────────────────────────────────────────────────

const FRED_SERIES = {
  wti:   "DCOILWTICO",
  brent: "DCOILBRENTEU",
  ng:    "DHHNGSP",
};

// Vercelのキャッシュヘッダーで4時間キャッシュ
export const revalidate = 14400; // 4時間（秒）

async function fetchFredSeries(seriesId) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}`;
  const res = await fetch(url, { next: { revalidate: 14400 } });
  const text = await res.text();

  const lines = text
    .trim()
    .split("\n")
    .slice(1) // ヘッダー行をスキップ
    .filter((l) => l && !l.includes("DATE")); // 空行除去

  // 末尾から有効な数値を探す（"."はデータ未確定を意味するFREDの表記）
  const valid = [];
  for (let i = lines.length - 1; i >= 0 && valid.length < 3; i--) {
    const [date, val] = lines[i].split(",");
    const num = parseFloat(val);
    if (!isNaN(num)) {
      valid.push({ date: date?.trim(), value: num });
    }
  }
  return valid; // [最新, 1つ前, 2つ前]
}

export async function GET() {
  try {
    const [wtiData, brentData, ngData] = await Promise.all([
      fetchFredSeries(FRED_SERIES.wti),
      fetchFredSeries(FRED_SERIES.brent),
      fetchFredSeries(FRED_SERIES.ng),
    ]);

    const result = {
      wti:       wtiData[0]?.value   ?? null,
      wtiPrev:   wtiData[1]?.value   ?? null,
      wtiDate:   wtiData[0]?.date    ?? null,
      brent:     brentData[0]?.value ?? null,
      brentPrev: brentData[1]?.value ?? null,
      brentDate: brentData[0]?.date  ?? null,
      ng:        ngData[0]?.value    ?? null,
      ngPrev:    ngData[1]?.value    ?? null,
      ngDate:    ngData[0]?.date     ?? null,
      source:    "FRED / EIA (US Energy Information Administration)",
      fetchedAt: new Date().toISOString(),
    };

    return Response.json(result);
  } catch (err) {
    console.error("FRED fetch error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
