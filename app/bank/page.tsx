import Link from "next/link";
import { AGENT_WALLET, walletUsdc, gatewayUsdc } from "@/lib/arc";
import { treasuryBalances } from "@/lib/treasury";
import { getLedger, getPolicy, spentTodayUsdc } from "@/lib/store";
import { readRun } from "@/lib/runbook";
import { RunPanel } from "@/app/runpanel";
import { PageHead } from "@/app/pagehead";
import { DepositPanel, SweepPanel, FxPanel } from "./actions";

export const dynamic = "force-dynamic";

/** Balances arrive as strings and become "—" when an upstream read fails. */
function fmt(value: string, digits = 2): string {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
}

export default async function Bank() {
  const [wallet, gateway, treasury] = await Promise.all([
    walletUsdc(),
    gatewayUsdc(),
    treasuryBalances(),
  ]);
  const policy = getPolicy();
  const recent = getLedger().slice(0, 5);

  return (
    <>
      <PageHead title="Bank" lede="Balances, and the four flows that move them." />

      <RunPanel initial={readRun()} />

      <div className="grid balances">
        <div className="card">
          <div className="label">Spending wallet</div>
          <div className="value">{fmt(wallet)}</div>
          <div className="sub">USDC · {AGENT_WALLET.slice(0, 16)}…</div>
          <DepositPanel />
        </div>
        <div className="card">
          <div className="label">Gateway</div>
          <div className="value">{fmt(gateway, 4)}</div>
          <div className="sub">x402 · spent today ${spentTodayUsdc().toFixed(6)}</div>
        </div>
        <div className="card">
          <div className="label">Yield sleeve</div>
          <div className="value">{fmt(treasury.usyc, 4)}</div>
          <div className="sub">USYC · idle threshold ${policy.idleThresholdUsdc}</div>
          <SweepPanel />
        </div>
        <div className="card">
          <div className="label">Currencies</div>
          <div className="value">{fmt(treasury.eurc, 2)}</div>
          <div className="sub">EURC · float {fmt(treasury.usdc)} USDC</div>
          <FxPanel />
        </div>
      </div>

      <div className="section-title">Latest activity</div>
      <table className="ledger">
        <tbody>
          {recent.length === 0 && (
            <tr>
              <td colSpan={4} className="ledger-empty">
                Nothing yet. Run the sequence above.
              </td>
            </tr>
          )}
          {recent.map((e, i) => (
            <tr key={i}>
              <td className="nowrap">{e.ts.slice(5, 16).replace("T", " ")}</td>
              <td>{e.type}</td>
              <td>{e.amount}</td>
              <td className={e.status === "BLOCKED" || e.status === "FAILED" ? "blocked" : "ok"}>
                {e.status}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Link className="linkish" href="/ledger">
        Full ledger →
      </Link>
    </>
  );
}
