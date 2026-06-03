"use client";

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

function OIMapChart({ strikes, currentPrice }: { strikes: StrikeRow[]; currentPrice: number }) {
  if (!strikes.length) return (
    <div style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-tertiary)", fontSize: 13 }}>
      No strike data yet — run seed first
    </div>
  );

  const maxOI = Math.max(...strikes.flatMap(s => [s.ce_oi, s.pe_oi]), 1);

  return (
    <div>
      {/* Header labels */}
      <div style={{ display: "flex", fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 6 }}>
        <div style={{ width: 72, flexShrink: 0 }} />
        <div style={{ flex: 1, textAlign: "right", paddingRight: 8 }}>PE OI · support</div>
        <div style={{ width: 1, background: "var(--color-border-secondary)", flexShrink: 0 }} />
        <div style={{ flex: 1, paddingLeft: 8 }}>CE OI · resistance</div>
      </div>

      {strikes.map((row) => {
        // Use half the typical strike step for proximity detection
        const strikeStep = strikes.length > 1
          ? Math.abs(strikes[0].strike - strikes[1].strike)
          : 100;
        const isPrice = currentPrice > 0 && Math.abs(row.strike - currentPrice) < strikeStep * 0.6;
        const isSupport = row.pe_oi > row.ce_oi * 1.5 && row.strike < currentPrice;
        const isResist  = row.ce_oi > row.pe_oi * 1.5 && row.strike > currentPrice;

        const peWidth  = Math.round((row.pe_oi / maxOI) * 100);
        const ceWidth  = Math.round((row.ce_oi / maxOI) * 100);

        const peDelta = row.pe_delta > 0 ? `+${row.pe_delta}` : row.pe_delta < 0 ? `${row.pe_delta}` : "";
        const ceDelta = row.ce_delta > 0 ? `+${row.ce_delta}` : row.ce_delta < 0 ? `${row.ce_delta}` : "";
        const peOILabel = row.pe_oi >= 1000 ? `${(row.pe_oi/1000).toFixed(1)}K` : `${row.pe_oi}`;
        const ceOILabel = row.ce_oi >= 1000 ? `${(row.ce_oi/1000).toFixed(1)}K` : `${row.ce_oi}`;

        const rowBg = isPrice ? "var(--color-background-secondary)" : "transparent";
        const strikeColor = isSupport ? "#085041" : isResist ? "#791F1F" : "var(--color-text-tertiary)";
        const barH = isSupport || isResist ? 16 : 13;

        return (
          <div key={row.strike} style={{ display: "flex", alignItems: "center", marginBottom: 3, background: rowBg, borderRadius: 4, padding: "1px 0" }}>
            {/* Strike label */}
            <div style={{ width: 72, flexShrink: 0, textAlign: "right", paddingRight: 8 }}>
              <div style={{ fontSize: 11, fontWeight: isSupport || isResist ? 500 : 400, color: strikeColor }}>
                {row.strike.toLocaleString("en-IN")}
                {isPrice && <span style={{ color: "#1D9E75", marginLeft: 3 }}>◀</span>}
              </div>
              {(isSupport || isResist) && (
                <div style={{ fontSize: 10, color: isSupport ? "#1D9E75" : "#A32D2D", opacity: 0.8 }}>
                  {isSupport ? peOILabel : ceOILabel}
                </div>
              )}
            </div>

            {/* PE bar — grows left */}
            <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 3 }}>
              {Math.abs(row.pe_delta) > 10 && (
                <span style={{ fontSize: 10, color: row.pe_delta > 0 ? "#1D9E75" : "#E24B4A", opacity: 0.8 }}>{peDelta}</span>
              )}
              <div style={{ height: barH, background: isSupport ? "#1D9E75" : "#E1F5EE", width: `${peWidth}%`, borderRadius: "2px 0 0 2px", minWidth: peWidth > 0 ? 2 : 0 }} />
            </div>

            {/* Center divider */}
            <div style={{ width: 1, flexShrink: 0, background: "var(--color-border-secondary)", height: barH }} />

            {/* CE bar — grows right */}
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 3 }}>
              <div style={{ height: barH, background: isResist ? "#E24B4A" : "#FCEBEB", width: `${ceWidth}%`, borderRadius: "0 2px 2px 0", minWidth: ceWidth > 0 ? 2 : 0 }} />
              {Math.abs(row.ce_delta) > 10 && (
                <span style={{ fontSize: 10, color: row.ce_delta > 0 ? "#1D9E75" : "#E24B4A", opacity: 0.8 }}>{ceDelta}</span>
              )}
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, background: "#1D9E75", borderRadius: 2, display: "inline-block" }} />
          <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>PE dominant — support</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, background: "#E24B4A", borderRadius: 2, display: "inline-block" }} />
          <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>CE dominant — resistance</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>delta = OI change this scan</span>
        </div>
      </div>
    </div>
  );
}

export default function OIMapPage() {
  if (!MCX_ENABLED) {
    return <div style={{ padding: "4rem 2rem", textAlign: "center", color: "var(--color-text-secondary)" }}><h2>404 — Page not found</h2></div>;
  }

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

  // Refresh immediately when tab becomes visible again (after sleep/switch)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        fetchRef.current?.();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

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
          </div>

          {/* OI Accumulation bars — only show when data exists */}
          {data.oi_history.length > 0 && (
            <div style={{ background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "1rem 1.1rem" }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 10 }}>
                Session OI accumulation
                <span style={{ fontSize: 11, fontWeight: 400, color: "var(--color-text-tertiary)", marginLeft: 8 }}>each bar = 5-min scan</span>
              </div>
              <AccumulationBars history={data.oi_history} commodity={selected} />
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
