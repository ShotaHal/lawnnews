'use client'
// app/page.js
// ─────────────────────────────────────────────────────────
//  World Monitor — メインダッシュボード
//  クライアントサイドコンポーネント
//  データはすべて /api/news と /api/oil から取得
// ─────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'

// ── ユーティリティ ────────────────────────────────────────
function fmt(val, digits = 2) {
  if (val === null || val === undefined || isNaN(val)) return '—'
  return `$${Number(val).toFixed(digits)}`
}

function delta(cur, prev) {
  if (!cur || !prev) return null
  return cur - prev
}

function deltaStr(d, digits = 2) {
  if (d === null) return '—'
  return (d > 0 ? '+' : '') + d.toFixed(digits)
}

function deltaClass(d) {
  if (d === null) return 'neu'
  return d > 0 ? 'up' : d < 0 ? 'down' : 'neu'
}

function timeAgo(isoStr) {
  if (!isoStr) return ''
  const diff = Date.now() - new Date(isoStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return '今'
  if (m < 60) return `${m}分前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}時間前`
  return `${Math.floor(h / 24)}日前`
}

function newsTag(text = '') {
  const t = text.toLowerCase()
  if (/(hormuz|strait|tanker|naval|iran)/i.test(t)) return { lbl: 'HORMUZ', cls: 't-hormuz' }
  if (/(opec|production cut|quota)/i.test(t))       return { lbl: 'OPEC',   cls: 't-opec'   }
  if (/(lng|liquefied|terminal)/i.test(t))           return { lbl: 'LNG',    cls: 't-lng'    }
  if (/(shale|permian|frack|eagle ford)/i.test(t))  return { lbl: 'SHALE',  cls: 't-shale'  }
  if (/(saudi|aramco|riyadh)/i.test(t))             return { lbl: 'SAUDI',  cls: 't-saudi'  }
  if (/(uae|abu dhabi|adnoc|dubai)/i.test(t))       return { lbl: 'UAE',    cls: 't-uae'    }
  if (/(lawn|mower|engine|briggs|kohler|husqvarna)/i.test(t)) return { lbl: 'MOWER', cls: 't-mower' }
  if (/(crude|brent|wti|oil|barrel)/i.test(t))      return { lbl: 'ENERGY', cls: 't-energy' }
  return { lbl: 'NEWS', cls: 't-gen' }
}

function urgencyBar(urgency) {
  if (urgency === 'HIGH')   return { w: 100, color: 'var(--neg)' }
  if (urgency === 'MEDIUM') return { w: 65,  color: 'var(--accent3)' }
  return                           { w: 30,  color: 'var(--accent)' }
}

function impactVerdict(score) {
  if (score >  2) return { text: '強いプラス影響 / STRONG POSITIVE', color: 'var(--pos)' }
  if (score >  0.5) return { text: 'マイルドプラス / MILD POSITIVE', color: 'var(--pos)' }
  if (score < -2) return { text: '強いマイナス影響 / STRONG NEGATIVE', color: 'var(--neg)' }
  if (score < -0.5) return { text: 'マイルドマイナス / MILD NEGATIVE', color: 'var(--neg)' }
  return { text: 'ニュートラル / NEUTRAL', color: 'var(--accent3)' }
}

// ── ローディングスピナー ──────────────────────────────────
function Spinner({ label = 'Loading...' }) {
  return (
    <div className="loading">
      <div className="spinner" />
      <div className="loading-txt">{label}</div>
    </div>
  )
}

// ── 原油価格カード ────────────────────────────────────────
function OilCard({ label, value, prevValue, date, unit = '$/bbl', digits = 2 }) {
  const d = delta(value, prevValue)
  return (
    <div className="oil-card">
      <div className="oil-lbl mono">{label}</div>
      <div className="oil-val">{fmt(value, digits)}</div>
      <div className={`oil-chg mono ${deltaClass(d)}`}>
        {d !== null && (d > 0 ? '▲ ' : '▼ ')}{deltaStr(d, digits)}
        <span className="neu" style={{ marginLeft: 4 }}>vs prev</span>
      </div>
      <div className="oil-date mono">{date} · {unit}</div>
    </div>
  )
}

// ── エネルギーシグナルリスト ──────────────────────────────
function EnergyPanel({ items, loading }) {
  return (
    <div className="panel">
      <div className="panel-hdr">
        <div className="panel-title">
          <span style={{ color: 'var(--energy)' }}>⚡</span>
          エネルギー地政学シグナル
        </div>
        <span className="panel-count mono">{items.length} signals</span>
      </div>

      {loading
        ? <Spinner label="Scanning energy feeds..." />
        : (
          <div className="scroll-area">
            {items.length === 0
              ? <div className="err-box">シグナルなし / No signals</div>
              : items.map((item, i) => {
                  const bar = urgencyBar(item.urgency)
                  const urgLabel =
                    item.urgency === 'HIGH'   ? '🔴 緊急 HIGH' :
                    item.urgency === 'MEDIUM' ? '🟡 注意 MED'  : '🟢 情報 LOW'
                  return (
                    <div key={i} className="energy-item">
                      <div className="e-urgency mono">
                        {urgLabel}{item.region ? ` · ${item.region}` : ''}
                      </div>
                      <div className="e-headline">{item.headline}</div>
                      {item.summary && <div className="e-summary">{item.summary}</div>}
                      <div className="signal-row">
                        <span className="signal-lbl mono">影響度</span>
                        <div className="signal-bar">
                          <div className="signal-fill" style={{ width: `${bar.w}%`, background: bar.color }} />
                        </div>
                      </div>
                      <div className="e-meta mono">{timeAgo(item.pubDate)}{item.source && ` · ${item.source}`}</div>
                    </div>
                  )
                })}
          </div>
        )}
    </div>
  )
}

// ── 統合ニュースフィード ──────────────────────────────────
function NewsFeed({ energyItems, mowerItems, loading }) {
  const combined = [
    ...energyItems.map(n => ({ ...n, _type: 'energy' })),
    ...mowerItems.map(n => ({ ...n, _type: 'mower' })),
  ].sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))

  return (
    <div className="panel">
      <div className="panel-hdr">
        <div className="panel-title">
          <span style={{ color: 'var(--accent)' }}>◈</span>
          World Intelligence Feed
          <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>/ 世界情勢</span>
        </div>
      </div>

      {loading
        ? <Spinner label="AI analyzing feeds..." />
        : (
          <div className="scroll-area">
            {combined.length === 0
              ? <div className="err-box">ニュースなし / No news fetched</div>
              : combined.map((item, i) => {
                  const tag = newsTag(item.headline + ' ' + (item.summary || ''))
                  return (
                    <div key={i} className="news-item">
                      <div className="news-meta">
                        <span className={`news-tag ${tag.cls}`}>{tag.lbl}</span>
                        {item._type === 'mower' &&
                          <span className="news-tag t-mower">🌿 MOWER</span>}
                        {item.urgency === 'HIGH' &&
                          <span style={{ fontSize: 9, color: 'var(--neg)', fontFamily: "'Space Mono',monospace" }}>⚠ URGENT</span>}
                        <span className="news-time mono">{timeAgo(item.pubDate)}</span>
                      </div>
                      <div className="news-hl">{item.headline}</div>
                      {item.summary && <div className="news-sum">{item.summary}</div>}
                      {item.reason  && <div className="news-reason">📌 {item.reason}</div>}
                      {item.link    &&
                        <a className="news-link" href={item.link} target="_blank" rel="noopener noreferrer">
                          → 元記事を開く
                        </a>}
                    </div>
                  )
                })}
          </div>
        )}
    </div>
  )
}

// ── 芝刈機ビジネス影響パネル ──────────────────────────────
function MowerPanel({ items, loading }) {
  const avg = items.length > 0
    ? items.reduce((s, n) => s + (n.impact || 0), 0) / items.length
    : 0

  const gaugePos = ((avg + 5) / 10) * 100
  const { text: verdictText, color: verdictColor } = impactVerdict(avg)
  const scoreColor = avg > 0.5 ? 'var(--pos)' : avg < -0.5 ? 'var(--neg)' : 'var(--accent3)'

  const INDICATORS = [
    { lbl: '住宅着工件数', sub: 'US Housing Starts', val: '~1.36M', trend: '↑ YoY',   color: 'var(--pos)' },
    { lbl: '消費者信頼感', sub: 'Consumer Conf.',    val: '98.3',  trend: '↓ MoM',   color: 'var(--neg)' },
    { lbl: '芝刈機市場規模', sub: 'US Mower Market', val: '$7.5B', trend: 'CAGR 5.4%', color: 'var(--accent3)' },
    { lbl: 'ガス系シェア',  sub: 'Gas Engine Share', val: '39.3%', trend: '↓ EV移行', color: 'var(--accent2)' },
  ]

  return (
    <div className="panel">
      <div className="panel-hdr">
        <div className="panel-title">
          <span style={{ color: 'var(--accent3)' }}>🌿</span>
          芝刈機エンジン<br />ビジネス影響分析
        </div>
      </div>

      {/* スコアゲージ */}
      <div className="gauge-wrap">
        <div className="gauge-title mono">AGGREGATE IMPACT SCORE / 総合影響スコア</div>
        <div className="gauge-score" style={{ color: scoreColor }}>
          {avg > 0 ? '+' : ''}{avg.toFixed(1)}
        </div>
        <div className="gauge-verdict" style={{ color: verdictColor }}>{verdictText}</div>
        <div className="gauge-bar">
          <div className="gauge-needle" style={{ left: `${gaugePos}%` }} />
        </div>
        <div className="gauge-lbls mono">
          <span style={{ color: 'var(--neg)' }}>-5 極悪</span>
          <span style={{ color: 'var(--muted)' }}>0</span>
          <span style={{ color: 'var(--pos)' }}>+5 最高</span>
        </div>
      </div>

      {/* 市場指標 */}
      <div className="panel-title" style={{ marginBottom: 10 }}>
        <span style={{ color: 'var(--accent3)' }}>◈</span>
        &nbsp;米国市場指標
      </div>
      <div className="ind-grid">
        {INDICATORS.map((ind, i) => (
          <div key={i} className="ind-card">
            <div className="ind-lbl mono">{ind.lbl}</div>
            <div className="ind-sub">{ind.sub}</div>
            <div className="ind-val" style={{ color: ind.color }}>{ind.val}</div>
            <div className="ind-trend">{ind.trend}</div>
          </div>
        ))}
      </div>

      {/* ニュース影響リスト */}
      <div className="panel-title" style={{ marginBottom: 10 }}>
        <span style={{ color: 'var(--accent3)' }}>◈</span>
        &nbsp;関連ニュース・影響度
      </div>

      {loading
        ? <Spinner label="Analyzing mower market..." />
        : (
          <div className="scroll-area">
            {items.length === 0
              ? <div className="err-box">データ取得中...</div>
              : items.map((item, i) => {
                  const s = item.impact || 0
                  const bars = Math.round(Math.min(Math.abs(s), 5))
                  const badgeCls = s > 0.5 ? 'b-pos' : s < -0.5 ? 'b-neg' : 'b-neu'
                  return (
                    <div key={i} className="mower-item">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                        <span className={`impact-badge mono ${badgeCls}`}>
                          {s > 0 ? '▲ +' : s < 0 ? '▼ ' : '── '}{Math.abs(s).toFixed(1)}
                          {'█'.repeat(bars)}{'░'.repeat(5 - bars)}
                        </span>
                        <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: 'var(--muted)' }}>
                          {s > 1.5 ? 'MAJOR POS' : s > 0.5 ? 'MILD POS' : s < -1.5 ? 'MAJOR NEG' : s < -0.5 ? 'MILD NEG' : 'NEUTRAL'}
                        </span>
                      </div>
                      <div className="mower-hl">{item.headline}</div>
                      {item.reason && <div className="mower-rsn">📌 {item.reason}</div>}
                    </div>
                  )
                })}
          </div>
        )}
    </div>
  )
}

// ── メインページ ──────────────────────────────────────────
export default function Page() {
  const [oil, setOil]           = useState({})
  const [energyNews, setEnergy] = useState([])
  const [mowerNews, setMower]   = useState([])
  const [loading, setLoading]   = useState({ oil: true, energy: true, mower: true })
  const [lastUpdate, setLast]   = useState(null)
  const [error, setError]       = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading({ oil: true, energy: true, mower: true })
    setError(null)

    // 原油価格（FRED）
    try {
      const res = await fetch('/api/oil')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setOil(data)
    } catch (e) {
      setError(`原油価格取得エラー: ${e.message}`)
    }
    setLoading(p => ({ ...p, oil: false }))

    // エネルギーニュース
    try {
      const res = await fetch('/api/news?type=energy')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setEnergy(data.items || [])
    } catch (e) {
      setError(`ニュース取得エラー: ${e.message}`)
    }
    setLoading(p => ({ ...p, energy: false }))

    // 芝刈機ニュース
    try {
      const res = await fetch('/api/news?type=mower')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setMower(data.items || [])
    } catch (e) {
      setError(`芝刈機ニュース取得エラー: ${e.message}`)
    }
    setLoading(p => ({ ...p, mower: false }))

    setLast(new Date())
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const isAnyLoading = Object.values(loading).some(Boolean)

  // ティッカー用テキスト
  const tickerItems = energyNews.length > 0
    ? energyNews.map(n => n.headline)
    : ['エネルギー情報を取得中... / Fetching energy intelligence...']
  const ticker = [...tickerItems, ...tickerItems] // 無限ループ用に2倍

  // Brent/WTI スプレッド
  const spread = (oil.brent && oil.wti) ? oil.brent - oil.wti : null

  return (
    <>
      {/* ── ヘッダー ── */}
      <header className="header">
        <div className="logo">
          <div className="logo-icon mono">WM</div>
          <div>
            <div className="logo-text mono">WORLD MONITOR</div>
            <div className="logo-sub mono">INVESTMENT INTELLIGENCE DASHBOARD</div>
          </div>
        </div>
        <div className="header-right">
          <div className="live-badge mono">
            <span className="live-dot" />
            LIVE
          </div>
          {lastUpdate && (
            <span className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>
              更新: {lastUpdate.toLocaleTimeString('ja-JP')}
            </span>
          )}
          <button className="refresh-btn" onClick={fetchAll} disabled={isAnyLoading}>
            ↻ REFRESH
          </button>
        </div>
      </header>

      {/* ── エラー表示 ── */}
      {error && (
        <div className="err-box" style={{ margin: '8px 24px' }}>
          ⚠ {error}
        </div>
      )}

      {/* ── ティッカー ── */}
      <div className="ticker-wrap">
        <div className="ticker-label">⚡ ENERGY ALERT</div>
        <div className="ticker-body">
          <div className="ticker-track">
            {ticker.map((t, i) => (
              <span key={i} className="ticker-item">
                <span className="ticker-dot">◆</span>
                <span className="ticker-tag">OIL/GAS</span>
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── 原油価格バー ── */}
      <div className="oil-grid">
        <OilCard label="WTI CRUDE"             value={oil.wti}   prevValue={oil.wtiPrev}   date={oil.wtiDate}   />
        <OilCard label="BRENT CRUDE"           value={oil.brent} prevValue={oil.brentPrev} date={oil.brentDate} />
        <OilCard label="NATURAL GAS (Henry Hub)" value={oil.ng}  prevValue={oil.ngPrev}    date={oil.ngDate} unit="$/MMBtu" digits={3} />
        <div className="oil-card">
          <div className="oil-lbl mono">BRENT / WTI SPREAD</div>
          <div className="oil-val" style={{ color: spread > 0 ? 'var(--accent3)' : 'var(--accent)' }}>
            {spread !== null ? `$${spread.toFixed(2)}` : '—'}
          </div>
          <div className="oil-chg mono neu">スプレッド (Brent優位)</div>
          <div className="oil-date mono">Source: FRED / EIA</div>
        </div>
      </div>

      {/* ── メインコンテンツ ── */}
      <div className="main-grid">
        <EnergyPanel items={energyNews} loading={loading.energy} />
        <NewsFeed energyItems={energyNews} mowerItems={mowerNews} loading={loading.energy || loading.mower} />
        <MowerPanel items={mowerNews}   loading={loading.mower} />
      </div>

      {/* ── フッター ── */}
      <footer className="footer">
        <span>Data: FRED/EIA (oil) · NewsData.io (news) · Claude AI (analysis) · Inspired by koala73/worldmonitor</span>
        <span>⚠ 免責: 本データは投資助言ではありません / Not financial advice</span>
      </footer>
    </>
  )
}
