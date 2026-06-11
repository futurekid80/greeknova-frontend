"use client";
import { useState, useEffect } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell, Legend
} from "recharts";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://greeknova-backend-production.up.railway.app";

function fmt(n) {
  if (n === null || n === undefined) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "+";
  if (abs >= 100000) return `${sign}${(abs / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}K`;
  return `${sign}${abs}`;
}

function fmtDate(d) {
  const dt = new Date(d);
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

const COLORS = {
  fii: "#f59e0b",       // amber — FII
  client: "#60a5fa",    // blue — Client
  dii: "#34d399",       // green — DII
  pro: "#a78bfa",       // purple — PRO
  bullish: "#22c55e",
  bearish: "#ef4444",
  neutral: "#6b7280",
  bg: "#0f1117",
  card: "#1a1d27",
  border: "#2a2d3a",
  muted: "#6b7280",
  text: "#e2e8f0",
};

const BiasChip = ({ bias }) => {
  const color = bias === "BULLISH" ? COLORS.bullish : bias === "BEARISH" ? COLORS.bearish : COLORS.neutral;
  return (
    <span style={{
      background: `${color}22`, color, border: `1px solid ${color}55`,
      borderRadius: 4, padding: "1px 8px", fontSize: 11, fontWeight: 700, letterSpacing: 1
    }}>
      {bias}
    </span>
  );
};

const StatCard = ({ label, value, sub, color }) => (
  <div style={{
    background: COLORS.card, border: `1px solid ${COLORS.border}`,
    borderRadius: 10, padding: "16px 20px", flex: 1, minWidth: 150
  }}>
    <div style={{ color: COLORS.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{label}</div>
    <div style={{ color: color || COLORS.text, fontSize: 22, fontWeight: 700, fontFamily: "monospace" }}>{value}</div>
    {sub && <div style={{ color: COLORS.muted, fontSize: 11, marginTop: 4 }}>{sub}</div>}
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#1e2130", border: `1px solid ${COLORS.border}`,
      borderRadius: 8, padding: "10px 14px", fontSize: 12
    }}>
      <div style={{ color: COLORS.muted, marginBottom: 6, fontWeight: 600 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <span style={{ fontFamily: "monospace" }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function ParticipantFlow() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview"); // overview | futures | options | table

  useEffect(() => {
    fetch(`${API_BASE}/participant-flow`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: COLORS.muted, fontSize: 14 }}>Loading participant flow data...</div>
    </div>
  );

  if (error) return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: COLORS.bearish, fontSize: 14 }}>Error: {error}</div>
    </div>
  );

  const { summary, latest } = data;
  const sorted = [...summary].sort((a, b) => new Date(a.date) - new Date(b.date));
  const latest_data = summary[0]; // most recent first

  // Chart data — chronological
  const chartData = sorted.map(d => ({
    date: fmtDate(d.date),
    fii_fut: d.fii_fut_idx_net,
    client_idx: d.client_idx_net,
    dii_idx: d.dii_idx_net,
    pro_idx: d.pro_idx_net,
    fii_total: d.fii_total_net,
    fii_call: d.fii_call_net,
    fii_put: d.fii_put_net,
    divergence: d.fii_client_divergence,
    fii_long_pct: d.fii_fut_idx_long_pct,
  }));

  // Divergence trend — is gap widening or narrowing?
  const divTrend = sorted.length >= 2
    ? sorted[sorted.length - 1].fii_client_divergence - sorted[sorted.length - 2].fii_client_divergence
    : 0;

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "futures", label: "Futures" },
    { id: "options", label: "Options" },
    { id: "table", label: "Raw Data" },
  ];

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", fontFamily: "'Inter', sans-serif", color: COLORS.text }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px" }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>🏦 Participant Flow</h1>
            <BiasChip bias={latest_data?.fii_bias} />
            <span style={{ color: COLORS.muted, fontSize: 12, marginLeft: "auto" }}>
              Latest: {fmtDate(latest_data?.date)} · {summary.length} days
            </span>
          </div>
          <p style={{ color: COLORS.muted, fontSize: 13, margin: 0 }}>
            NSE F&O participant-wise open interest · FII vs Client divergence · Index futures positioning
          </p>
        </div>

        {/* Summary Cards */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
          <StatCard
            label="FII Fut Index Net"
            value={fmt(latest_data?.fii_fut_idx_net)}
            sub={`Long ${latest_data?.fii_fut_idx_long_pct}% of positions`}
            color={latest_data?.fii_fut_idx_net >= 0 ? COLORS.bullish : COLORS.bearish}
          />
          <StatCard
            label="FII Total Net (All)"
            value={fmt(latest_data?.fii_total_net)}
            sub="Futures + Options combined"
            color={latest_data?.fii_total_net >= 0 ? COLORS.bullish : COLORS.bearish}
          />
          <StatCard
            label="Client Index Net"
            value={fmt(latest_data?.client_idx_net)}
            sub={latest_data?.fii_client_opposite ? "⚡ Opposite to FII" : "Aligned with FII"}
            color={COLORS.client}
          />
          <StatCard
            label="FII–Client Divergence"
            value={fmt(latest_data?.fii_client_divergence)}
            sub={divTrend > 0 ? `↑ Widening +${fmt(divTrend)}` : `↓ Narrowing ${fmt(divTrend)}`}
            color={COLORS.fii}
          />
        </div>

        {/* Divergence Alert Banner */}
        {latest_data?.fii_client_opposite && (
          <div style={{
            background: "#f59e0b11", border: `1px solid #f59e0b44`,
            borderRadius: 8, padding: "10px 16px", marginBottom: 20,
            display: "flex", alignItems: "center", gap: 10, fontSize: 13
          }}>
            <span style={{ fontSize: 16 }}>⚡</span>
            <span>
              <strong style={{ color: COLORS.fii }}>FII vs Client divergence active</strong>
              <span style={{ color: COLORS.muted }}> — FII is net short index futures while Clients are net long. Institutional positioning opposes retail. Watch for mean reversion.</span>
            </span>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 0 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              background: "none", border: "none", cursor: "pointer",
              color: activeTab === t.id ? COLORS.text : COLORS.muted,
              fontSize: 13, fontWeight: activeTab === t.id ? 600 : 400,
              padding: "8px 16px",
              borderBottom: activeTab === t.id ? `2px solid ${COLORS.fii}` : "2px solid transparent",
              marginBottom: -1, transition: "all 0.15s"
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* FII vs Client Index Futures Net */}
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "20px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>FII vs Client — Index Futures Net Position</div>
              <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 16 }}>Daily net contracts · FII short = bearish institutional bias</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: COLORS.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: COLORS.muted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke={COLORS.border} />
                  <Bar dataKey="fii_fut" name="FII Fut Net" radius={[3, 3, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fii_fut >= 0 ? COLORS.bullish : COLORS.bearish} fillOpacity={0.8} />
                    ))}
                  </Bar>
                  <Bar dataKey="client_idx" name="Client Net" fill={COLORS.client} fillOpacity={0.5} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* FII–Client Divergence Trend */}
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "20px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Are FIIs betting against retail?</div>
              <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 12 }}>
                📈 Rising line = Yes, gap is widening — bearish signal &nbsp;·&nbsp; 📉 Falling line = Gap closing — watch for a rally
              </div>

              {/* Interpretation bar */}
              {(() => {
                const trend = divTrend;
                const latest_div = sorted[sorted.length - 1]?.divergence;
                const prev_div = sorted[sorted.length - 2]?.divergence;
                const pctChange = prev_div ? ((latest_div - prev_div) / prev_div * 100).toFixed(1) : 0;
                const fiiLongPct = sorted[sorted.length - 1]?.fii_long_pct;

                let signal, signalColor, signalBg, interpretation, watchFor;
                if (trend > 50000) {
                  signal = "⚠️ Bearish — Gap Widening";
                  signalColor = COLORS.bearish;
                  signalBg = "#ef444411";
                  interpretation = `FIIs are increasing their short position against retail. Gap grew by ${fmt(trend)} since last session.`;
                  watchFor = "Watch for FII Long % to rise above 15% as first sign of short covering.";
                } else if (trend < -50000) {
                  signal = "🟢 Bullish Signal — Gap Narrowing";
                  signalColor = COLORS.bullish;
                  signalBg = "#22c55e11";
                  interpretation = `FIIs are reducing shorts or retail is reducing longs. Gap narrowed by ${fmt(Math.abs(trend))}.`;
                  watchFor = "If gap continues to narrow, a short-covering rally is likely. Monitor closely.";
                } else {
                  signal = "⏸️ Neutral — Gap Stable";
                  signalColor = COLORS.neutral;
                  signalBg = "#6b728011";
                  interpretation = "No significant change in FII vs retail positioning today.";
                  watchFor = fiiLongPct < 15
                    ? `FII Long % at ${fiiLongPct}% — still heavily short. Any rise above 15% = early reversal signal.`
                    : `FII Long % at ${fiiLongPct}% — watch for trend change.`;
                }

                return (
                  <div style={{
                    background: signalBg, border: `1px solid ${signalColor}33`,
                    borderRadius: 8, padding: "12px 14px", marginBottom: 16
                  }}>
                    <div style={{ color: signalColor, fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{signal}</div>
                    <div style={{ color: COLORS.text, fontSize: 12, marginBottom: 4 }}>{interpretation}</div>
                    <div style={{ color: COLORS.muted, fontSize: 11 }}>👀 {watchFor}</div>
                  </div>
                );
              })()}

              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: COLORS.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: COLORS.muted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
                  <Tooltip content={<CustomTooltip />} />
                  {chartData.map((entry, i) => null)}
                  <Line
                    type="monotone"
                    dataKey="divergence"
                    name="FII vs Retail Gap"
                    stroke={divTrend > 50000 ? COLORS.bearish : divTrend < -50000 ? COLORS.bullish : COLORS.neutral}
                    strokeWidth={2.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* FII Long % */}
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "20px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>How much are FIIs long in index futures?</div>
              <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 12 }}>
                Below 20% = FIIs are heavily short · Rising towards 30%+ = they're covering shorts = bullish for market
              </div>
              {/* Long % interpretation */}
              {(() => {
                const currentPct = sorted[sorted.length - 1]?.fii_long_pct;
                const prevPct = sorted[sorted.length - 2]?.fii_long_pct;
                const trend = currentPct - prevPct;
                let signal, color, bg, text;
                if (currentPct < 12) {
                  signal = "🔴 Extremely Bearish";
                  color = COLORS.bearish;
                  bg = "#ef444411";
                  text = `FIIs are only ${currentPct}% long — 9 out of 10 FII index futures positions are SHORT. Sustained bearish institutional stance.`;
                } else if (currentPct < 20) {
                  signal = "🟠 Bearish";
                  color = "#f97316";
                  bg = "#f9731611";
                  text = `FIIs at ${currentPct}% long — still heavily positioned short on index futures.`;
                } else if (currentPct < 35) {
                  signal = "🟡 Neutral";
                  color = "#eab308";
                  bg = "#eab30811";
                  text = `FIIs at ${currentPct}% long — balanced positioning, no strong directional bias.`;
                } else {
                  signal = "🟢 Bullish";
                  color = COLORS.bullish;
                  bg = "#22c55e11";
                  text = `FIIs at ${currentPct}% long — significantly long on index futures. Bullish institutional stance.`;
                }
                const trendText = trend > 0
                  ? `↑ Rising +${trend.toFixed(1)}% vs last session — FIIs reducing shorts`
                  : trend < 0
                  ? `↓ Falling ${trend.toFixed(1)}% vs last session — FIIs adding more shorts`
                  : "Unchanged vs last session";

                return (
                  <div style={{ background: bg, border: `1px solid ${color}33`, borderRadius: 8, padding: "12px 14px", marginBottom: 16 }}>
                    <div style={{ color, fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{signal} · {trendText}</div>
                    <div style={{ color: COLORS.text, fontSize: 12 }}>{text}</div>
                  </div>
                );
              })()}
              <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 16 }}></div>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: COLORS.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: COLORS.muted, fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={50} stroke="#ffffff22" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="fii_long_pct" name="FII Long %" stroke={COLORS.bearish} strokeWidth={2} dot={{ r: 3, fill: COLORS.bearish }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* FUTURES TAB */}
        {activeTab === "futures" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "20px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>All Participants — Index Futures Net</div>
              <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 16 }}>FII · Client · DII · PRO daily net positions</div>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: COLORS.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: COLORS.muted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke={COLORS.border} />
                  <Legend wrapperStyle={{ fontSize: 12, color: COLORS.muted }} />
                  <Line type="monotone" dataKey="fii_fut" name="FII" stroke={COLORS.fii} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="client_idx" name="Client" stroke={COLORS.client} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="dii_idx" name="DII" stroke={COLORS.dii} strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="pro_idx" name="PRO" stroke={COLORS.pro} strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Latest breakdown */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {["FII", "CLIENT", "DII", "PRO"].map(p => {
                const d = latest[p];
                const color = p === "FII" ? COLORS.fii : p === "CLIENT" ? COLORS.client : p === "DII" ? COLORS.dii : COLORS.pro;
                return (
                  <div key={p} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "16px" }}>
                    <div style={{ color, fontWeight: 700, fontSize: 13, marginBottom: 12 }}>{p}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {[
                        ["Fut Index Long", d.fut_idx_long],
                        ["Fut Index Short", d.fut_idx_short],
                        ["Fut Index Net", d.fut_idx_net],
                        ["Fut Stock Net", d.fut_stk_net],
                      ].map(([label, val]) => (
                        <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                          <span style={{ color: COLORS.muted }}>{label}</span>
                          <span style={{ fontFamily: "monospace", color: val >= 0 ? COLORS.bullish : COLORS.bearish }}>
                            {fmt(val)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* OPTIONS TAB */}
        {activeTab === "options" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "20px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>FII Options — Call Net vs Put Net</div>
              <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 16 }}>
                FII Call Net negative = writing calls (bearish) · FII Put Net positive = writing puts or buying puts
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: COLORS.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: COLORS.muted, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke={COLORS.border} />
                  <Legend wrapperStyle={{ fontSize: 12, color: COLORS.muted }} />
                  <Bar dataKey="fii_call" name="FII Call Net" fill={COLORS.bearish} fillOpacity={0.7} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="fii_put" name="FII Put Net" fill={COLORS.bullish} fillOpacity={0.7} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Latest options breakdown */}
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "20px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Latest Options Detail — {fmtDate(latest_data?.date)}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {["FII", "CLIENT"].map(p => {
                  const d = latest[p];
                  const color = p === "FII" ? COLORS.fii : COLORS.client;
                  return (
                    <div key={p}>
                      <div style={{ color, fontWeight: 700, fontSize: 12, marginBottom: 10 }}>{p} Options</div>
                      {[
                        ["Call Long", d.opt_idx_call_long],
                        ["Call Short", d.opt_idx_call_short],
                        ["Call Net", d.opt_idx_call_net],
                        ["Put Long", d.opt_idx_put_long],
                        ["Put Short", d.opt_idx_put_short],
                        ["Put Net", d.opt_idx_put_net],
                      ].map(([label, val]) => (
                        <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                          <span style={{ color: COLORS.muted }}>{label}</span>
                          <span style={{ fontFamily: "monospace", color: val >= 0 ? COLORS.bullish : COLORS.bearish }}>
                            {fmt(val)}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TABLE TAB */}
        {activeTab === "table" && (
          <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    {["Date", "FII Fut Net", "FII Long %", "FII Total Net", "Client Net", "DII Net", "PRO Net", "Divergence", "Bias"].map(h => (
                      <th key={h} style={{
                        padding: "10px 14px", textAlign: "right", color: COLORS.muted,
                        fontWeight: 600, fontSize: 11, whiteSpace: "nowrap",
                        textAlign: h === "Date" || h === "Bias" ? "left" : "right"
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summary.map((row, i) => (
                    <tr key={row.date} style={{
                      borderBottom: `1px solid ${COLORS.border}`,
                      background: i % 2 === 0 ? "transparent" : "#ffffff04"
                    }}>
                      <td style={{ padding: "9px 14px", color: COLORS.text, fontWeight: 500 }}>{fmtDate(row.date)}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", fontFamily: "monospace", color: row.fii_fut_idx_net >= 0 ? COLORS.bullish : COLORS.bearish }}>{fmt(row.fii_fut_idx_net)}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", fontFamily: "monospace", color: COLORS.muted }}>{row.fii_fut_idx_long_pct}%</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", fontFamily: "monospace", color: row.fii_total_net >= 0 ? COLORS.bullish : COLORS.bearish }}>{fmt(row.fii_total_net)}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", fontFamily: "monospace", color: COLORS.client }}>{fmt(row.client_idx_net)}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", fontFamily: "monospace", color: COLORS.dii }}>{fmt(row.dii_idx_net)}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", fontFamily: "monospace", color: COLORS.pro }}>{fmt(row.pro_idx_net)}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", fontFamily: "monospace", color: COLORS.fii }}>{fmt(row.fii_client_divergence)}</td>
                      <td style={{ padding: "9px 14px" }}><BiasChip bias={row.fii_bias} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 24, color: COLORS.muted, fontSize: 11, textAlign: "center" }}>
          Source: NSE F&O Participant-wise OI · Updated daily at 7:30 PM IST · Informational only · Not investment advice
        </div>
      </div>
    </div>
  );
}
