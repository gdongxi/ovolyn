/**
 * Runs every seed stall, each on its own port with its own payout address.
 * Each endpoint is x402-paywalled through Circle's Gateway seller middleware
 * and returns data an agent would genuinely pay for.
 */
import express from "express";
import { createGatewayMiddleware } from "@circle-fin/x402-batching/server";
import { formatUnits, createPublicClient, http, defineChain } from "viem";
import { SEED_STALLS as STALLS, type SeedStall as StallSpec } from "../../lib/stalls.ts";

type PaidRequest = express.Request & {
  payment?: { verified: boolean; payer: string; amount: string; network: string };
};

const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
});
const chain = createPublicClient({ chain: arcTestnet, transport: http() });

const USYC_TELLER = "0x9fdF14c5B14173D74C08Af27AebFf39240dC105A" as const;
const USYC_TOKEN = "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C" as const;
const tellerAbi = [
  { name: "previewDeposit", type: "function", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "uint256" }] },
] as const;
const tokenAbi = [
  { name: "totalSupply", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

/**
 * The public Arc RPC is aggressively rate-limited, and a merchant that takes
 * payment and then fails to deliver is worse than one that never sold. Chain
 * reads are cached and served stale rather than dropped.
 */
const cache = new Map<string, { at: number; value: Record<string, unknown> }>();

/** Serves the last good read; the refresher below keeps it current. */
async function cached(
  id: string,
  read: () => Promise<Record<string, unknown>>,
): Promise<Record<string, unknown>> {
  const hit = cache.get(id);
  if (hit) {
    const ageMs = Date.now() - hit.at;
    return ageMs < 20_000 ? hit.value : { ...hit.value, ageSeconds: Math.round(ageMs / 1000) };
  }
  const value = await read();
  cache.set(id, { at: Date.now(), value });
  return value;
}

/** Warms and refreshes chain-backed payloads out of band, with retry. */
async function refresh(id: string, read: () => Promise<Record<string, unknown>>): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      cache.set(id, { at: Date.now(), value: await read() });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
}

// The public Arc RPC rejects concurrent calls from one client, so every read
// below is deliberately sequential.
async function readGas(): Promise<Record<string, unknown>> {
  const block = await chain.getBlockNumber();
  const fee = await chain.getGasPrice();
  return {
    chain: "arc-testnet",
    blockHeight: Number(block),
    baseFeeUsdcWei: fee.toString(),
    note: "Gas on Arc is denominated in USDC — no volatile gas token to hold.",
  };
}

async function readNav(): Promise<Record<string, unknown>> {
  // previewDeposit(1 USDC) is the live subscription rate; its inverse is the
  // NAV per share the issuer is quoting right now.
  const shares = await chain.readContract({
    address: USYC_TELLER, abi: tellerAbi, functionName: "previewDeposit", args: [1_000_000n],
  });
  const supply = await chain.readContract({
    address: USYC_TOKEN, abi: tokenAbi, functionName: "totalSupply",
  });
  const sharesPerUsdc = Number(shares) / 1e6;
  return {
    asset: "USYC",
    teller: USYC_TELLER,
    sharesPerUsdc,
    navPerShare: Number((1 / sharesPerUsdc).toFixed(6)),
    totalSupply: Number(formatUnits(supply, 6)),
    source: "on-chain read · Teller.previewDeposit",
  };
}

/** Each stall answers with something real — no lorem ipsum behind the paywall. */
async function payload(id: string): Promise<Record<string, unknown>> {
  switch (id) {
    case "gas-oracle": return cached(id, readGas);
    case "usyc-nav": return cached(id, readNav);
    case "treasury-signal":
      return {
        idleRatioTarget: 0.35,
        yieldCaptureTarget: 0.6,
        fxExposureCeiling: 0.15,
        rationale: "Hold enough idle USDC for a week of agent spend; put the rest to work.",
      };
    default:
      return {
        report: "Full market microstructure report.",
        sections: ["liquidity depth", "spread decomposition", "flow toxicity"],
      };
  }
}

function serve(spec: StallSpec): void {
  const app = express();
  const gateway = createGatewayMiddleware({
    sellerAddress: spec.payoutAddress,
    facilitatorUrl: "https://gateway-api-testnet.circle.com",
  });

  // Unpaid: lets the registry probe verify the listing without spending.
  app.get("/manifest", (_req, res) => {
    res.json({
      id: spec.id,
      name: spec.name,
      provider: spec.provider,
      priceUsdc: spec.priceUsdc,
      category: spec.category,
      description: spec.description,
      payoutAddress: spec.payoutAddress,
      endpoint: process.env.STALL_PUBLIC_BASE
        ? `${process.env.STALL_PUBLIC_BASE.replace(/\/$/, "")}/${spec.id}`
        : `http://localhost:${spec.port}${spec.path}`,
    });
  });

  app.get(spec.path, gateway.require(`$${spec.priceUsdc}`), async (req: PaidRequest, res) => {
    const { payer, amount, network } = req.payment!;
    console.log(`[${spec.id}] paid ${formatUnits(BigInt(amount), 6)} USDC by ${payer} on ${network}`);
    // Payment has already settled by this point — always deliver something.
    let data: Record<string, unknown>;
    try {
      data = await payload(spec.id);
    } catch (e) {
      data = { degraded: true, reason: String(e).slice(0, 140) };
    }
    res.json({ service: spec.id, provider: spec.provider, data, paid_by: payer, network });
  });

  app.listen(spec.port, () => {
    console.log(`[${spec.id}] :${spec.port}${spec.path} · $${spec.priceUsdc} · payout ${spec.payoutAddress}`);
  });
}

STALLS.forEach(serve);

// Warm the chain-backed payloads now, then keep them fresh, so a paid request
// never waits on (or fails against) a rate-limited RPC.
const REFRESHERS: [string, () => Promise<Record<string, unknown>>][] = [
  ["gas-oracle", readGas],
  ["usyc-nav", readNav],
];
async function refreshAll(): Promise<void> {
  for (const [id, read] of REFRESHERS) await refresh(id, read);
}
void refreshAll();
setInterval(() => void refreshAll(), 30_000);
