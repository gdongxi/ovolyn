import { createPublicClient, http, defineChain, formatUnits } from "viem";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export const AGENT_WALLET = "0xec831132b305310837f921ec7656b55356a36c98" as const;

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
});

const client = createPublicClient({ chain: arcTestnet, transport: http() });

// The public Arc RPC is rate-limited (-32011), so keep reads to a single
// eth_getBalance (USDC is the native token) and cache briefly in memory.
const TTL_MS = 15_000;
const cache = new Map<string, { at: number; value: string }>();

async function cached(key: string, fn: () => Promise<string>): Promise<string> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  try {
    const value = await fn();
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch {
    return hit?.value ?? "—";
  }
}

export function walletUsdc(): Promise<string> {
  return cached("wallet", async () => {
    const wei = await client.getBalance({ address: AGENT_WALLET });
    return formatUnits(wei, 18);
  });
}

export function gatewayUsdc(): Promise<string> {
  return cached("gateway", async () => {
    const { stdout } = await exec(
      "npx",
      ["circle", "gateway", "balance", "--address", AGENT_WALLET, "--chain", "ARC-TESTNET", "--testnet", "--output", "json"],
      { cwd: process.cwd(), timeout: 30_000 },
    );
    const rows = JSON.parse(stdout)?.data?.balances ?? [];
    const arc = rows.find((r: any) => /arc/i.test(r.network ?? ""));
    return String(arc?.balance ?? "—");
  });
}
