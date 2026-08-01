import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { AGENT_WALLET } from "./arc";
import { appendLedger } from "./store";

const exec = promisify(execFile);

export type TopUpResult = { outcome: "TOPPED_UP" | "ERROR"; reason?: string; amountUsdc?: number };

/**
 * Move USDC from the spending wallet into Circle Gateway, which is what x402
 * payments draw on. The balance drains with every purchase, so without this
 * the agent eventually cannot pay for anything.
 */
export async function topUpGateway(amountUsdc: number): Promise<TopUpResult> {
  try {
    await exec(
      "npx",
      [
        "circle", "gateway", "deposit",
        "--amount", String(amountUsdc),
        "--address", AGENT_WALLET,
        "--chain", "ARC-TESTNET",
        "--method", "direct",
        "--testnet",
      ],
      { cwd: process.cwd(), timeout: 180_000 },
    );
    appendLedger({
      ts: new Date().toISOString(),
      type: "gateway deposit",
      detail: `wallet → Gateway · direct on-chain · reserved for x402`,
      amount: `-${amountUsdc.toFixed(6)}`,
      status: "CONFIRMED",
    });
    return { outcome: "TOPPED_UP", amountUsdc };
  } catch (e) {
    const reason = String(e).slice(0, 300);
    appendLedger({
      ts: new Date().toISOString(),
      type: "gateway deposit",
      detail: "wallet → Gateway · failed",
      amount: `-${amountUsdc.toFixed(6)}`,
      status: "FAILED",
      reason,
    });
    return { outcome: "ERROR", reason };
  }
}
