import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
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

const FEE = { type: "level", config: { feeLevel: "MEDIUM" } } as const;

function dcw() {
  return initiateDeveloperControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY!,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
  });
}

async function exec(walletId: string, label: string, input: Record<string, unknown>): Promise<string> {
  const client = dcw();
  const res = await client.createContractExecutionTransaction({ walletId, fee: FEE, ...input } as never);
  const id = (res as any).data?.id as string;
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

async function fetchAttestation(burnTx: string): Promise<{ message: string; attestation: string }> {
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
  try {
    await exec(sepoliaWalletId, "approve", {
      contractAddress: USDC_SEPOLIA,
      abiFunctionSignature: "approve(address,uint256)",
      abiParameters: [TOKEN_MESSENGER_V2, micro],
    });
    const burnTx = await exec(sepoliaWalletId, "depositForBurn", {
      contractAddress: TOKEN_MESSENGER_V2,
      abiFunctionSignature: "depositForBurn(uint256,uint32,bytes32,address,bytes32,uint256,uint32)",
      abiParameters: [micro, DST_DOMAIN, mintRecipient, USDC_SEPOLIA, ZERO32, MAX_FEE_MICRO, FINALITY_FAST],
    });
    const { message, attestation } = await fetchAttestation(burnTx);
    const mintTx = await exec(orchWalletId, "receiveMessage", {
      contractAddress: MESSAGE_TRANSMITTER_V2,
      abiFunctionSignature: "receiveMessage(bytes,bytes)",
      abiParameters: [message, attestation],
    });
    appendLedger({
      ts: new Date().toISOString(),
      type: "cctp deposit",
      detail: `Sepolia → Arc · CCTP V2 fast · burn ${burnTx.slice(0, 10)}… mint ${mintTx.slice(0, 10)}…`,
      amount: `+${amountUsdc.toFixed(6)}`,
      status: "CONFIRMED",
    });
    return { outcome: "DEPOSITED", burnTx, mintTx };
  } catch (e) {
    return { outcome: "ERROR", reason: String(e).slice(0, 300) };
  }
}
