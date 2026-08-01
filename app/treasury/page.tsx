import { AGENT_WALLET, walletUsdc, gatewayUsdc } from "@/lib/arc";
import { treasuryBalances } from "@/lib/treasury";
import { getPolicy } from "@/lib/store";
import { PageHead } from "@/app/pagehead";
import { DepositPanel, SweepPanel, FxPanel } from "./panels";

export const dynamic = "force-dynamic";

const fmt = (v: string, digits = 2) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
};

export default async function Treasury() {
  const [wallet, gateway, treasury] = await Promise.all([
    walletUsdc(),
    gatewayUsdc(),
    treasuryBalances(),
  ]);
  const policy = getPolicy();

  return (
    <>
      <PageHead
        title="Treasury"
        lede="Where the money comes in, where it goes to work, and what currency it sits in."
      />

      <div className="grid">
        <div className="card">
          <div className="label">Spending wallet</div>
          <div className="value">{fmt(wallet)}</div>
          <div className="sub">USDC · {AGENT_WALLET}</div>
        </div>
        <div className="card">
          <div className="label">Gateway</div>
          <div className="value">{fmt(gateway, 4)}</div>
          <div className="sub">USDC reserved for x402 payments · domain 26</div>
        </div>
        <div className="card">
          <div className="label">Yield sleeve</div>
          <div className="value">{fmt(treasury.usyc, 4)}</div>
          <div className="sub">USYC · earning · float {fmt(treasury.usdc)} USDC</div>
        </div>
      </div>

      <DepositPanel />
      <SweepPanel idleThresholdUsdc={policy.idleThresholdUsdc} walletUsdc={fmt(wallet)} />
      <FxPanel eurc={fmt(treasury.eurc, 4)} usdcFloat={fmt(treasury.usdc)} />
    </>
  );
}
