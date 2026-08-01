/**
 * Where the seed services live.
 *
 * On a laptop each stall is its own port on localhost. Behind a public host
 * they sit behind one domain, so that agents anywhere — not just this
 * machine — can actually buy from them. STALL_PUBLIC_BASE switches between
 * the two without either the registry or the policy having to know.
 */

export type SeedStall = {
  id: string;
  port: number;
  path: string;
  name: string;
  provider: string;
  priceUsdc: number;
  category: string;
  description: string;
  payoutAddress: string;
};

export const SEED_STALLS: SeedStall[] = [
  {
    id: "gas-oracle", port: 4021, path: "/gas",
    name: "Arc Gas Oracle", provider: "Ovolyn Labs", priceUsdc: 0.001, category: "CHAIN_DATA",
    description: "Current Arc Testnet base fee and block height, denominated in USDC.",
    payoutAddress: "0x705197b03726d10d220e06f2c097ff34727eb8d3",
  },
  {
    id: "usyc-nav", port: 4022, path: "/nav",
    name: "USYC NAV Feed", provider: "Meridian Data", priceUsdc: 0.004, category: "FINANCIAL_ANALYSIS",
    description: "Live USYC net asset value and implied yield, read from the Teller contract.",
    payoutAddress: "0xf034096ea62322db6e15e9903cf9762c0e0a54f6",
  },
  {
    id: "treasury-signal", port: 4023, path: "/signal",
    name: "Treasury Signal", provider: "Halden Research", priceUsdc: 0.008, category: "FINANCIAL_ANALYSIS",
    description: "Allocation guidance for a stablecoin treasury: idle ratio, yield capture, FX exposure.",
    payoutAddress: "0x43b53ec907ad9e1c7180f9e38d64e52b7f2250d8",
  },
  {
    id: "deep-analysis", port: 4024, path: "/deep",
    name: "Deep Market Analysis", provider: "Halden Research", priceUsdc: 0.05, category: "FINANCIAL_ANALYSIS",
    description: "Full market microstructure report. Priced above a conservative per-transaction limit.",
    payoutAddress: "0x1ffb3e19926f228dd2cff357470907b5f85d3fb8",
  },
];

/** Public when deployed, per-port on localhost otherwise. */
export function stallEndpoint(s: SeedStall): string {
  const base = process.env.STALL_PUBLIC_BASE;
  return base ? `${base.replace(/\/$/, "")}/${s.id}` : `http://localhost:${s.port}${s.path}`;
}

/** Merchants the operator permits by default — the seed stalls, wherever they live. */
export function defaultAllowlist(): string[] {
  const base = process.env.STALL_PUBLIC_BASE;
  return base
    ? [`${base.replace(/\/$/, "")}/`]
    : SEED_STALLS.map((s) => `http://localhost:${s.port}`);
}
