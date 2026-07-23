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

export function DepositButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<string | null>(null);

  async function deposit() {
    setBusy(true);
    setLast(null);
    try {
      const res = await fetch("/api/deposit/cctp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amountUsdc: 1 }),
      });
      const data = await res.json();
      setLast(
        data.outcome === "DEPOSITED"
          ? `✓ deposited — mint ${String(data.mintTx).slice(0, 10)}…`
          : `error — ${data.reason}`,
      );
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  return (
    <>
      <button className="btn btn-outline" onClick={deposit} disabled={busy} style={{ marginTop: 10 }}>
        {busy ? "Bridging… (~1-3 min)" : "Deposit 1 USDC from Sepolia · CCTP"}
      </button>
      {last && <div className={`spend-result ${last.startsWith("✓") ? "ok" : "blocked"}`}>{last}</div>}
    </>
  );
}

export function SweepButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<string | null>(null);

  async function sweep() {
    setBusy(true);
    setLast(null);
    try {
      const res = await fetch("/api/treasury/sweep", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amountUsdc: 3 }),
      });
      const data = await res.json();
      setLast(
        data.outcome === "SWEPT"
          ? `✓ swept 3 USDC → minted ${data.mintedUsyc} USYC`
          : `error — ${data.reason}`,
      );
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  return (
    <>
      <button className="btn btn-outline" onClick={sweep} disabled={busy} style={{ marginTop: 10 }}>
        {busy ? "Sweeping… (~1 min)" : "Sweep 3 USDC idle → USYC"}
      </button>
      {last && <div className={`spend-result ${last.startsWith("✓") ? "ok" : "blocked"}`}>{last}</div>}
    </>
  );
}

export function FxCard({ eurc, usdcFloat }: { eurc: string; usdcFloat: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<string | null>(null);

  async function swap() {
    setBusy(true);
    setLast(null);
    try {
      const res = await fetch("/api/treasury/swap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amountUsdc: 2 }),
      });
      const data = await res.json();
      setLast(
        data.outcome === "SWAPPED"
          ? `✓ swapped ${data.amountIn} USDC → ${data.amountOut} EURC`
          : `error — ${data.reason}`,
      );
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  return (
    <div className="card">
      <div className="label">FX · Treasury Rebalance</div>
      <div className="policy-row"><span>EURC</span><span className="mono-sm">{eurc}</span></div>
      <div className="policy-row"><span>USDC float</span><span className="mono-sm">{usdcFloat}</span></div>
      <button className="btn btn-outline" onClick={swap} disabled={busy}>
        {busy ? "Swapping…" : "Rebalance 2 USDC → EURC"}
      </button>
      <div className="mono-sm" style={{ marginTop: 10 }}>Swap · Arc Testnet exclusive</div>
      {last && <div className={`spend-result ${last.startsWith("✓") ? "ok" : "blocked"}`}>{last}</div>}
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
