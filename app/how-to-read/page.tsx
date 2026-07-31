"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function HowToReadPage() {
  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = "/login?returnTo=" + window.location.pathname;
      } else {
        setAuthChecked(true);
      }
    }
    checkAuth();
  }, []);

  const [authChecked, setAuthChecked] = useState(false)
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (id: string) => setOpen(open === id ? null : id);

  const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
    <div style={{ borderBottom: "1px solid var(--color-border-secondary)", marginBottom: 0 }}>
      <button onClick={() => toggle(id)} style={{ width: "100%", textAlign: "left", padding: "16px 0", background: "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)" }}>{title}</span>
        <span style={{ fontSize: 18, color: "var(--color-text-tertiary)" }}>{open === id ? "−" : "+"}</span>
      </button>
      {open === id && (
        <div style={{ paddingBottom: 20, color: "var(--color-text-secondary)", fontSize: 13, lineHeight: 1.7 }}>
          {children}
        </div>
      )}
    </div>
  );

  const Tag = ({ label, color }: { label: string; color: string }) => (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, background: color + "22", border: `1px solid ${color}`, color, fontSize: 11, fontWeight: 600, marginRight: 6, marginBottom: 4 }}>{label}</span>
  );

  const Example = ({ children }: { children: React.ReactNode }) => (
    <div style={{ background: "var(--color-background-secondary)", border: "1px solid var(--color-border-secondary)", borderRadius: 8, padding: "12px 14px", margin: "12px 0", fontSize: 12, lineHeight: 1.8 }}>{children}</div>
  );

  if (!authChecked) return null

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px" }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <a href="/trend-ignition" style={{ fontSize: 12, color: "var(--color-text-tertiary)", textDecoration: "none" }}>⚡ Trend ignition</a>
          <span style={{ color: "var(--color-text-tertiary)" }}>·</span>
          <a href="/oi-map" style={{ fontSize: 12, color: "var(--color-text-tertiary)", textDecoration: "none" }}>📊 OI map</a>
          <span style={{ color: "var(--color-text-tertiary)" }}>·</span>
          <span style={{ fontSize: 12, color: "var(--color-text-primary)" }}>📖 How to read</span>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, marginBottom: 8 }}>How to read CommodityNova</h1>
        <p style={{ margin: 0, color: "var(--color-text-secondary)", fontSize: 13 }}>A plain-language guide to understanding OI signals on MCX commodities.</p>
      </div>

      <div style={{ background: "rgba(202,138,4,0.08)", border: "1px solid rgba(202,138,4,0.3)", borderRadius: 8, padding: "12px 14px", marginBottom: 28, fontSize: 12, color: "#CA8A04" }}>
        ⚠️ All data on this platform is observational OI activity only. Not investment advice. Not SEBI registered. Always apply your own judgement before trading.
      </div>

      <Section id="what" title="What is Open Interest (OI)?">
        <p>Open Interest is the total number of outstanding option contracts that have not been settled.</p>
        <p>When OI <strong>increases</strong> at a strike — new positions are being created. Someone is buying or writing options there.</p>
        <p>When OI <strong>decreases</strong> — existing positions are being closed. Someone is exiting.</p>
        <p>OI alone does not tell you direction. But combined with which side (CE or PE) and price movement, it reveals what smart money is doing.</p>
      </Section>

      <Section id="pillars" title="The three pillars — OI, Price, Volume">
        <p>Each commodity card shows three conditions:</p>
        <div style={{ margin: "12px 0" }}>
          <div style={{ marginBottom: 8 }}><Tag label="OI change" color="#1D9E75" /> 5-min OI change vs threshold. New positions being created this scan.</div>
          <div style={{ marginBottom: 8 }}><Tag label="Price breakout" color="#1D9E75" /> Price moving beyond recent range — momentum building.</div>
          <div style={{ marginBottom: 8 }}><Tag label="Volume spike" color="#1D9E75" /> Volume vs session average — real activity vs noise.</div>
        </div>
        <p><strong>All three firing</strong> = Ignition signal — highest conviction.</p>
        <p><strong>2/3 firing</strong> = Watch — monitor closely.</p>
        <p><strong>0-1 firing</strong> = Quiet — no actionable signal.</p>
      </Section>

      <Section id="signals" title="Trade signals explained">
        <div style={{ marginBottom: 8 }}><Tag label="✅ Confirmed move" color="#1D9E75" /><p style={{ margin: "4px 0" }}>OI building + price moving together. New positions supporting the move. Highest quality signal.</p></div>
        <div style={{ marginBottom: 8 }}><Tag label="◎ Coiling" color="#888" /><p style={{ margin: "4px 0" }}>OI building but price flat. Energy compressing — breakout coming but direction unclear. Wait for price to choose a side.</p></div>
        <div style={{ marginBottom: 8 }}><Tag label="🔴 Exhaustion" color="#E24B4A" /><p style={{ margin: "4px 0" }}>OI peaked earlier and is now unwinding. The move that was building is likely done. Avoid new entries in the direction of the move.</p></div>
        <div style={{ marginBottom: 8 }}><Tag label="⚠ Likely fade" color="#CA8A04" /><p style={{ margin: "4px 0" }}>Price moving but OI not confirming. Move lacks conviction — likely to reverse.</p></div>
        <div style={{ marginBottom: 8 }}><Tag label="↔ Mixed" color="#888" /><p style={{ margin: "4px 0" }}>Both CE and PE writers active. Market undecided — no directional edge.</p></div>
      </Section>

      <Section id="stealth" title="OI Activity badge — Stealth buildup">
        <p>Tracks session-cumulative OI buildup — how much total OI has grown since market open.</p>
        <div style={{ margin: "12px 0" }}>
          <div style={{ marginBottom: 8 }}><Tag label="🔴 Elite OI Buildup" color="#DC2626" /> Cumulative OI +30% or more since open. Maximum conviction buildup.</div>
          <div style={{ marginBottom: 8 }}><Tag label="🟠 Strong OI Buildup" color="#EA580C" /> Cumulative OI +20% or more. Significant positioning underway.</div>
          <div style={{ marginBottom: 8 }}><Tag label="🟡 OI Watch" color="#CA8A04" /> Cumulative OI +8% or more. Early accumulation — watch for confirmation.</div>
        </div>
        <p><strong>⚡ COILING</strong> — appears when cumulative OI is high but the hourly rate is slowing. OI is loaded but additions are tapering. Like a compressed spring — energy stored, release imminent.</p>
        <p style={{ marginTop: 12 }}><strong>Writer activity:</strong></p>
        <ul style={{ paddingLeft: 20 }}>
          <li>CE side active = call writers adding = bears loading resistance above price</li>
          <li>PE side active = put writers adding = bulls loading support below price</li>
          <li>Mixed = both sides active = market undecided</li>
        </ul>
      </Section>

      <Section id="atm" title="ATM Zone OI change">
        <p>Shows which strikes near current price are seeing OI reduce (positions being closed).</p>
        <p><strong>CE OI reducing</strong> = bears who wrote calls above price are buying back = resistance weakening = bullish lean</p>
        <p><strong>PE OI reducing</strong> = bulls who wrote puts below price are exiting = floor weakening = bearish lean</p>
        <Example>
          <strong>Example — NatGas ₹280:</strong><br />
          CE OI reducing at ₹290 (−68 lots) = bears abandoning ₹290 resistance<br />
          PE OI reducing at ₹270 (−45 lots) = bulls exiting ₹270 floor<br /><br />
          CE exits (68) more than PE exits (45) → <strong>Bullish lean</strong><br />
          Price likely to push toward ₹290 as resistance weakens.
        </Example>
      </Section>

      <Section id="conflict" title="Common confusion — Exhaustion + OI Watch together">
        <p>You will often see Exhaustion and OI Watch on the same card. They are NOT contradictory — they measure different timeframes:</p>
        <ul style={{ paddingLeft: 20 }}>
          <li><strong>Exhaustion</strong> = this specific 5-min scan saw OI drop or price moved without new OI</li>
          <li><strong>OI Watch/Strong/Elite</strong> = cumulative OI since session open is still positive</li>
        </ul>
        <Example>
          <strong>Real example — CrudeOil ₹8,084:</strong><br /><br />
          🔴 Exhaustion: "OI unwinding after large buildup — move likely done"<br />
          🟡 OI Watch: Session OI +16.9%, 22 consecutive scans<br /><br />
          <strong>What actually happened:</strong><br />
          Session built +16.9% OI as price moved from ₹7,900 → ₹8,084<br />
          Price broke above ₹8,000 resistance ✅<br />
          Bulls who wrote puts at ₹8,000 are now exiting — mission accomplished<br />
          No new OI being added at ₹8,084 (0.0% this scan)<br /><br />
          <strong>Read:</strong> The move happened. OI that built the move is unwinding as players take profits.
          Price moving on existing momentum, not fresh conviction.
          Watch if CE writers at ₹8,200 start covering — that signals the next leg up.
        </Example>
      </Section>

      <Section id="oiMap" title="OI Map — how to read the chart">
        <p>Strike-level OI distribution for each commodity.</p>
        <ul style={{ paddingLeft: 20 }}>
          <li><strong>Green bars (PE)</strong> = put writers defending support below price</li>
          <li><strong>Red bars (CE)</strong> = call writers capping resistance above price</li>
          <li><strong>Diagonal stripes</strong> = OI being added this scan</li>
          <li><strong>Hollow dashed outline</strong> = OI being removed (covering)</li>
          <li><strong>▲ marker</strong> = current price level</li>
        </ul>
        <p>Tallest green bar = strongest support. Tallest red bar = strongest resistance. When a bar shifts from solid to hollow — that side is losing conviction at that strike.</p>
      </Section>

      <Section id="exits" title="Session Exit Summary — spotting divergence">
        <p>The ATM Zone shows only the <strong>latest scan</strong>. The Session Exit Summary on the OI Map page shows <strong>cumulative exits for the entire day</strong> — this persists even if a strike's exit activity happened hours ago.</p>
        <p>This matters because a single scan can hide the bigger picture. If bulls have been quietly exiting all session while price holds up, that is a real warning sign the current move lacks fresh conviction.</p>
        <div style={{ margin: "12px 0" }}>
          <div style={{ marginBottom: 8 }}><Tag label="PE exited" color="#1D9E75" /> Total put-writer exits today = bulls closing floor positions.</div>
          <div style={{ marginBottom: 8 }}><Tag label="CE exited" color="#E24B4A" /> Total call-writer exits today = bears closing ceiling positions.</div>
        </div>
        <p><strong>Divergence flag</strong> appears when one side has exited significantly more than the other (1.5x or more, minimum 50 lots):</p>
        <ul style={{ paddingLeft: 20 }}>
          <li><strong>PE heavy</strong> = bulls have been exiting more than bears. Caution if price is rallying — the move may be running without fresh buyer conviction.</li>
          <li><strong>CE heavy</strong> = bears have been exiting more than bulls. Caution if price is falling — the move may be running without fresh seller conviction.</li>
        </ul>
        <Example>
          <strong>How to use it:</strong><br />
          Price is rallying, but the Session Exit Summary shows PE exits far exceed CE exits.<br />
          This means the existing put writers (bulls who bet the floor would hold) are taking profit and leaving —
          not fresh buyers stepping in.<br /><br />
          A rally built mostly on exiting shorts/covering rather than fresh long conviction is more likely to fade.
          Worth watching for a reversal setup rather than chasing the move.
        </Example>
      </Section>

      <Section id="limitations" title="Limitations to keep in mind">
        <ul style={{ paddingLeft: 20 }}>
          <li>MCX options are less liquid than NSE. Small OI moves can look significant on thin contracts.</li>
          <li>Data updates every 5 minutes — not tick-by-tick.</li>
          <li>Gold often shows +200-300% session OI because it opens with very few lots — percentage looks dramatic but absolute change is small. Check Open OI number.</li>
          <li>OI signals work best on NatGas and CrudeOil — most liquid MCX contracts.</li>
          <li>Always combine OI signals with price action and your own analysis.</li>
        </ul>
      </Section>

      <div style={{ marginTop: 40, padding: "16px", textAlign: "center", background: "var(--color-background-secondary)", borderRadius: 8, fontSize: 12, color: "var(--color-text-tertiary)" }}>
        CommodityNova (Beta) · MCX data via Kite API · Not investment advice · Not SEBI registered
      </div>
    </div>
  );
}
