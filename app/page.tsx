import { AGENT_WALLET, walletUsdc, gatewayUsdc } from "@/lib/arc";
import { treasuryBalances } from "@/lib/treasury";
import { getPolicy, getLedger, spentTodayUsdc } from "@/lib/store";
import { PolicyCard, AgentActions, SweepButton } from "./controls";

export const dynamic = "force-dynamic";

export default async function Console() {
  const [wallet, gateway, treasury] = await Promise.all([walletUsdc(), gatewayUsdc(), treasuryBalances()]);
  const policy = getPolicy();
  const ledger = getLedger();
  const spent = spentTodayUsdc();

  return (
    <>
      <div className="grid">
        <div className="card">
          <div className="label">Wallet · USDC</div>
          <div className="value">{Number(wallet).toFixed(2)}</div>
          <div className="sub">{AGENT_WALLET}</div>
        </div>
        <div className="card">
          <div className="label">Gateway · Spendable</div>
          <div className="value">{gateway === "—" ? "—" : Number(gateway).toFixed(4)}</div>
          <div className="sub">x402 nanopayments · domain 26 · spent today ${spent.toFixed(6)}</div>
        </div>
        <div className="card">
          <div className="label">USYC · Earning</div>
          <div className="value">{treasury.usyc === "—" ? "—" : Number(treasury.usyc).toFixed(4)}</div>
          <div className="sub">yield sleeve · Teller {`0x9fdF…105A`} · treasury float {Number(treasury.usdc).toFixed(2)} USDC</div>
          <SweepButton />
        </div>
      </div>

      <div className="grid grid-2">
        <PolicyCard policy={policy} />
        <AgentActions />
      </div>

      <div className="section-title">Activity — live on Arc Testnet</div>
      <table className="ledger">
        <thead>
          <tr><th>Time (UTC)</th><th>Type</th><th>Detail</th><th>Amount</th><th>Status</th></tr>
        </thead>
        <tbody>
          {ledger.map((e, i) => (
            <tr key={i}>
              <td>{e.ts.slice(0, 16).replace("T", " ")}</td>
              <td>{e.type}</td>
              <td>{e.detail}{e.reason ? ` — ${e.reason}` : ""}</td>
              <td>{e.amount}</td>
              <td className={e.status === "BLOCKED" ? "blocked" : "ok"}>{e.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
