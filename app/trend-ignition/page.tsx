"use client";

import { useEffect, useState } from "react";

const MCX_ENABLED = process.env.NEXT_PUBLIC_MCX_ENABLED === "true";

interface Signal {
  commodity: string;
  status: "fired" | "watch" | "quiet";
  direction: "bullish" | "bearish" | null;
  signal_score: number;
  pillars_met: number;
  oi_change_pct: number;
  oi_threshold: number;
  oi_passed: boolean;
  current_price: number;
  range_high: number;
  range_low: number;
  price_chg_pct: number;
  price_threshold: number;
  price_passed: boolean;
  volume_ratio: number;
  volume_threshold: number;
  volume_passed: boolean;
  expiry_date: string;
  atm_strike: number;
  scan_note: string;
  scanned_at: string;
}

const COMMODITY_META: Record<string, { label: string }> = {
  CRUDEOIL:   { label: "Crude Oil"   },
  GOLD:       { label: "Gold"        },
  SILVER:     { label: "Silver"      },
  NATURALGAS: { label: "Natural Gas" },
};

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function PillarDot({ passed }: { passed: boolean }) {
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8,
      borderRadius: "50%", marginRight: 4, flexShrink: 0,
      background: passed ? "var(--color-success, #1D9E75)" : "var(--color-border-secondary, #888)",
    }} />
  );
}

function SignalCard({ signal }: { signal: Signal }) {
  const meta = COMMODITY_META[signal.commodity] || { label: signal.commodity };
  const isFired = signal.status === "fired";
  const isWatch = signal.status === "watch";

  const cardStyle: React.CSSProperties = {
    background: "var(--color-background-primary)",
    border: isFired
      ? "2px solid #1D9E75"
      : isWatch
      ? "2px solid #BA7517"
      : "0.5px solid var(--color-border-tertiary)",
    borderRadius: 12,
    padding: "1rem 1.1rem",
    marginBottom: 10,
  };

  const badgeStyle: React.CSSProperties = isFired
    ? { background: "#E1F5EE", color: "#085041" }
    : isWatch
    ? { background: "#FAEEDA", color: "#633806" }
    : { background: "var(--color-background-tertiary)", color: "var(--color-text-secondary)" };

  const badgeText = isFired
    ? `ignition fired${signal.direction ? ` — ${signal.direction}` : ""}`
    : isWatch ? `${signal.pillars_met}/3 — watch` : "quiet";

  const pillarBg: React.CSSProperties = {
    background: "var(--color-background-secondary)",
    borderRadius: 8,
    padding: "8px 10px",
  };

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div>
          <span style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)" }}>
            {meta.label}
          </span>
          <span style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginLeft: 8 }}>
            {signal.expiry_date} · ATM {signal.atm_strike?.toLocaleString("en-IN")}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>
            ₹{signal.current_price?.toLocaleString("en-IN")}
          </span>
          <span style={{
            fontSize: 11, padding: "2px 10px", borderRadius: 99, fontWeight: 500,
            ...badgeStyle,
          }}>
            {badgeText}
          </span>
        </div>
      </div>

      {/* 3 pillars */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 10 }}>
        <div style={pillarBg}>
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 3 }}>OI change (5min)</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", display: "flex", alignItems: "center" }}>
            <PillarDot passed={signal.oi_passed} />
            {signal.oi_change_pct > 0 ? "+" : ""}{signal.oi_change_pct?.toFixed(1)}%
          </div>
          <div style={{ fontSize: 11, color: signal.oi_passed ? "#1D9E75" : "var(--color-text-tertiary)" }}>
            threshold {signal.oi_threshold}%
          </div>
        </div>

        <div style={pillarBg}>
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 3 }}>Price breakout</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", display: "flex", alignItems: "center" }}>
            <PillarDot passed={signal.price_passed} />
            {signal.price_chg_pct > 0 ? "+" : ""}{signal.price_chg_pct?.toFixed(1)}%
          </div>
          <div style={{ fontSize: 11, color: signal.price_passed ? "#1D9E75" : "var(--color-text-tertiary)" }}>
            threshold {signal.price_threshold}%
          </div>
        </div>

        <div style={pillarBg}>
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 3 }}>Volume spike</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", display: "flex", alignItems: "center" }}>
            <PillarDot passed={signal.volume_passed} />
            {signal.volume_ratio?.toFixed(1)}x avg
          </div>
          <div style={{ fontSize: 11, color: signal.volume_passed ? "#1D9E75" : "var(--color-text-tertiary)" }}>
            threshold {signal.volume_threshold}x
          </div>
        </div>
      </div>

      {/* Note + score bar */}
      {(isFired || isWatch) && (
        <div style={{ borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0, flex: 1, lineHeight: 1.5 }}>
              {signal.scan_note}
            </p>
            <div style={{ width: 90, flexShrink: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 3 }}>
                <span>strength</span><span>{signal.signal_score}%</span>
              </div>
              <div style={{ height: 5, background: "var(--color-background-tertiary)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 99,
                  width: `${signal.signal_score}%`,
                  background: isFired ? "#1D9E75" : "#BA7517",
                }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrendIgnitionPage() {
  if (!MCX_ENABLED) {
    return (
      <div style={{ padding: "4rem 2rem", textAlign: "center", color: "var(--color-text-secondary)" }}>
        <h2>404 — Page not found</h2>
      </div>
    );
  }

  const [signals, setSignals]       = useState<Signal[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [countdown, setCountdown]   = useState(60);

  async function fetchSignals() {
    try {
      const res = await fetch("/api/mcx/ignition");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSignals(data.signals || []);
      setLastUpdate(new Date());
      setError(null);
      setCountdown(60);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSignals();
    const interval = setInterval(fetchSignals, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setCountdown(c => c > 0 ? c - 1 : 60), 1000);
    return () => clearInterval(tick);
  }, []);

  const firedCount = signals.filter(s => s.status === "fired").length;
  const watchCount = signals.filter(s => s.status === "watch").length;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "1.5rem 1rem" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, color: "var(--color-text-primary)" }}>
            Trend ignition
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-text-tertiary)", margin: "4px 0 0" }}>
            MCX · 5-min scan · refreshes in {countdown}s
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {firedCount > 0 && (
            <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 99, background: "#E1F5EE", color: "#085041", fontWeight: 500 }}>
              {firedCount} fired
            </span>
          )}
          {watchCount > 0 && (
            <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 99, background: "#FAEEDA", color: "#633806", fontWeight: 500 }}>
              {watchCount} watch
            </span>
          )}
          <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>
            {lastUpdate ? timeAgo(lastUpdate.toISOString()) : "—"}
          </span>
          <button
            onClick={fetchSignals}
            style={{
              fontSize: 12, padding: "4px 12px", borderRadius: 8, cursor: "pointer",
              border: "0.5px solid var(--color-border-secondary)",
              background: "transparent", color: "var(--color-text-primary)",
            }}
          >
            refresh
          </button>
        </div>
      </div>

      {/* WIP banner */}
      <div style={{
        background: "#FAEEDA", borderRadius: 8,
        padding: "8px 14px", marginBottom: 16,
        fontSize: 12, color: "#633806",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span>⚠</span>
        <span>Work in progress — signals are live but thresholds are being calibrated. Do not trade solely on these signals.</span>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-text-secondary)", fontSize: 14 }}>
          Loading signals...
        </div>
      )}

      {error && (
        <div style={{ background: "var(--color-background-danger)", borderRadius: 8, padding: "12px 16px", color: "var(--color-text-danger)", fontSize: 13, marginBottom: 12 }}>
          Error: {error}
        </div>
      )}

      {!loading && signals.map(signal => <SignalCard key={signal.commodity} signal={signal} />)}

      {!loading && signals.length === 0 && !error && (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-text-secondary)", fontSize: 14 }}>
          No signals yet — seed runs at 9:00 AM IST
        </div>
      )}

      <div style={{ marginTop: 20, fontSize: 11, color: "var(--color-text-tertiary)", textAlign: "center" }}>
        CommodityNova (WIP) · MCX data via Kite · Not investment advice
      </div>
    </div>
  );
}
