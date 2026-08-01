import { walletUsdc, gatewayUsdc } from "./arc";
import { treasuryBalances } from "./treasury";
import { getLedger } from "./store";
import { marketView } from "./registry";
import { countAgents } from "./accounts";

/**
 * The numbers the landing page shows. Everything here is read live — a visitor
 * who doubts them can open the console, the market or the ledger and reconcile
 * every figure against the chain.
 */
export type Stats = {
  custodyUsdc: number;
  earningUsyc: number;
  servicesListed: number;
  agentsRegistered: number;
  paymentsSettled: number;
  paymentsVolumeUsdc: number;
  blockedAttempts: number;
  /** Running USDC-equivalent balance after each ledger event, oldest first. */
  balanceSeries: number[];
};

export async function getStats(): Promise<Stats> {
  const [wallet, gateway, treasury] = await Promise.all([
    walletUsdc(),
    gatewayUsdc(),
    treasuryBalances(),
  ]);

  const num = (v: string) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const custodyUsdc = num(wallet) + num(gateway) + num(treasury.usdc);
  const earningUsyc = num(treasury.usyc);

  const ledger = getLedger();
  const spends = ledger.filter((e) => e.type === "x402 spend" && e.status === "SETTLED");
  const blockedAttempts = ledger.filter((e) => e.status === "BLOCKED").length;

  // Only external flows change what is under custody. Moving USDC into
  // Gateway, sweeping it into USYC or swapping it for EURC shifts the money
  // between pockets we still hold — charting those as outflows would
  // contradict the custody figure above.
  const EXTERNAL_IN = new Set(["faucet fund", "cctp deposit"]);
  const chronological = [...ledger]
    .reverse()
    .filter((e) => e.status === "CONFIRMED" || e.status === "SETTLED")
    .filter((e) => EXTERNAL_IN.has(e.type) || e.type === "x402 spend");

  let running = 0;
  const balanceSeries = chronological.map((e) => {
    const amount = Number(e.amount) || 0;
    running += EXTERNAL_IN.has(e.type) ? Math.abs(amount) : -Math.abs(amount);
    return Number(running.toFixed(6));
  });

  return {
    custodyUsdc,
    earningUsyc,
    servicesListed: marketView().length,
    agentsRegistered: countAgents(),
    paymentsSettled: spends.length,
    paymentsVolumeUsdc: spends.reduce((sum, e) => sum + Math.abs(Number(e.amount) || 0), 0),
    blockedAttempts,
    balanceSeries,
  };
}
