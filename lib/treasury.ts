import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { AGENT_WALLET } from "./arc";
import { appendLedger } from "./store";

const exec = promisify(execFile);

// USYC on Arc Testnet (addresses verified on-chain in the previous integration;
// subscription is gated by the issuer's on-chain allowlist — the treasury
// wallet below holds that role).
export const USYC_ADDRESS = "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C";
export const USYC_TELLER = "0x9fdF14c5B14173D74C08Af27AebFf39240dC105A";
export const USDC_ERC20 = "0x3600000000000000000000000000000000000000";

const FEE = { type: "level", config: { feeLevel: "MEDIUM" } } as const;

function dcw() {
  return initiateDeveloperControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY!,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
  });
}

function orch() {
  return { walletId: process.env.ORCH_WALLET_ID!, address: process.env.ORCH_ADDRESS! };
}

export async function treasuryBalances(): Promise<{ usyc: string; usdc: string }> {
  try {
    const res = await dcw().getWalletTokenBalance({ id: orch().walletId });
    const find = (sym: string) =>
      res.data?.tokenBalances?.find((b: any) => b.token.symbol === sym)?.amount ?? "0";
    return { usyc: find("USYC"), usdc: find("USDC") };
  } catch {
    return { usyc: "—", usdc: "—" };
  }
}

async function waitTx(client: ReturnType<typeof dcw>, label: string, id: string): Promise<string> {
  const SUCCESS = ["CONFIRMED", "COMPLETE"];
  const TERMINAL = [...SUCCESS, "FAILED", "CANCELLED", "DENIED"];
  for (let i = 0; i < 90; i++) {
    const t = await client.getTransaction({ id });
    const tx = (t as any).data?.transaction;
    if (tx?.state && TERMINAL.includes(tx.state)) {
      if (!SUCCESS.includes(tx.state)) throw new Error(`${label}: ${tx.state}`);
      return tx.txHash ?? "";
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`${label}: timeout`);
}

async function tellerCall(label: string, input: Record<string, unknown>): Promise<string> {
  const client = dcw();
  const res = await client.createContractExecutionTransaction({
    walletId: orch().walletId,
    fee: FEE,
    ...input,
  } as never);
  const id = (res as any).data?.id as string;
  return waitTx(client, label, id);
}

export type SweepResult = {
  outcome: "SWEPT" | "ERROR";
  reason?: string;
  transferTx?: string;
  depositTx?: string;
  mintedUsyc?: string;
};

/**
 * Sweep idle USDC from the agent wallet into the yield sleeve:
 *   agent wallet --USDC--> treasury wallet --Teller.deposit--> USYC
 */
export async function sweepToUsyc(amountUsdc: number): Promise<SweepResult> {
  const micro = BigInt(Math.round(amountUsdc * 1e6)).toString();
  const { address: treasury } = orch();
  try {
    // 1) move idle USDC out of the spending wallet (Agent Stack CLI)
    const { stdout } = await exec(
      "npx",
      [
        "circle", "wallet", "transfer", treasury,
        "--amount", String(amountUsdc),
        "--address", AGENT_WALLET, "--chain", "ARC-TESTNET", "--testnet", "--quiet",
      ],
      { cwd: process.cwd(), timeout: 120_000 },
    );
    const transferTx = stdout.trim().split(/\s/).pop() ?? "";

    // 2) approve + subscribe via the allowlisted treasury wallet
    await tellerCall("approve", {
      contractAddress: USDC_ERC20,
      abiFunctionSignature: "approve(address,uint256)",
      abiParameters: [USYC_TELLER, micro],
    });
    const before = (await treasuryBalances()).usyc;
    const depositTx = await tellerCall("deposit", {
      contractAddress: USYC_TELLER,
      abiFunctionSignature: "deposit(uint256,address)",
      abiParameters: [micro, treasury],
    });
    const after = (await treasuryBalances()).usyc;
    const minted = (Number(after) - Number(before)).toFixed(6);

    appendLedger({
      ts: new Date().toISOString(),
      type: "usyc sweep",
      detail: `idle sweep · agent → treasury → Teller.deposit · minted ${minted} USYC`,
      amount: `-${amountUsdc.toFixed(6)}`,
      status: "CONFIRMED",
    });
    return { outcome: "SWEPT", transferTx, depositTx, mintedUsyc: minted };
  } catch (e) {
    return { outcome: "ERROR", reason: String(e).slice(0, 300) };
  }
}
