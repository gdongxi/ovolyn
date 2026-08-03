import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { createPublicClient, http, erc20Abi } from "viem";
import { sepolia } from "viem/chains";
import { AGENT_WALLET } from "./arc";
import { appendLedger } from "./store";

// CCTP V2 contracts (same address on every chain) + Circle attestation API.
const TOKEN_MESSENGER_V2 = "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA";
const MESSAGE_TRANSMITTER_V2 = "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275";
const USDC_SEPOLIA = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const IRIS = "https://iris-api-sandbox.circle.com";
const SRC_DOMAIN = 0; // Ethereum Sepolia
const DST_DOMAIN = 26; // Arc
const ZERO32 = "0x" + "0".repeat(64);
// Fast finality: attestation after soft finality (seconds-to-minutes instead of ~15 min).
// maxFee is charged from the transferred amount by the protocol when fast is used.
const FINALITY_FAST = 1000;
const MAX_FEE_MICRO = "10000"; // up to $0.01

// Half the historical runs waited two Sepolia slots instead of one, which is
// what a fee sitting close to base looks like. Testnet gas costs nothing.
const FEE = { type: "level", config: { feeLevel: "HIGH" } } as const;

// Approving costs a whole Ethereum inclusion cycle — measured at 12s or 24s
// across six deposits, a quarter of the flow — and it buys nothing on a deposit
// that is already covered. Top the allowance up in one transaction and let the
// next several deposits skip the step entirely.
const ALLOWANCE_TOPUP_MICRO = BigInt(1_000_000_000); // $1,000

const sepoliaReader = createPublicClient({ chain: sepolia, transport: http() });

async function currentAllowance(owner: string): Promise<bigint> {
  return sepoliaReader.readContract({
    address: USDC_SEPOLIA as `0x${string}`,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner as `0x${string}`, TOKEN_MESSENGER_V2 as `0x${string}`],
  });
}

function dcw() {
  return initiateDeveloperControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY!,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
  });
}

/**
 * Submit through a developer-controlled wallet and watch it land.
 *
 * `until: "hash"` returns as soon as the transaction has a hash — it has been
 * broadcast, not yet confirmed. That is enough for the burn, because the
 * attestation service will not sign until it has seen two confirmations
 * anyway: waiting for the confirmation ourselves first only pays for it twice.
 *
 * Polled at 2s. The documented GET limit is 20/s and 500ms was well inside it,
 * but a run at that rate drew a sustained 429 from the edge — an undocumented
 * limit that then refused the CLI's calls for minutes afterwards, failing the
 * two stages after the deposit. The seconds a tighter poll saves are not worth
 * a rate limit arriving in the middle of a demo.
 */
async function exec(
  walletId: string,
  label: string,
  input: Record<string, unknown>,
  until: "confirmed" | "hash" = "confirmed",
): Promise<string> {
  const client = dcw();
  const res = await client.createContractExecutionTransaction({ walletId, fee: FEE, ...input } as never);
  const id = (res as any).data?.id as string;
  const SUCCESS = ["CONFIRMED", "COMPLETE"];
  const TERMINAL = [...SUCCESS, "FAILED", "CANCELLED", "DENIED"];
  const POLL_MS = 2000;
  for (let i = 0; i < 90; i++) {
    const t = await client.getTransaction({ id });
    const tx = (t as any).data?.transaction;
    if (tx?.state && ["FAILED", "CANCELLED", "DENIED"].includes(tx.state)) {
      throw new Error(`${label}: ${tx.state}`);
    }
    if (until === "hash" && tx?.txHash) return tx.txHash;
    if (tx?.state && TERMINAL.includes(tx.state)) return tx.txHash ?? "";
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error(`${label}: timeout`);
}

async function fetchAttestation(burnTx: string): Promise<{ message: string; attestation: string }> {
  // Called the moment the burn is broadcast, so the first answers are a 404
  // ("Message not found") and then status pending_confirmations — both expected
  // while Iris waits for its two confirmations. Left at 5s: see the note on
  // exec() about the 429 a tighter poll drew.
  const url = `${IRIS}/v2/messages/${SRC_DOMAIN}?transactionHash=${burnTx}`;
  for (let i = 0; i < 60; i++) {
    const r = await fetch(url);
    if (r.ok) {
      const j = (await r.json()) as { messages?: { status: string; message: string; attestation: string }[] };
      const m = j.messages?.[0];
      if (m && m.status === "complete" && m.attestation && m.attestation !== "PENDING") {
        return { message: m.message, attestation: m.attestation };
      }
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error("attestation timeout (5 min)");
}

export type DepositResult = {
  outcome: "DEPOSITED" | "ERROR";
  reason?: string;
  burnTx?: string;
  mintTx?: string;
};

/**
 * Cross-chain deposit into the agent account:
 * burn USDC on Sepolia -> Circle attestation (fast finality) -> mint on Arc
 * to the agent wallet. The treasury wallet submits the Arc-side mint (its gas
 * is USDC — no native-token juggling anywhere in the flow).
 */
export async function cctpDeposit(amountUsdc: number): Promise<DepositResult> {
  const micro = BigInt(Math.round(amountUsdc * 1e6)).toString();
  const mintRecipient = "0x" + AGENT_WALLET.slice(2).toLowerCase().padStart(64, "0");
  const sepoliaWalletId = process.env.SEPOLIA_WALLET_ID!;
  const orchWalletId = process.env.ORCH_WALLET_ID!;
  // Tracked outside the try so a failure after the burn still records the hash —
  // burned-but-not-minted funds are recoverable only if this survives.
  let burnTx = "";
  try {
    // Only approve when the standing allowance cannot cover this burn. On the
    // deposits that skip it, the burn lands a whole Ethereum slot earlier.
    const owner = process.env.SEPOLIA_ADDRESS!;
    let allowance = 0n;
    try {
      allowance = await currentAllowance(owner);
    } catch {
      allowance = 0n; // a read failure must not silently skip a needed approval
    }
    if (allowance < BigInt(micro)) {
      await exec(sepoliaWalletId, "approve", {
        contractAddress: USDC_SEPOLIA,
        abiFunctionSignature: "approve(address,uint256)",
        abiParameters: [TOKEN_MESSENGER_V2, ALLOWANCE_TOPUP_MICRO.toString()],
      });
    }
    // Returns on the hash, not the confirmation: the attestation service waits
    // for two confirmations regardless, so waiting here as well pays twice.
    burnTx = await exec(
      sepoliaWalletId,
      "depositForBurn",
      {
        contractAddress: TOKEN_MESSENGER_V2,
        abiFunctionSignature: "depositForBurn(uint256,uint32,bytes32,address,bytes32,uint256,uint32)",
        abiParameters: [micro, DST_DOMAIN, mintRecipient, USDC_SEPOLIA, ZERO32, MAX_FEE_MICRO, FINALITY_FAST],
      },
      "hash",
    );
    const { message, attestation } = await fetchAttestation(burnTx);
    const mintTx = await exec(orchWalletId, "receiveMessage", {
      contractAddress: MESSAGE_TRANSMITTER_V2,
      abiFunctionSignature: "receiveMessage(bytes,bytes)",
      abiParameters: [message, attestation],
    });
    appendLedger({
      ts: new Date().toISOString(),
      type: "cctp deposit",
      detail: `Sepolia → Arc · CCTP V2 fast · burn ${burnTx.slice(0, 10)}…`,
      amount: `+${amountUsdc.toFixed(6)}`,
      status: "CONFIRMED",
      txHash: mintTx,
    });
    return { outcome: "DEPOSITED", burnTx, mintTx };
  } catch (e) {
    const reason = String(e).slice(0, 300);
    appendLedger({
      ts: new Date().toISOString(),
      type: "cctp deposit",
      detail: burnTx
        ? `Sepolia → Arc · burned ${burnTx.slice(0, 10)}… but not minted — funds recoverable by replaying the attestation`
        : "Sepolia → Arc · failed before burn — no funds moved",
      amount: `+${amountUsdc.toFixed(6)}`,
      status: "FAILED",
      reason,
    });
    return { outcome: "ERROR", reason, burnTx: burnTx || undefined };
  }
}
