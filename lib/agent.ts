import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { AGENT_WALLET } from "./arc";
import { getPolicy, appendLedger, spentTodayUsdc, type LedgerEntry } from "./store";

const exec = promisify(execFile);

export type SpendResult = {
  outcome: "SETTLED" | "BLOCKED" | "ERROR";
  reason?: string;
  priceUsdc?: number;
  response?: unknown;
};

function block(detail: string, reason: string, price?: number): SpendResult {
  appendLedger({
    ts: new Date().toISOString(),
    type: "blocked spend",
    detail,
    amount: price ? `-${price.toFixed(6)}` : "0",
    status: "BLOCKED",
    reason,
  });
  return { outcome: "BLOCKED", reason, priceUsdc: price };
}

async function estimatePriceUsdc(url: string): Promise<number> {
  const { stdout } = await exec(
    "npx",
    ["circle", "services", "pay", url, "--address", AGENT_WALLET, "--chain", "ARC-TESTNET", "--estimate", "--testnet"],
    { cwd: process.cwd(), timeout: 60_000 },
  );
  const m = stdout.match(/\$([0-9.]+)\s*USDC/i);
  if (!m) throw new Error(`cannot parse estimate: ${stdout.slice(0, 200)}`);
  return Number(m[1]);
}

/**
 * The policy gate + real x402 payment. Every path leaves a ledger entry.
 *
 * `caps` narrows the account policy for a particular agent: an agent may be
 * held to a tighter limit than the account, never a looser one.
 */
export async function agentSpend(
  url: string,
  label: string,
  caps?: { perTxLimitUsdc?: number },
): Promise<SpendResult> {
  const accountPolicy = getPolicy();
  const policy = {
    ...accountPolicy,
    perTxLimitUsdc:
      caps?.perTxLimitUsdc !== undefined
        ? Math.min(accountPolicy.perTxLimitUsdc, caps.perTxLimitUsdc)
        : accountPolicy.perTxLimitUsdc,
  };
  const detail = `${label} · ${url}`;

  if (!policy.allowlist.some((prefix) => url.startsWith(prefix))) {
    return block(detail, `service not on allowlist`);
  }

  let price: number;
  try {
    price = await estimatePriceUsdc(url);
  } catch (e) {
    return { outcome: "ERROR", reason: String(e).slice(0, 200) };
  }

  if (price > policy.perTxLimitUsdc) {
    return block(detail, `price $${price} exceeds per-tx limit $${policy.perTxLimitUsdc}`, price);
  }
  const spent = spentTodayUsdc();
  if (spent + price > policy.dailyBudgetUsdc) {
    return block(detail, `daily budget $${policy.dailyBudgetUsdc} would be exceeded (spent $${spent.toFixed(6)})`, price);
  }

  try {
    const { stdout } = await exec(
      "npx",
      [
        "circle", "services", "pay", url,
        "--address", AGENT_WALLET, "--chain", "ARC-TESTNET",
        "--max-amount", String(policy.perTxLimitUsdc), "--testnet", "--quiet",
      ],
      { cwd: process.cwd(), timeout: 90_000 },
    );
    let response: unknown = stdout.trim();
    try { response = JSON.parse(stdout); } catch {}
    const entry: LedgerEntry = {
      ts: new Date().toISOString(),
      type: "x402 spend",
      detail: `${detail} · eip155:5042002`,
      amount: `-${price.toFixed(6)}`,
      status: "SETTLED",
    };
    appendLedger(entry);
    return { outcome: "SETTLED", priceUsdc: price, response };
  } catch (e) {
    return { outcome: "ERROR", reason: String(e).slice(0, 300) };
  }
}
