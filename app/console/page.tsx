import Link from "next/link";
import { AGENT_WALLET, walletUsdc, gatewayUsdc } from "@/lib/arc";
import { treasuryBalances } from "@/lib/treasury";
import { getLedger, spentTodayUsdc } from "@/lib/store";
import { readRun } from "@/lib/runbook";
import { RunPanel } from "@/app/runpanel";
import { PageHead } from "@/app/pagehead";

export const dynamic = "force-dynamic";

/** Balances arrive as strings and become "—" when an upstream read fails. */
function fmt(value: string, digits = 2): string {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
}

export default async function Console() {
  const [wallet, gateway, treasury] = await Promise.all([
    walletUsdc(),
    gatewayUsdc(),
    treasuryBalances(),
  ]);
  const recent = getLedger().slice(0, 6);
  const spent = spentTodayUsdc();

  return (
    <>
      <PageHead
        title="Console"
        lede="The position at a glance — and the whole bank in one sequence."
      />

      <RunPanel initial={readRun()} />

      <div className="grid">
        <div className="card">
          <div className="label">Spending wallet</div>
          <div className="value">{fmt(wallet)}</div>
          <div className="sub">USDC · {AGENT_WALLET.slice(0, 16)}…</div>
        </div>
        <div className="card">
          <div className="label">Gateway</div>
          <div className="value">{fmt(gateway, 4)}</div>
          <div className="sub">reserved for x402 · spent today ${spent.toFixed(6)}</div>
        </div>
        <div className="card">
          <div className="label">Yield sleeve</div>
          <div className="value">{fmt(treasury.usyc, 4)}</div>
          <div className="sub">
            USYC · float {fmt(treasury.usdc)} USDC · EURC {fmt(treasury.eurc, 2)}
          </div>
        </div>
      </div>

      <div className="section-title">Latest activity</div>
      <table className="ledger">
        <thead>
          <tr>
            <th>Time (UTC)</th>
            <th>Type</th>
            <th>Detail</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {recent.length === 0 && (
            <tr>
              <td colSpan={5} className="ledger-empty">
                Nothing recorded yet. Run the sequence above.
              </td>
            </tr>
          )}
          {recent.map((e, i) => (
            <tr key={i}>
              <td>{e.ts.slice(0, 16).replace("T", " ")}</td>
              <td>{e.type}</td>
              <td>
                {e.detail}
                {e.reason ? ` — ${e.reason}` : ""}
              </td>
              <td>{e.amount}</td>
              <td className={e.status === "BLOCKED" || e.status === "FAILED" ? "blocked" : "ok"}>
                {e.status}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Link className="linkish" href="/ledger">
        Every entry, with filters and transaction links →
      </Link>
    </>
  );
}
