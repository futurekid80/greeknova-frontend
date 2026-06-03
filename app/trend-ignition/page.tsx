"use client";

import { useEffect, useState, useRef } from "react";

const MCX_ENABLED = process.env.NEXT_PUBLIC_MCX_ENABLED === "true";
const REFRESH_INTERVAL = 30;

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
  session_open_oi: number;
  cumulative_oi_pct: number;
  cumulative_direction: "bullish" | "bearish" | "neutral";
  futures_oi_direction: "long buildup" | "short buildup" | "short covering" | "long unwinding" | "neutral";
  overnight_oi_direction: string;
  session_open_price: number;
  session_peak_oi_pct: number;
  oi_unwind_status: "building" | "rolling_over" | "unwinding";
  divergence_label: "neutral" | "continuation" | "exhaustion" | "coiling" | "trap";
  divergence_note: string;
  support_strike: number;
  support_oi: number;
  resistance_strike: number;
  resistance_oi: number;
  ce_oi_delta: number;
  pe_oi_delta: number;
  rally_quality: "neutral" | "genuine" | "suspect";
  rally_note: string;
  ce_writing_count: number;
  pe_writing_count: number;
  ce_buying_count: number;
  pe_buying_count: number;
  trade_signal: string;
  trade_signal_icon: string;
  trade_signal_note: string;
  trade_signal_action: string;
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
      background: passed ? "#1D9E75" : "var(--color-border-secondary, #888)",
    }} />
  );
}

function LiveDot() {
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", marginRight: 6 }}>
      <span style={{
        width: 8, height: 8, borderRadius: "50%",
        background: "#1D9E75", display: "inline-block",
        animation: "livepulse 2s infinite",
      }} />
      <style>{`
        @keyframes livepulse {
          0%   { box-shadow: 0 0 0 0 rgba(29,158,117,0.6); }
          70%  { box-shadow: 0 0 0 6px rgba(29,158,117,0); }
          100% { box-shadow: 0 0 0 0 rgba(29,158,117,0); }
        }
      `}</style>
    </span>
  );
}

function useAlerts(signals: Signal[]) {
  const prevStatusRef = useRef<Record<string, string>>({});
  const permissionRef = useRef<NotificationPermission>("default");

  useEffect(() => {
    if ("Notification" in window) {
      Notification.requestPermission().then(p => { permissionRef.current = p; });
    }
  }, []);

  useEffect(() => {
    if (!signals.length) return;
    if (!("Notification" in window)) return;
    if (permissionRef.current !== "granted") return;

    signals.forEach(signal => {
      const prev  = prevStatusRef.current[signal.commodity];
      const curr  = signal.status;
      const label = COMMODITY_META[signal.commodity]?.label || signal.commodity;

      if (prev && prev !== curr) {
        if (curr === "fired") {
          new Notification(`⚡ IGNITION — ${label}`, {
            body: `${signal.direction?.toUpperCase() || "SIGNAL"} · ₹${signal.current_price?.toLocaleString("en-IN")} · Score ${signal.signal_score}%`,
            icon: "/favicon.ico",
            tag: `mcx-${signal.commodity}`,
          });
        } else if (curr === "watch" && prev === "quiet") {
          new Notification(`👀 Watch — ${label}`, {
            body: `${signal.pillars_met}/3 pillars · ₹${signal.current_price?.toLocaleString("en-IN")}`,
            icon: "/favicon.ico",
            tag: `mcx-${signal.commodity}`,
          });
        }
      }
      prevStatusRef.current[signal.commodity] = curr;
    });
  }, [signals]);
}

function CumulativeBar({ pct, direction, futuresDirection }: { pct: number; direction: string; futuresDirection?: string }) {
  const dirEmoji = pct > 0.05 ? "▲" : pct < -0.05 ? "▼" : "—";

  const futDirConfig: Record<string, { color: string; label: string }> = {
    "long buildup":   { color: "#1D9E75", label: "long buildup" },
    "short buildup":  { color: "#C0392B", label: "short buildup" },
    "short covering": { color: "#1D9E75", label: "short covering" },
    "long unwinding": { color: "#C0392B", label: "long unwinding" },
    "neutral":        { color: "var(--color-text-tertiary)", label: "neutral" },
  };

  const fd  = futuresDirection || "neutral";
  const cfg = futDirConfig[fd] || futDirConfig["neutral"];
  const barWidth = Math.min(Math.abs(pct) * 5, 100);

  return (
    <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 2 }}>Session OI (positional)</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: cfg.color, display: "flex", alignItems: "center", gap: 4 }}>
          <span>{dirEmoji}</span>
          <span>{pct > 0 ? "+" : ""}{pct?.toFixed(1)}%</span>
          <span style={{ fontSize: 11, fontWeight: 400, color: "var(--color-text-tertiary)", marginLeft: 2 }}>
            since open · <span style={{ color: cfg.color, fontWeight: 500 }}>{cfg.label}</span>
          </span>
        </div>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ height: 4, background: "var(--color-background-tertiary)", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 99, width: `${barWidth}%`, background: cfg.color, transition: "width 0.5s ease" }} />
        </div>
      </div>
    </div>
  );
}

function OvernightBadge({ direction }: { direction: string }) {
  if (!direction || direction === "neutral") return null;

  const config: Record<string, { color: string; bg: string; icon: string }> = {
    "long buildup":   { bg: "#E1F5EE", color: "#085041", icon: "📈" },
    "short buildup":  { bg: "#FCEBEB", color: "#791F1F", icon: "📉" },
    "short covering": { bg: "#E1F5EE", color: "#085041", icon: "↗" },
    "long unwinding": { bg: "#FCEBEB", color: "#791F1F", icon: "↘" },
  };

  const cfg = config[direction];
  if (!cfg) return null;

  return (
    <div style={{ background: cfg.bg, borderRadius: 6, padding: "4px 10px", marginTop: 6, fontSize: 11, color: cfg.color, display: "flex", alignItems: "center", gap: 5 }}>
      <span>{cfg.icon}</span>
      <span style={{ fontWeight: 500 }}>Overnight: {direction}</span>
      <span style={{ opacity: 0.8 }}>— futures OI context</span>
    </div>
  );
}

function UnwindBadge({ status, peak, current }: { status: string; peak: number; current: number }) {
  if (status === "building") return null;

  const isUnwinding = status === "unwinding";
  const bg    = isUnwinding ? "#FCEBEB" : "#FAEEDA";
  const color = isUnwinding ? "#791F1F" : "#633806";
  const icon  = isUnwinding ? "🔴" : "⚠";
  const label = isUnwinding
    ? `OI unwinding — peak ${peak > 0 ? "+" : ""}${peak.toFixed(1)}%, now ${current > 0 ? "+" : ""}${current.toFixed(1)}% — possible exhaustion`
    : `OI rolling over — peak ${peak > 0 ? "+" : ""}${peak.toFixed(1)}%, now ${current > 0 ? "+" : ""}${current.toFixed(1)}% — watch for reversal`;

  return (
    <div style={{ background: bg, borderRadius: 6, padding: "5px 10px", marginTop: 6, display: "flex", alignItems: "center", gap: 6, fontSize: 12, color }}>
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function DivergenceBadge({ label, note }: { label: string; note: string }) {
  if (!label || label === "neutral" || !note) return null;

  const styles: Record<string, { bg: string; color: string; icon: string }> = {
    continuation: { bg: "#E1F5EE", color: "#085041", icon: "✓" },
    exhaustion:   { bg: "#FCEBEB", color: "#791F1F", icon: "⚡" },
    coiling:      { bg: "#FAEEDA", color: "#633806", icon: "◎" },
    trap:         { bg: "#FCEBEB", color: "#791F1F", icon: "⚠" },
  };

  const s = styles[label];
  if (!s) return null;

  return (
    <div style={{ background: s.bg, borderRadius: 6, padding: "5px 10px", marginTop: 6, display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: s.color }}>
      <span style={{ fontWeight: 500 }}>{s.icon} {label.charAt(0).toUpperCase() + label.slice(1)}</span>
      <span style={{ opacity: 0.8 }}>— {note}</span>
    </div>
  );
}

function SRLevels({ support, resistance, price }: { support: number; resistance: number; price: number }) {
  if (!support && !resistance) return null;

  return (
    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
      {support > 0 && (
        <div style={{ flex: 1, background: "var(--color-background-secondary)", borderRadius: 6, padding: "6px 10px", borderLeft: "2px solid #1D9E75" }}>
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 2 }}>PE wall · support</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#1D9E75" }}>
            ₹{support.toLocaleString("en-IN")}
          </div>
          {price > 0 && (
            <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
              {price > support
                ? `↓ ${((price - support) / price * 100).toFixed(1)}% below price`
                : `↑ ${((support - price) / price * 100).toFixed(1)}% above price`}
            </div>
          )}
        </div>
      )}
      {resistance > 0 && (
        <div style={{ flex: 1, background: "var(--color-background-secondary)", borderRadius: 6, padding: "6px 10px", borderLeft: "2px solid #C0392B" }}>
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 2 }}>CE wall · resistance</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#C0392B" }}>
            ₹{resistance.toLocaleString("en-IN")}
          </div>
          {price > 0 && (
            <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
              {price < resistance
                ? `↑ ${((resistance - price) / price * 100).toFixed(1)}% above price`
                : `↓ ${((price - resistance) / price * 100).toFixed(1)}% below price`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CEPEDelta({ ceDelta, peDelta }: { ceDelta: number; peDelta: number }) {
  if (ceDelta === 0 && peDelta === 0) return null;

  const total = Math.abs(ceDelta) + Math.abs(peDelta);
  if (total === 0) return null;

  const cePct = Math.round((Math.abs(ceDelta) / total) * 100);
  const pePct = 100 - cePct;

  // Interpret: more PE adding = bearish conviction, more CE adding = bullish conviction
  // PE writers are selling puts = bullish; CE writers are selling calls = bearish
  // But net buyers: PE buyers = bearish, CE buyers = bullish
  // We track net OI change — positive = net new positions opening
  const peAdding = peDelta > 0;
  const ceAdding = ceDelta > 0;
  const dominant = Math.abs(peDelta) > Math.abs(ceDelta) ? "PE" : "CE";
  const bias = dominant === "PE"
    ? (peAdding ? "bearish" : "bearish covering")
    : (ceAdding ? "bullish" : "bullish covering");
  const biasColor = bias.includes("bearish") ? "#C0392B" : "#1D9E75";

  return (
    <div style={{ marginTop: 6, background: "var(--color-background-secondary)", borderRadius: 6, padding: "7px 10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>CE vs PE this scan</span>
        <span style={{ fontSize: 11, fontWeight: 500, color: biasColor }}>{bias}</span>
      </div>
      <div style={{ display: "flex", height: 6, borderRadius: 99, overflow: "hidden", gap: 1 }}>
        <div style={{ width: `${cePct}%`, background: "#1D9E75", borderRadius: "99px 0 0 99px", transition: "width 0.5s ease" }} title={`CE: ${ceDelta > 0 ? "+" : ""}${ceDelta}`} />
        <div style={{ width: `${pePct}%`, background: "#C0392B", borderRadius: "0 99px 99px 0", transition: "width 0.5s ease" }} title={`PE: ${peDelta > 0 ? "+" : ""}${peDelta}`} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
        <span style={{ fontSize: 11, color: "#1D9E75" }}>CE {ceDelta > 0 ? "+" : ""}{ceDelta} ({cePct}%)</span>
        <span style={{ fontSize: 11, color: "#C0392B" }}>PE {peDelta > 0 ? "+" : ""}{peDelta} ({pePct}%)</span>
      </div>
    </div>
  );
}

function TradeSignalBadge({ signal, icon, note, action }: {
  signal: string; icon: string; note: string; action: string;
}) {
  if (!signal || signal === "neutral" || !note) return null;

  type SignalStyle = { bg: string; labelColor: string; noteColor: string; actionColor: string; border: string; pillBg: string; pillColor: string };
  const styles: Record<string, SignalStyle> = {
    // Green — confirmed, reversal watch
    confirmed_move: { bg: "#F0FAF5", labelColor: "#085041", noteColor: "#0F6E56", actionColor: "#085041", border: "#5DCAA5", pillBg: "#1D9E75", pillColor: "#ffffff" },
    watch_reversal: { bg: "#F0FAF5", labelColor: "#085041", noteColor: "#0F6E56", actionColor: "#085041", border: "#5DCAA5", pillBg: "#1D9E75", pillColor: "#ffffff" },
    // Soft blue-grey — coiling, waiting
    coiling:        { bg: "#F1EFE8", labelColor: "#2C2C2A", noteColor: "#5F5E5A", actionColor: "#444441", border: "#B4B2A9", pillBg: "#888780", pillColor: "#ffffff" },
    // Warm amber — caution, fade
    likely_fade:    { bg: "#FFFBF2", labelColor: "#412402", noteColor: "#633806", actionColor: "#412402", border: "#EF9F27", pillBg: "#BA7517", pillColor: "#ffffff" },
    suspect_move:   { bg: "#FFFBF2", labelColor: "#412402", noteColor: "#633806", actionColor: "#412402", border: "#EF9F27", pillBg: "#BA7517", pillColor: "#ffffff" },
    // Neutral grey — mixed
    mixed:          { bg: "var(--color-background-secondary)", labelColor: "var(--color-text-primary)", noteColor: "var(--color-text-secondary)", actionColor: "var(--color-text-secondary)", border: "var(--color-border-secondary)", pillBg: "var(--color-background-tertiary)", pillColor: "var(--color-text-secondary)" },
    // Soft red — exhaustion
    exhaustion:     { bg: "#FFF5F5", labelColor: "#501313", noteColor: "#791F1F", actionColor: "#501313", border: "#F09595", pillBg: "#E24B4A", pillColor: "#ffffff" },
  };

  const s = styles[signal] || styles["mixed"];
  const label = signal.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase());

  // Parse note to extract strike pills
  // Handles formats:
  // 1. "CE writers capping rally at ₹8,900 · ₹9,100 — expect resistance"
  // 2. "OI building, price flat — CE resistance at ₹9,000 · ₹9,100 · PE support at ₹8,700"
  let mainNote = note;
  let strikeList: string[] = [];
  let suffix = "";

  // Format 1: single "at" with optional em-dash suffix
  const atIdx = note.indexOf(" at ");
  if (atIdx > -1) {
    // Check if this looks like a simple "X at ₹... — suffix" pattern
    const afterAt = note.slice(atIdx + 4);
    const dashIdx = afterAt.indexOf(" — ");

    if (dashIdx > -1) {
      // Has em-dash — classic format
      const rawStrikes = afterAt.slice(0, dashIdx);
      suffix = afterAt.slice(dashIdx + 3);
      // Only treat as strikes if they look like rupee amounts
      const candidates = rawStrikes.split(" · ").filter(s => s.trim().startsWith("₹"));
      if (candidates.length > 0) {
        mainNote = note.slice(0, atIdx);
        strikeList = candidates;
      }
    } else {
      // No em-dash — could be coiling format "CE resistance at ₹9,000 · ₹9,100 · PE support at ₹8,700"
      // Extract all ₹ amounts from the whole note
      const allStrikes = note.match(/₹[\d,]+/g) || [];
      if (allStrikes.length > 0) {
        // Main note = everything before first ₹, strip trailing "at" or whitespace
        const firstRupee = note.indexOf("₹");
        mainNote = note.slice(0, firstRupee).replace(/[\s·,—]+$/, "").replace(/\s+at\s*$/, "").trim();
        strikeList = allStrikes.slice(0, 4); // cap at 4 pills
      }
    }
  }

  return (
    <div style={{ background: s.bg, borderRadius: 8, padding: "10px 12px", marginTop: 8, borderLeft: `3px solid ${s.border}` }}>
      {/* Header row — icon + label + action pill */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
          <span style={{ fontSize: 13, fontWeight: 500, color: s.labelColor }}>{label}</span>
        </div>
        {action && (
          <span style={{ fontSize: 11, color: s.actionColor, background: "transparent", padding: "2px 0", fontWeight: 400, opacity: 0.8 }}>
            → {action}
          </span>
        )}
      </div>
      {/* Note text */}
      <div style={{ fontSize: 12, color: s.noteColor, marginBottom: strikeList.length ? 8 : 0, lineHeight: 1.5 }}>
        {mainNote}
      </div>
      {/* Strike level pills */}
      {strikeList.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: suffix ? 6 : 0 }}>
          {strikeList.map((strike, i) => (
            <span key={i} style={{
              fontSize: 11, fontWeight: 500, color: s.pillColor,
              background: s.pillBg, padding: "3px 10px",
              borderRadius: 99, letterSpacing: "0.02em",
            }}>
              {strike}
            </span>
          ))}
        </div>
      )}
      {/* Suffix text after strikes e.g. "— expect resistance" */}
      {suffix && (
        <div style={{ fontSize: 11, color: s.noteColor, opacity: 0.8 }}>{suffix}</div>
      )}
    </div>
  );
}

function RallyQualityBadge({ quality, note, ceBuying, peBuying, ceWriting, peWriting }:
  { quality: string; note: string; ceBuying: number; peBuying: number; ceWriting: number; peWriting: number }) {
  if (!quality || quality === "neutral" || !note) return null;

  const isGenuine = quality === "genuine";
  const bg    = isGenuine ? "#E1F5EE" : "#FAEEDA";
  const color = isGenuine ? "#085041" : "#633806";
  const icon  = isGenuine ? "✅" : "⚠";

  return (
    <div style={{ background: bg, borderRadius: 6, padding: "6px 10px", marginTop: 6 }}>
      <div style={{ fontSize: 12, color, marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
        <span>{icon}</span>
        <span style={{ fontWeight: 500 }}>{isGenuine ? "Genuine rally" : "Suspect rally"}</span>
        <span style={{ fontWeight: 400, opacity: 0.85 }}>— {note}</span>
      </div>
      <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--color-text-tertiary)" }}>
        {ceWriting > 0 && <span>CE writing: {ceWriting} strikes</span>}
        {peWriting > 0 && <span>PE writing: {peWriting} strikes</span>}
        {ceBuying > 0  && <span style={{ color: "#1D9E75" }}>CE buying: {ceBuying} strikes</span>}
        {peBuying > 0  && <span style={{ color: "#C0392B" }}>PE buying: {peBuying} strikes</span>}
      </div>
    </div>
  );
}

function ExpiryBadge({ expiryDate }: { expiryDate: string }) {
  if (!expiryDate) return null;

  const today    = new Date();
  const expiry   = new Date(expiryDate);
  const diffMs   = expiry.getTime() - today.getTime();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysLeft > 7) return null; // only show within 7 days

  const isExpiry  = daysLeft <= 0;
  const isUrgent  = daysLeft <= 2;
  const bg        = isExpiry ? "#FCEBEB" : isUrgent ? "#FAEEDA" : "#F1EFE8";
  const color     = isExpiry ? "#791F1F" : isUrgent ? "#633806" : "#5F5E5A";
  const label     = isExpiry
    ? "Expiry today — signals unreliable"
    : daysLeft === 1
    ? "Expiry tomorrow — high pinning risk"
    : `${daysLeft} days to expiry — signals may be noisy`;

  return (
    <div style={{ background: bg, borderRadius: 6, padding: "4px 10px", marginBottom: 8, fontSize: 11, color, display: "flex", alignItems: "center", gap: 5 }}>
      <span>⏳</span>
      <span>{label}</span>
    </div>
  );
}

function SignalCard({ signal }: { signal: Signal }) {
  const meta    = COMMODITY_META[signal.commodity] || { label: signal.commodity };
  const isFired = signal.status === "fired";
  const isWatch = signal.status === "watch";

  const cardStyle: React.CSSProperties = {
    background: "var(--color-background-primary)",
    border: isFired ? "2px solid #1D9E75" : isWatch ? "2px solid #BA7517" : "0.5px solid var(--color-border-tertiary)",
    borderRadius: 12, padding: "1rem 1.1rem", marginBottom: 10, transition: "border 0.3s ease",
  };

  const badgeStyle: React.CSSProperties = isFired
    ? { background: "#E1F5EE", color: "#085041" }
    : isWatch ? { background: "#FAEEDA", color: "#633806" }
    : { background: "var(--color-background-tertiary)", color: "var(--color-text-secondary)" };

  const badgeText = isFired
    ? `⚡ ignition fired${signal.direction ? ` — ${signal.direction}` : ""}`
    : isWatch ? `👀 ${signal.pillars_met}/3 — watch` : "quiet";

  const pillarBg: React.CSSProperties = { background: "var(--color-background-secondary)", borderRadius: 8, padding: "8px 10px" };

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div>
          <span style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)" }}>{meta.label}</span>
          <span style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginLeft: 8 }}>
            {signal.expiry_date} · ATM {signal.atm_strike?.toLocaleString("en-IN")}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>
            ₹{signal.current_price?.toLocaleString("en-IN")}
          </span>
          <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 99, fontWeight: 500, ...badgeStyle }}>{badgeText}</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 8 }}>
        <div style={pillarBg}>
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 3 }}>OI change (5min)</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", display: "flex", alignItems: "center" }}>
            <PillarDot passed={signal.oi_passed} />{signal.oi_change_pct > 0 ? "+" : ""}{signal.oi_change_pct?.toFixed(1)}%
          </div>
          <div style={{ fontSize: 11, color: signal.oi_passed ? "#1D9E75" : "var(--color-text-tertiary)" }}>threshold {signal.oi_threshold}%</div>
        </div>
        <div style={pillarBg}>
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 3 }}>Price breakout</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", display: "flex", alignItems: "center" }}>
            <PillarDot passed={signal.price_passed} />{signal.price_chg_pct > 0 ? "+" : ""}{signal.price_chg_pct?.toFixed(2)}%
          </div>
          <div style={{ fontSize: 11, color: signal.price_passed ? "#1D9E75" : "var(--color-text-tertiary)" }}>threshold {signal.price_threshold}%</div>
        </div>
        <div style={pillarBg}>
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 3 }}>Volume spike</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", display: "flex", alignItems: "center" }}>
            <PillarDot passed={signal.volume_passed} />{signal.volume_ratio?.toFixed(1)}x avg
          </div>
          <div style={{ fontSize: 11, color: signal.volume_passed ? "#1D9E75" : "var(--color-text-tertiary)" }}>threshold {signal.volume_threshold}x</div>
        </div>
      </div>

      <CumulativeBar
        pct={signal.cumulative_oi_pct || 0}
        direction={signal.cumulative_direction || "neutral"}
        futuresDirection={signal.futures_oi_direction || "neutral"}
      />
      <OvernightBadge direction={signal.overnight_oi_direction || "neutral"} />
      <SRLevels
        support={signal.support_strike || 0}
        resistance={signal.resistance_strike || 0}
        price={signal.current_price || 0}
      />
      <CEPEDelta
        ceDelta={signal.ce_oi_delta || 0}
        peDelta={signal.pe_oi_delta || 0}
      />
      <TradeSignalBadge
        signal={signal.trade_signal || "neutral"}
        icon={signal.trade_signal_icon || ""}
        note={signal.trade_signal_note || ""}
        action={signal.trade_signal_action || ""}
      />

      {(isFired || isWatch) && (
        <div style={{ borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 10, marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", margin: 0, flex: 1, lineHeight: 1.5 }}>{signal.scan_note}</p>
            <div style={{ width: 90, flexShrink: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 3 }}>
                <span>strength</span><span>{signal.signal_score}%</span>
              </div>
              <div style={{ height: 5, background: "var(--color-background-tertiary)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 99, width: `${signal.signal_score}%`, background: isFired ? "#1D9E75" : "#BA7517", transition: "width 0.5s ease" }} />
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
    return <div style={{ padding: "4rem 2rem", textAlign: "center", color: "var(--color-text-secondary)" }}><h2>404 — Page not found</h2></div>;
  }

  const [signals, setSignals]           = useState<Signal[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [lastUpdate, setLastUpdate]     = useState<Date | null>(null);
  const [countdown, setCountdown]       = useState(REFRESH_INTERVAL);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [alertsOn, setAlertsOn]         = useState(false);
  const [alertPermission, setAlertPermission] = useState<string>("default");

  // Use ref so interval always calls the latest version of fetch
  const fetchRef = useRef<(silent?: boolean) => Promise<void>>(() => Promise.resolve());

  fetchRef.current = async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const res = await fetch("/api/mcx/ignition");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSignals(data.signals || []);
      setLastUpdate(new Date());
      setError(null);
      setCountdown(REFRESH_INTERVAL);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Auto-refresh via ref — never stale, interval set once
  useEffect(() => {
    fetchRef.current?.();
    const interval = setInterval(() => {
      fetchRef.current?.(true);
    }, REFRESH_INTERVAL * 1000);
    return () => clearInterval(interval);
  }, []);

  // Countdown
  useEffect(() => {
    const tick = setInterval(() => setCountdown(c => c > 0 ? c - 1 : REFRESH_INTERVAL), 1000);
    return () => clearInterval(tick);
  }, []);

  // Refresh immediately when tab becomes visible again (after sleep/switch)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        fetchRef.current?.(true);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // Alert permission
  useEffect(() => {
    if ("Notification" in window) {
      setAlertPermission(Notification.permission);
      setAlertsOn(Notification.permission === "granted");
    }
  }, []);

  useAlerts(signals);

  function handleAlertToggle() {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      setAlertsOn(v => !v);
    } else {
      Notification.requestPermission().then(p => {
        setAlertPermission(p);
        setAlertsOn(p === "granted");
      });
    }
  }

  const firedCount  = signals.filter(s => s.status === "fired").length;
  const watchCount  = signals.filter(s => s.status === "watch").length;
  const progressPct = ((REFRESH_INTERVAL - countdown) / REFRESH_INTERVAL) * 100;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "1.5rem 1rem" }}>
      {/* MCX nav strip */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        <a href="/trend-ignition" style={{
          fontSize: 12, padding: "4px 12px", borderRadius: 8, textDecoration: "none",
          background: "#E1F5EE", color: "#085041", fontWeight: 500,
          border: "0.5px solid #1D9E75",
        }}>⚡ Trend ignition</a>
        <a href="/oi-map" style={{
          fontSize: 12, padding: "4px 12px", borderRadius: 8, textDecoration: "none",
          background: "transparent", color: "var(--color-text-secondary)",
          border: "0.5px solid var(--color-border-secondary)",
        }}>📊 OI map</a>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, color: "var(--color-text-primary)", display: "flex", alignItems: "center" }}>
            <LiveDot />Trend ignition
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-text-tertiary)", margin: "4px 0 0" }}>
            MCX · 5-min scan · next refresh in {countdown}s
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {firedCount > 0 && <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 99, background: "#E1F5EE", color: "#085041", fontWeight: 500 }}>⚡ {firedCount} fired</span>}
          {watchCount > 0 && <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 99, background: "#FAEEDA", color: "#633806", fontWeight: 500 }}>👀 {watchCount} watch</span>}
          <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>{lastUpdate ? timeAgo(lastUpdate.toISOString()) : "—"}</span>
          <button onClick={handleAlertToggle} style={{
            fontSize: 12, padding: "4px 10px", borderRadius: 8, cursor: "pointer",
            border: alertsOn ? "0.5px solid #1D9E75" : "0.5px solid var(--color-border-secondary)",
            background: alertsOn ? "#E1F5EE" : "transparent",
            color: alertsOn ? "#085041" : "var(--color-text-secondary)",
          }}>{alertsOn ? "🔔 alerts on" : "🔕 alerts off"}</button>
          <button onClick={() => fetchRef.current?.()} disabled={isRefreshing} style={{
            fontSize: 12, padding: "4px 12px", borderRadius: 8, cursor: "pointer",
            border: "0.5px solid var(--color-border-secondary)",
            background: "transparent", color: "var(--color-text-primary)",
            opacity: isRefreshing ? 0.5 : 1,
          }}>{isRefreshing ? "..." : "refresh"}</button>
        </div>
      </div>

      <div style={{ height: 2, background: "var(--color-background-secondary)", borderRadius: 99, marginBottom: 16, overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 99, width: `${progressPct}%`, background: "var(--color-border-info, #185FA5)", transition: "width 1s linear" }} />
      </div>

      {alertPermission === "denied" && (
        <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "8px 14px", marginBottom: 12, fontSize: 12, color: "var(--color-text-secondary)" }}>
          🔕 Browser notifications blocked — enable in browser settings to get alerts
        </div>
      )}

      <div style={{ background: "#FAEEDA", borderRadius: 8, padding: "8px 14px", marginBottom: 16, fontSize: 12, color: "#633806", display: "flex", alignItems: "center", gap: 8 }}>
        <span>⚠</span>
        <span>Work in progress — signals are live but thresholds are being calibrated. Do not trade solely on these signals.</span>
      </div>

      {loading && <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-text-secondary)", fontSize: 14 }}>Loading signals...</div>}
      {error && <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "12px 16px", color: "#A32D2D", fontSize: 13, marginBottom: 12 }}>Error: {error}</div>}
      {!loading && signals.map(signal => <SignalCard key={signal.commodity} signal={signal} />)}
      {!loading && signals.length === 0 && !error && (
        <div style={{ textAlign: "center", padding: "3rem", color: "var(--color-text-secondary)", fontSize: 14 }}>No signals yet — seed runs at 9:00 AM IST</div>
      )}

      <div style={{ marginTop: 20, fontSize: 11, color: "var(--color-text-tertiary)", textAlign: "center" }}>
        CommodityNova (WIP) · MCX data via Kite · Not investment advice
      </div>
    </div>
  );
}
