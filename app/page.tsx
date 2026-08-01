import Link from "next/link";
import { getStats } from "@/lib/stats";
import { Guilloche, ReededRule, BalanceLine } from "./engraving";

export const dynamic = "force-dynamic";

const VERBS = [
  { name: "Deposit", line: "USDC arrives from any chain.", tool: "CCTP v2" },
  { name: "Earn", line: "Idle balances sweep into treasury yield.", tool: "USYC" },
  { name: "Govern", line: "Limits the agent cannot raise itself.", tool: "Policy engine" },
  { name: "Spend", line: "Machine-speed payments, inside policy.", tool: "x402 · Gateway" },
];

const money = (n: number, digits = 2) =>
  n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export default async function Landing() {
  const stats = await getStats();

  return (
    <div className="landing">
      <section className="hero">
        <Guilloche className="hero-plate" height={560} />
        <div className="hero-inner">
          <h1 className="display">
            The autonomous bank
            <br />
            for AI agents.
          </h1>
          <p className="hero-sub">Deposit. Earn. Govern. Spend. — on Arc.</p>
          <div className="hero-actions">
            <Link className="btn" href="/console">
              Open the console
            </Link>
            <Link className="btn btn-outline" href="/ledger">
              Verify every figure
            </Link>
          </div>
        </div>
      </section>

      <section className="stat-band">
        <Guilloche className="hero-plate" height={220} stroke="#f3f2f2" opacity={0.11} />
        <div className="stat-inner">
          <div className="stat">
            <div className="stat-v">
              {money(stats.custodyUsdc)}
              <span className="brass"> USDC</span>
            </div>
            <div className="stat-l">under custody</div>
          </div>
          <div className="stat">
            <div className="stat-v">
              {money(stats.earningUsyc, 4)}
              <span className="brass"> USYC</span>
            </div>
            <div className="stat-l">earning yield</div>
          </div>
          <div className="stat">
            <div className="stat-v">{stats.paymentsSettled}</div>
            <div className="stat-l">payments settled</div>
          </div>
          <div className="stat">
            <div className="stat-v">{stats.blockedAttempts}</div>
            <div className="stat-l">spends refused by policy</div>
          </div>
          <div className="stat">
            <div className="stat-v">{stats.servicesListed}</div>
            <div className="stat-l">services listed</div>
          </div>
        </div>
      </section>

      <section className="verbs-band">
        {VERBS.map((v) => (
          <div className="verb-card" key={v.name}>
            <ReededRule className="reed" width={240} />
            <h2 className="display verb-name">{v.name}</h2>
            <p className="verb-line">{v.line}</p>
            <div className="verb-tool">{v.tool}</div>
          </div>
        ))}
      </section>

      <section className="proof-band">
        <div className="proof-copy">
          <h2 className="display">Every figure above is on-chain.</h2>
          <p>
            Live on Arc Testnet. The balance line is drawn from the same ledger the console shows,
            and each entry links to the transaction that produced it.
          </p>
          <Link className="navlink" href="/market">
            See the open service registry →
          </Link>
        </div>
        <div className="proof-chart">
          <BalanceLine series={stats.balanceSeries} />
          <div className="chart-cap">Capital under custody · deposits in, payments out</div>
        </div>
      </section>
    </div>
  );
}
