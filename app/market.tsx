"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Listing } from "@/lib/registry";

function tierLabel(l: Listing): string {
  if (l.probe && !l.probe.passed) return "unverified";
  return `tier ${l.tier} · listed`;
}

export function MarketCard({ listings }: { listings: Listing[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function reprobe() {
    setBusy(true);
    try {
      await fetch("/api/registry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "probe" }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card market">
      <div className="label">Market · open registry</div>
      <div className="mono-sm" style={{ marginBottom: 12 }}>
        Anyone may list; the probe decides the tier, not a reviewer.
      </div>
      <table className="listings">
        <tbody>
          {listings.map((l) => (
            <tr key={l.id}>
              <td>
                <div className="lname">
                  {l.name}
                  {l.firstParty && <span className="badge">first-party</span>}
                </div>
                <div className="lmeta">
                  {l.provider} · {tierLabel(l)}
                  {l.probe?.passed && <span className="probe-ok"> ✓ probe</span>}
                  {l.probe && !l.probe.passed && <span className="probe-bad"> ✕ {l.probe.note?.slice(0, 40)}</span>}
                </div>
              </td>
              <td className="lprice">${l.priceUsdc.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn btn-outline" onClick={reprobe} disabled={busy}>
        {busy ? "Probing…" : "Re-probe listings"}
      </button>
    </div>
  );
}
