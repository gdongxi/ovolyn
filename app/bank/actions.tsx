"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * One action per balance card. Default amount, one press; the amount is there
 * for anyone who wants it, folded away so the common path stays a click.
 */

type Outcome = { text: string; ok: boolean } | null;

function useAction(endpoint: string, describe: (data: Record<string, unknown>) => string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);

  async function run(amountUsdc: number) {
    setBusy(true);
    setOutcome(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amountUsdc }),
      });
      const data = await res.json();
      const failed = !res.ok || data.outcome === "ERROR";
      setOutcome({ text: failed ? `Failed — ${data.reason ?? data.error}` : describe(data), ok: !failed });
    } catch (e) {
      setOutcome({ text: `Failed — ${String(e).slice(0, 120)}`, ok: false });
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  return { busy, outcome, run };
}

function Action({
  cta,
  busyLabel,
  note,
  defaultAmount,
  busy,
  outcome,
  run,
}: {
  cta: string;
  busyLabel: string;
  note: string;
  defaultAmount: number;
  busy: boolean;
  outcome: Outcome;
  run: (amount: number) => void;
}) {
  const [custom, setCustom] = useState(false);
  const [amount, setAmount] = useState(String(defaultAmount));

  return (
    <div className="cardaction">
      <button className="btn" disabled={busy} onClick={() => run(Number(amount))}>
        {busy ? busyLabel : `${cta} ${amount} USDC`}
      </button>
      {custom ? (
        <div className="tpanel-custom">
          <label>
            amount
            <input value={amount} onChange={(e) => setAmount(e.target.value)} disabled={busy} />
          </label>
          <button className="linkish" onClick={() => { setAmount(String(defaultAmount)); setCustom(false); }}>
            reset
          </button>
        </div>
      ) : (
        <div className="cardnote">
          {note} · <button className="linkish" onClick={() => setCustom(true)}>change amount</button>
        </div>
      )}
      {outcome && <div className={`spend-result ${outcome.ok ? "ok" : "blocked"}`}>{outcome.text}</div>}
    </div>
  );
}

export function DepositPanel() {
  const { busy, outcome, run } = useAction("/api/deposit/cctp", (d) => `Arrived · ${String(d.mintTx).slice(0, 12)}…`);
  return (
    <Action
      cta="Deposit"
      busyLabel="Bridging… 1–3 min"
      note="From Sepolia via CCTP"
      defaultAmount={2}
      busy={busy}
      outcome={outcome}
      run={run}
    />
  );
}

export function GatewayPanel() {
  const { busy, outcome, run } = useAction("/api/treasury/gateway", () => "Topped up");
  return (
    <Action
      cta="Top up"
      busyLabel="Depositing…"
      note="Wallet into Gateway · drains as the agent pays"
      defaultAmount={1}
      busy={busy}
      outcome={outcome}
      run={run}
    />
  );
}

export function SweepPanel() {
  const { busy, outcome, run } = useAction("/api/treasury/sweep", (d) => `Minted ${d.mintedUsyc} USYC`);
  return (
    <Action
      cta="Sweep"
      busyLabel="Sweeping…"
      note="Idle USDC into treasury yield"
      defaultAmount={2}
      busy={busy}
      outcome={outcome}
      run={run}
    />
  );
}

export function FxPanel() {
  const { busy, outcome, run } = useAction("/api/treasury/swap", (d) => `${d.amountIn} → ${d.amountOut} EURC`);
  return (
    <Action
      cta="Swap"
      busyLabel="Swapping…"
      note="Arc-only Swap · testnet pool rate"
      defaultAmount={2}
      busy={busy}
      outcome={outcome}
      run={run}
    />
  );
}
