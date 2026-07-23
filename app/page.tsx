import { AGENT_WALLET, walletUsdc, gatewayUsdc } from "@/lib/arc";

export const dynamic = "force-dynamic";

export default async function Console() {
  const [wallet, gateway] = await Promise.all([walletUsdc(), gatewayUsdc()]);

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
          <div className="sub">x402 nanopayments · domain 26</div>
        </div>
        <div className="card">
          <div className="label">USYC · Earning</div>
          <div className="value">0.00</div>
          <div className="sub">auto-sweep — wiring in progress</div>
        </div>
      </div>

      <div className="section-title">Activity — live on Arc Testnet</div>
      <table className="ledger">
        <thead>
          <tr><th>Time (UTC)</th><th>Type</th><th>Detail</th><th>Amount</th><th>Status</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>2026-07-23 04:31</td>
            <td>x402 spend</td>
            <td>ovolyn-demo-stall /oracle · eip155:5042002</td>
            <td>-0.001000</td>
            <td className="ok">SETTLED</td>
          </tr>
          <tr>
            <td>2026-07-23 04:24</td>
            <td>gateway deposit</td>
            <td>direct on-chain · instant finality</td>
            <td>-5.000000</td>
            <td className="ok">CONFIRMED</td>
          </tr>
          <tr>
            <td>2026-07-23 04:21</td>
            <td>faucet fund</td>
            <td>Circle testnet faucet</td>
            <td>+20.000000</td>
            <td className="ok">CONFIRMED</td>
          </tr>
        </tbody>
      </table>
    </>
  );
}
