"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Treasury actions. Each runs at a sensible default with one click; the
 * amount is there for anyone who wants it, folded away so the common path
 * stays a single press.
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
      setOutcome({ text: `Failed — ${String(e).slice(0, 140)}`, ok: false });
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  return { busy, outcome, run };
}

function Panel({
  title,
  lede,
  note,
  defaultAmount,
  unit,
  action,
  busy,
  outcome,
  busyLabel,
  cta,
}: {
  title: string;
  lede: string;
  note: string;
  defaultAmount: number;
  unit: string;
  action: (amount: number) => void;
  busy: boolean;
  outcome: Outcome;
  busyLabel: string;
  cta: string;
}) {
  const [custom, setCustom] = useState(false);
  const [amount, setAmount] = useState(String(defaultAmount));

  return (
    <section className="tpanel">
      <div className="tpanel-copy">
        <h2 className="display">{title}</h2>
        <p>{lede}</p>
        <div className="mono-sm">{note}</div>
      </div>
      <div className="tpanel-act">
        <button className="btn" disabled={busy} onClick={() => action(Number(amount))}>
          {busy ? busyLabel : `${cta} · ${amount} ${unit}`}
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
          <button className="linkish" onClick={() => setCustom(true)}>
            choose a different amount
          </button>
        )}
        {outcome && <div className={`spend-result ${outcome.ok ? "ok" : "blocked"}`}>{outcome.text}</div>}
      </div>
    </section>
  );
}

export function DepositPanel() {
  const { busy, outcome, run } = useAction("/api/deposit/cctp", (d) =>
    `Arrived — mint ${String(d.mintTx).slice(0, 14)}…`,
  );
  return (
    <Panel
      title="Deposit"
      lede="USDC burned on Ethereum Sepolia, attested by Circle, minted on Arc into the spending wallet. The Arc-side mint is paid for in USDC — there is no native gas token to hold anywhere in this flow."
      note="CCTP V2 · fast finality · Sepolia (domain 0) → Arc (domain 26)"
      defaultAmount={2}
      unit="USDC"
      cta="Deposit"
      busyLabel="Bridging… (1–3 min)"
      action={run}
      busy={busy}
      outcome={outcome}
    />
  );
}

export function SweepPanel({ idleThresholdUsdc, walletUsdc }: { idleThresholdUsdc: number; walletUsdc: string }) {
  const { busy, outcome, run } = useAction("/api/treasury/sweep", (d) =>
    `Swept — minted ${d.mintedUsyc} USYC`,
  );
  return (
    <Panel
      title="Earn"
      lede="Anything above the idle threshold is subscribed into USYC, a tokenized treasury. The agent's war chest earns while it waits to be spent, and the threshold keeps enough USDC liquid for a week of payments."
      note={`Idle threshold $${idleThresholdUsdc} · wallet holds ${walletUsdc} USDC · Teller 0x9fdF…105A`}
      defaultAmount={2}
      unit="USDC"
      cta="Sweep"
      busyLabel="Sweeping…"
      action={run}
      busy={busy}
      outcome={outcome}
    />
  );
}

export function FxPanel({ eurc, usdcFloat }: { eurc: string; usdcFloat: string }) {
  const { busy, outcome, run } = useAction("/api/treasury/swap", (d) =>
    `Swapped — ${d.amountIn} USDC → ${d.amountOut} EURC`,
  );
  return (
    <Panel
      title="Rebalance"
      lede="Hold more than one currency. Swap is the only Circle capability that exists on no testnet but Arc, so a euro-denominated agent treasury can only be demonstrated here."
      note={`EURC ${eurc} · USDC float ${usdcFloat} · testnet pool rate, not market`}
      defaultAmount={2}
      unit="USDC"
      cta="Swap"
      busyLabel="Swapping…"
      action={run}
      busy={busy}
      outcome={outcome}
    />
  );
}
