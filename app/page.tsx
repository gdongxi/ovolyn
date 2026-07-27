import { AGENT_WALLET, walletUsdc, gatewayUsdc } from "@/lib/arc";
import { treasuryBalances } from "@/lib/treasury";
import { getPolicy, getLedger, spentTodayUsdc } from "@/lib/store";
import { PolicyCard, AgentActions, SweepButton, DepositButton, FxCard } from "./controls";
import { RunPanel } from "./runpanel";
import { readRun } from "@/lib/runbook";

export const dynamic = "force-dynamic";

/** Balances arrive as strings and become "—" when an upstream read fails. */
function fmt(value: string, digits = 2): string {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
}

export default async function Console() {
  const [wallet, gateway, treasury] = await Promise.all([walletUsdc(), gatewayUsdc(), treasuryBalances()]);
  const policy = getPolicy();
  const ledger = getLedger();
  const spent = spentTodayUsdc();

  return (
    <>
      <RunPanel initial={readRun()} />

      <div className="grid">
        <div className="card">
          <div className="label">Wallet · USDC</div>
          <div className="value">{fmt(wallet)}</div>
          <div className="sub">{AGENT_WALLET}</div>
          <DepositButton />
        </div>
        <div className="card">
          <div className="label">Gateway · Spendable</div>
          <div className="value">{fmt(gateway, 4)}</div>
          <div className="sub">x402 nanopayments · domain 26 · spent today ${spent.toFixed(6)}</div>
        </div>
        <div className="card">
          <div className="label">USYC · Earning</div>
          <div className="value">{fmt(treasury.usyc, 4)}</div>
          <div className="sub">yield sleeve · Teller {`0x9fdF…105A`} · treasury float {fmt(treasury.usdc)} USDC</div>
          <SweepButton />
        </div>
      </div>

      <div className="grid">
        <PolicyCard policy={policy} />
        <AgentActions />
        <FxCard eurc={fmt(treasury.eurc, 4)} usdcFloat={fmt(treasury.usdc)} />
      </div>

      <div className="section-title">Activity — live on Arc Testnet</div>
      <table className="ledger">
        <thead>
          <tr><th>Time (UTC)</th><th>Type</th><th>Detail</th><th>Amount</th><th>Status</th></tr>
        </thead>
        <tbody>
          {ledger.length === 0 && (
            <tr>
              <td colSpan={5} className="empty">
                No activity yet — every row here is written by a real transaction executed through this console.
              </td>
            </tr>
          )}
          {ledger.map((e, i) => (
            <tr key={i}>
              <td>{e.ts.slice(0, 16).replace("T", " ")}</td>
              <td>{e.type}</td>
              <td>
                {e.detail}{e.reason ? ` — ${e.reason}` : ""}
                {e.txHash && (
                  <a className="tx" href={`https://testnet.arcscan.app/tx/${e.txHash}`} target="_blank" rel="noreferrer">
                    ↗ {e.txHash.slice(0, 10)}…
                  </a>
                )}
              </td>
              <td>{e.amount}</td>
              <td className={e.status === "BLOCKED" ? "blocked" : e.status === "FAILED" ? "blocked" : "ok"}>{e.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
