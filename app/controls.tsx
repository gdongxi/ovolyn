"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Policy } from "@/lib/store";

export function PolicyCard({ policy }: { policy: Policy }) {
  const router = useRouter();
  const [perTx, setPerTx] = useState(String(policy.perTxLimitUsdc));
  const [budget, setBudget] = useState(String(policy.dailyBudgetUsdc));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch("/api/policy", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ perTxLimitUsdc: Number(perTx), dailyBudgetUsdc: Number(budget) }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="card">
      <div className="label">Policy · set by human CFO</div>
      <div className="policy-row">
        <span>Per-tx limit</span>
        <span className="policy-input">$<input value={perTx} onChange={(e) => setPerTx(e.target.value)} /></span>
      </div>
      <div className="policy-row">
        <span>Daily budget</span>
        <span className="policy-input">$<input value={budget} onChange={(e) => setBudget(e.target.value)} /></span>
      </div>
      <div className="policy-row">
        <span>Allowlist</span>
        <span className="mono-sm">{policy.allowlist.join(", ")}</span>
      </div>
      <button className="btn" onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save policy"}
      </button>
    </div>
  );
}

const STALL = "http://localhost:4021";

export function AgentActions() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);

  async function spend(path: string, label: string) {
    setBusy(path);
    setLast(null);
    try {
      const res = await fetch("/api/agent/spend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: `${STALL}${path}`, label }),
      });
      const data = await res.json();
      setLast(
        data.outcome === "SETTLED"
          ? `✓ settled — paid $${data.priceUsdc} for ${label}`
          : data.outcome === "BLOCKED"
            ? `✕ blocked — ${data.reason}`
            : `error — ${data.reason}`,
      );
    } finally {
      setBusy(null);
      router.refresh();
    }
  }

  return (
    <div className="card">
      <div className="label">Agent · autonomous spend</div>
      <button className="btn" disabled={busy !== null} onClick={() => spend("/oracle", "market insight ($0.001)")}>
        {busy === "/oracle" ? "Paying…" : "Buy market insight · $0.001"}
      </button>
      <button className="btn btn-outline" disabled={busy !== null} onClick={() => spend("/deep-analysis", "deep analysis ($0.05)")}>
        {busy === "/deep-analysis" ? "Trying…" : "Buy deep analysis · $0.05"}
      </button>
      {last && <div className={`spend-result ${last.startsWith("✓") ? "ok" : "blocked"}`}>{last}</div>}
    </div>
  );
}
