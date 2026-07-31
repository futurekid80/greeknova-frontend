"use client";

import { supabase } from '@/lib/supabase'
import { useEffect, useState, useRef } from "react";

const MCX_ENABLED = process.env.NEXT_PUBLIC_MCX_ENABLED === "true";

const COMMODITIES = [
  { key: "CRUDEOIL",   label: "Crude Oil",   step: 100  },
  { key: "GOLD",       label: "Gold",        step: 500  },
  { key: "SILVER",     label: "Silver",      step: 1000 },
  { key: "NATURALGAS", label: "Natural Gas", step: 10   },
];

interface StrikeRow {
  strike: number;
  ce_oi: number;
  pe_oi: number;
  ce_delta: number;
  pe_delta: number;
}

interface HistoryRow {
  scanned_at: string;
  oi_change_pct: number;
  cumulative_oi_pct: number;
}

interface OIMapData {
  commodity: string;
  current_price: number;
  atm_strike: number;
  session_summary: {
    cumulative_oi_pct: number;
    session_peak_oi_pct: number;
    oi_unwind_status: string;
    futures_oi_direction: string;
    support_strike: number;
    resistance_strike: number;
  };
  strike_oi: StrikeRow[];
  oi_history: HistoryRow[];
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function AccumulationBars({ history, commodity }: { history: HistoryRow[]; commodity: string }) {
  if (!history.length) return (
    <div style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-tertiary)", fontSize: 13 }}>
      No scan history yet — accumulates through the session
    </div>
  );

  const maxAbs = Math.max(...history.map(h => Math.abs(h.oi_change_pct)), 0.1);
  const BAR_MAX_H = 52;

  // Show every nth label to avoid crowding
  const showEvery = history.length > 20 ? 4 : history.length > 10 ? 2 : 1;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: BAR_MAX_H + 8, paddingBottom: 4, borderBottom: "0.5px solid var(--color-border-tertiary)", overflowX: "auto" }}>
        {history.map((h, i) => {
          const pct  = h.oi_change_pct;
          const h_px = Math.max(3, Math.round((Math.abs(pct) / maxAbs) * BAR_MAX_H));
          const color = pct >= 0 ? "#1D9E75" : "#E24B4A";
          return (
            <div key={i} title={`${timeLabel(h.scanned_at)}: ${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`}
              style={{ flexShrink: 0, width: 14, height: h_px, background: color, borderRadius: "2px 2px 0 0", cursor: "default" }}
            />
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{timeLabel(history[0].scanned_at)}</span>
        <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>{timeLabel(history[history.length - 1].scanned_at)}</span>
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, background: "#1D9E75", borderRadius: 2, display: "inline-block" }} />
          <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>OI added</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, background: "#E24B4A", borderRadius: 2, display: "inline-block" }} />
          <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>OI reduced</span>
        </div>
        <div style={{ marginLeft: "auto", fontSize: 11, color: "var(--color-text-tertiary)" }}>
          {history.length} scans today
        </div>
      </div>
    </div>
  );
}

function OIMapChart({ strikes, currentPrice }: { strikes: StrikeRow[] | undefined; currentPrice: number }) {
  if (!strikes?.length) return (
    <div style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-tertiary)", fontSize: 13 }}>
      No strike data yet — run seed first
    </div>
  );

  // Sort ascending for left-to-right display, filter out zero/invalid strikes
  const sorted = [...(strikes || [])].filter(s => s.strike > 0).sort((a, b) => a.strike - b.strike);
  const maxOI = Math.max(...sorted.flatMap(s => [s.ce_oi, s.pe_oi]), 1);
  const BAR_W = 34;
  const GAP = 4;
  const GROUP = BAR_W * 2 + GAP + 18;
  const BAR_MAX_H = 180;
  const LABEL_H = 40;
  const TOP_PAD = 28;
  const totalH = BAR_MAX_H + LABEL_H + TOP_PAD;
  const totalW = sorted.length * GROUP + 40;

  const strikeStep = sorted.length > 1 ? Math.abs(sorted[1].strike - sorted[0].strike) : 100;

  function bH(oi: number) { return Math.max(2, Math.round((oi / maxOI) * BAR_MAX_H)); }
  function oiLabel(oi: number) { return oi >= 1000 ? `${(oi / 1000).toFixed(1)}K` : `${oi}`; }

  const baseY = TOP_PAD + BAR_MAX_H;

  return (
    <div>
    <div style={{ overflowX: "auto", overflowY: "hidden" }}>
      <svg width={totalW} height={totalH} style={{ display: "block", minWidth: totalW }}>
        <defs>
          {/* Diagonal stripe — PE adding */}
          <pattern id="pe-stripe" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
            <rect width="8" height="8" fill="#1D9E75" />
            <line x1="0" y1="0" x2="0" y2="8" stroke="#04291E" strokeWidth="4" />
          </pattern>
          {/* Diagonal stripe — CE adding */}
          <pattern id="ce-stripe" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
            <rect width="8" height="8" fill="#E24B4A" />
            <line x1="0" y1="0" x2="0" y2="8" stroke="#5A0A0A" strokeWidth="4" />
          </pattern>
        </defs>

        {sorted.map((row, i) => {
          const gx = 10 + i * GROUP;
          const peX = gx;
          const ceX = gx + BAR_W + GAP;
          const midX = gx + BAR_W + GAP / 2;

          const isPrice   = Math.abs(row.strike - currentPrice) < strikeStep * 0.6;
          const isSupport = row.pe_oi > row.ce_oi * 1.5 && row.strike < currentPrice;
          const isResist  = row.ce_oi > row.pe_oi * 1.5 && row.strike > currentPrice;

          const peH = bH(row.pe_oi);
          const ceH = bH(row.ce_oi);

          // Adding stripe height — proportional to delta vs total
          const peDeltaFrac = row.pe_delta > 0 ? Math.min(row.pe_delta / row.pe_oi, 1) : 0;
          const ceDeltaFrac = row.ce_delta > 0 ? Math.min(row.ce_delta / row.ce_oi, 1) : 0;
          const peStripeH = Math.max(2, Math.round(peH * peDeltaFrac));
          const ceStripeH = Math.max(2, Math.round(ceH * ceDeltaFrac));

          // Covering = hollow dashed overlay at top
          const peCoverFrac = row.pe_delta < 0 ? Math.min(Math.abs(row.pe_delta) / Math.max(row.pe_oi, 1), 1) : 0;
          const ceCoverFrac = row.ce_delta < 0 ? Math.min(Math.abs(row.ce_delta) / Math.max(row.ce_oi, 1), 1) : 0;
          const peCoverH = Math.max(2, Math.round(peH * peCoverFrac));
          const ceCoverH = Math.max(2, Math.round(ceH * ceCoverFrac));

          const peBaseColor = isSupport ? "#1D9E75" : "#6EC4A7";
          const ceBaseColor = isResist  ? "#E24B4A" : "#F0A0A0";
          const labelFill   = isPrice ? "#1D9E75" : isSupport ? "#1D9E75" : isResist ? "#E24B4A" : "#888";
          const labelWeight = isPrice || isSupport || isResist ? "bold" : "normal";

          return (
            <g key={row.strike}>
              {/* Price dashed line */}
              {isPrice && (
                <line x1={midX} y1={TOP_PAD} x2={midX} y2={baseY + 2}
                  stroke="#1D9E75" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
              )}

              {/* ── PE bar (left) ── */}
              {/* Base solid */}
              <rect x={peX} y={baseY - peH} width={BAR_W} height={peH}
                fill={peBaseColor} rx={2} />
              {/* Stripe overlay — adding */}
              {peDeltaFrac > 0 && (
                <rect x={peX} y={baseY - peH} width={BAR_W} height={peStripeH}
                  fill="url(#pe-stripe)" rx={2} />
              )}
              {/* Hollow covering overlay */}
              {peCoverFrac > 0 && (
                <rect x={peX} y={baseY - peH} width={BAR_W} height={peCoverH}
                  fill="var(--color-background-primary, #111)"
                  stroke="#1D9E75" strokeWidth={2.5} strokeDasharray="4 2" rx={2} opacity={0.9} />
              )}

              {/* ── CE bar (right) ── */}
              <rect x={ceX} y={baseY - ceH} width={BAR_W} height={ceH}
                fill={ceBaseColor} rx={2} />
              {ceDeltaFrac > 0 && (
                <rect x={ceX} y={baseY - ceH} width={BAR_W} height={ceStripeH}
                  fill="url(#ce-stripe)" rx={2} />
              )}
              {ceCoverFrac > 0 && (
                <rect x={ceX} y={baseY - ceH} width={BAR_W} height={ceCoverH}
                  fill="var(--color-background-primary, #111)"
                  stroke="#E24B4A" strokeWidth={2.5} strokeDasharray="4 2" rx={2} opacity={0.9} />
              )}

              {/* OI label above every bar */}
              {peH > 8 && (
                <text x={peX + BAR_W / 2} y={baseY - peH - 5} textAnchor="middle"
                  fontSize={10} fill={isSupport ? "#1D9E75" : "#6EC4A7"} fontWeight={isSupport ? "700" : "400"}>
                  {oiLabel(row.pe_oi)}
                </text>
              )}
              {ceH > 8 && (
                <text x={ceX + BAR_W / 2} y={baseY - ceH - 5} textAnchor="middle"
                  fontSize={10} fill={isResist ? "#E24B4A" : "#F0A0A0"} fontWeight={isResist ? "700" : "400"}>
                  {oiLabel(row.ce_oi)}
                </text>
              )}

              {/* Strike label */}
              <text x={midX} y={baseY + 16} textAnchor="middle"
                fontSize={11} fill={labelFill} fontWeight={labelWeight}>
                {row.strike % 1000 === 0 || row.strike < 1000
                  ? row.strike
                  : row.strike.toLocaleString("en-IN")}
              </text>
              {isPrice && (
                <text x={midX} y={baseY + 25} textAnchor="middle" fontSize={8} fill="#1D9E75">▲</text>
              )}
            </g>
          );
        })}

        {/* Baseline */}
        <line x1={0} y1={baseY} x2={totalW} y2={baseY}
          stroke="#333" strokeWidth={1} />
      </svg>
    </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 14, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
        {/* PE base */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 12, height: 12, background: "#6EC4A7", borderRadius: 2, display: "inline-block" }} />
          <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>PE base</span>
        </div>
        {/* PE adding — diagonal lines */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 12, height: 12, background: "repeating-linear-gradient(45deg,#1D9E75,#1D9E75 2px,#085041 2px,#085041 4px)", borderRadius: 2, flexShrink: 0 }}></div>
          <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>PE adding</span>
        </div>
        {/* PE covering */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 12, height: 12, border: "1.5px dashed #1D9E75", borderRadius: 2, display: "inline-block" }} />
          <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>PE covering</span>
        </div>
        {/* CE base */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 12, height: 12, background: "#F0A0A0", borderRadius: 2, display: "inline-block" }} />
          <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>CE base</span>
        </div>
        {/* CE adding */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 12, height: 12, background: "repeating-linear-gradient(45deg,#E24B4A,#E24B4A 2px,#7B1818 2px,#7B1818 4px)", borderRadius: 2, flexShrink: 0 }}></div>
          <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>CE adding</span>
        </div>
        {/* CE covering */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 12, height: 12, border: "1.5px dashed #E24B4A", borderRadius: 2, display: "inline-block" }} />
          <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>CE covering</span>
        </div>
      </div>
    </div>
  );
}


interface SessionExits {
  commodity: string;
  ce_exits: { strike: number; total_exited: number }[];
  pe_exits: { strike: number; total_exited: number }[];
  ce_total_exited: number;
  pe_total_exited: number;
  divergence: "pe_heavy" | "ce_heavy" | null;
}

function SessionExitSummary({ commodity }: { commodity: string }) {
  const [exits, setExits] = useState<SessionExits | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchExits() {
      try {
        const res = await fetch(`/api/mcx/session-exits/${commodity}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setExits(data);
      } catch {}
    }
    fetchExits();
    const interval = setInterval(fetchExits, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [commodity]);

  if (!exits) return null;
  if (exits.ce_exits.length === 0 && exits.pe_exits.length === 0) return null;

  const fmt = (n: number) => Math.abs(n).toLocaleString("en-IN");

  const divergenceCfg: Record<string, any> = {
    pe_heavy: {
      color: "#E24B4A", bg: "rgba(220,38,38,0.08)", border: "#DC2626",
      label: "\u26a0\ufe0f PE exits dominant \u2014 bulls exiting more than bears",
      note: "If price is rallying, this weakens the case for the move. Existing bulls taking profit into strength.",
    },
    ce_heavy: {
      color: "#1D9E75", bg: "rgba(29,158,117,0.08)", border: "#1D9E75",
      label: "\u26a0\ufe0f CE exits dominant \u2014 bears exiting more than bulls",
      note: "If price is falling, this weakens the case for the move. Existing bears covering into weakness.",
    },
  };

  const cfg = exits.divergence ? divergenceCfg[exits.divergence] : null;

  return (
    <div style={{ marginTop: 16, border: "1px solid var(--color-border-secondary)", borderRadius: 8, overflow: "hidden" }}>
      <button onClick={() => setExpanded(!expanded)} style={{ width: "100%", textAlign: "left", padding: "12px 14px", background: "var(--color-background-secondary)", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>\ud83d\udccb Session Exit Summary</div>
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 2 }}>
            Total today \u00b7 PE \u2212{fmt(exits.pe_total_exited)} lots \u00b7 CE \u2212{fmt(exits.ce_total_exited)} lots
          </div>
        </div>
        <span style={{ fontSize: 16, color: "var(--color-text-tertiary)" }}>{expanded ? "\u2212" : "+"}</span>
      </button>

      {cfg && (
        <div style={{ padding: "10px 14px", background: cfg.bg, borderTop: `1px solid ${cfg.border}`, fontSize: 12 }}>
          <div style={{ color: cfg.color, fontWeight: 600, marginBottom: 4 }}>{cfg.label}</div>
          <div style={{ color: "var(--color-text-secondary)", fontSize: 11 }}>{cfg.note}</div>
        </div>
      )}

      {expanded && (
        <div style={{ padding: "12px 14px", display: "flex", gap: 20, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#1D9E75", marginBottom: 6 }}>PE exited (bulls leaving)</div>
            {exits.pe_exits.length === 0 && (<div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>No PE exits today</div>)}
            {exits.pe_exits.map((e, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
                <span style={{ color: "var(--color-text-primary)" }}>\u20b9{e.strike.toLocaleString("en-IN")}</span>
                <span style={{ color: "#E24B4A" }}>\u2212{fmt(e.total_exited)}</span>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#E24B4A", marginBottom: 6 }}>CE exited (bears leaving)</div>
            {exits.ce_exits.length === 0 && (<div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>No CE exits today</div>)}
            {exits.ce_exits.map((e, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
                <span style={{ color: "var(--color-text-primary)" }}>\u20b9{e.strike.toLocaleString("en-IN")}</span>
                <span style={{ color: "#1D9E75" }}>\u2212{fmt(e.total_exited)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function OIMapPage() {
  const [authChecked, setAuthChecked] = useState(false)

  // Auth gate — redirect to login if no session
  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        window.location.href = '/login?returnTo=' + window.location.pathname
      } else {
        setAuthChecked(true)
      }
    }
    checkAuth()
  }, [])

  const [selected, setSelected]   = useState("CRUDEOIL");
  const [data, setData]           = useState<OIMapData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(30);
  const fetchRef = useRef<() => Promise<void>>(() => Promise.resolve());

  fetchRef.current = async () => {
    try {
      const res  = await fetch(`/api/mcx/oi-map/${selected}`);
      const json = await res.json();
      setData(json);
      setLastUpdate(new Date());
      setCountdown(30);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchRef.current?.();
    const interval = setInterval(() => fetchRef.current?.(), 30000);
    return () => clearInterval(interval);
  }, [selected]);

  useEffect(() => {
    const tick = setInterval(() => setCountdown(c => c > 0 ? c - 1 : 30), 1000);
    return () => clearInterval(tick);
  }, []);

  // Refresh when tab becomes visible — handles laptop sleep/tab switch
  // Also resets the interval so countdown is accurate after wake
  useEffect(() => {
    let lastHidden = Date.now();
    const onVisible = () => {
      if (document.visibilityState === "hidden") {
        lastHidden = Date.now();
      } else if (document.visibilityState === "visible") {
        const asleepMs = Date.now() - lastHidden;
        if (asleepMs > 10000) {
          // Asleep more than 10s — fetch fresh data immediately
          fetchRef.current?.();
        }
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  if (!authChecked) return null;
  if (!MCX_ENABLED) {
    return <div style={{ padding: "4rem 2rem", textAlign: "center", color: "var(--color-text-secondary)" }}><h2>404 — Page not found</h2></div>;
  }

  const meta = COMMODITIES.find(c => c.key === selected)!;
  const summary = data?.session_summary;

  const dirColor = (d?: string) => {
    if (!d || d === "neutral") return "var(--color-text-secondary)";
    if (d.includes("long buildup") || d.includes("short covering")) return "#1D9E75";
    return "#E24B4A";
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "1.5rem 1rem" }}>
      {/* MCX nav strip */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        <a href="/trend-ignition" style={{
          fontSize: 12, padding: "4px 12px", borderRadius: 8, textDecoration: "none",
          background: "transparent", color: "var(--color-text-secondary)",
          border: "0.5px solid var(--color-border-secondary)",
        }}>⚡ Trend ignition</a>
        <a href="/oi-map" style={{
          fontSize: 12, padding: "4px 12px", borderRadius: 8, textDecoration: "none",
          background: "#E1F5EE", color: "#085041", fontWeight: 500,
          border: "0.5px solid #1D9E75",
        }}>📊 OI map</a>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 500, margin: "0 0 4px", color: "var(--color-text-primary)" }}>OI map</h1>
        <p style={{ fontSize: 13, color: "var(--color-text-tertiary)", margin: 0 }}>
          MCX · strike OI · next refresh in {countdown}s
        </p>
      </div>

      {/* Progress bar */}
      <div style={{ height: 2, background: "var(--color-background-secondary)", borderRadius: 99, marginBottom: 16, overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 99, width: `${((30 - countdown) / 30) * 100}%`, background: "var(--color-border-info, #185FA5)", transition: "width 1s linear" }} />
      </div>

      {/* Commodity selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {COMMODITIES.map(c => (
          <button key={c.key} onClick={() => setSelected(c.key)} style={{
            fontSize: 13, padding: "6px 16px", borderRadius: 8, cursor: "pointer",
            border: selected === c.key ? "2px solid #1D9E75" : "0.5px solid var(--color-border-secondary)",
            background: selected === c.key ? "#E1F5EE" : "transparent",
            color: selected === c.key ? "#085041" : "var(--color-text-secondary)",
            fontWeight: selected === c.key ? 500 : 400,
          }}>
            {c.label}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-text-secondary)" }}>Loading...</div>}

      {!loading && data && (
        <>
          {/* Session summary strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 16 }}>
            <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 2 }}>Current price</div>
              <div style={{ fontSize: 16, fontWeight: 500, color: "var(--color-text-primary)" }}>
                ₹{data.current_price?.toLocaleString("en-IN")}
              </div>
            </div>
            <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 2 }}>Session OI</div>
              <div style={{ fontSize: 16, fontWeight: 500, color: (summary?.cumulative_oi_pct ?? 0) >= 0 ? "#1D9E75" : "#E24B4A" }}>
                {(summary?.cumulative_oi_pct ?? 0) > 0 ? "+" : ""}{summary?.cumulative_oi_pct?.toFixed(1)}%
              </div>
            </div>
            <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 2 }}>Direction</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: dirColor(summary?.futures_oi_direction) }}>
                {summary?.futures_oi_direction || "neutral"}
              </div>
            </div>
          </div>

          {/* OI Map — shown first, most important */}
          <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1rem 1.1rem", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>
                Strike OI distribution
              </div>
              <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
                ₹{data.current_price?.toLocaleString("en-IN")} · ATM {data.atm_strike?.toLocaleString("en-IN")}
              </div>
            </div>
            <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 12 }}>
              PE (green) = put writers defending · CE (red) = call writers capping
            </div>
            <OIMapChart strikes={data.strike_oi} currentPrice={data.current_price} />
            <SessionExitSummary commodity={selected} />
          </div>

          {/* OI Accumulation bars — only show when data exists */}
          {(data?.oi_history ?? []).length > 0 && (
            <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1rem 1.1rem" }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 10 }}>
                Session OI accumulation
                <span style={{ fontSize: 11, fontWeight: 400, color: "var(--color-text-tertiary)", marginLeft: 8 }}>each bar = 5-min scan</span>
              </div>
              <AccumulationBars history={data?.oi_history ?? []} commodity={selected} />
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: 20, fontSize: 11, color: "var(--color-text-tertiary)", textAlign: "center" }}>
        CommodityNova (WIP) · MCX data via Kite · Not investment advice
      </div>
    </div>
  );
}
