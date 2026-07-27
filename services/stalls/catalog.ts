/**
 * Seed service stalls on Arc Testnet.
 *
 * These are first-party services — Ovolyn operates them to bootstrap supply,
 * exactly as they are labelled in the registry. What is NOT seeded is the
 * buying decision: each stall has its own payout address, its own price and a
 * genuinely different capability, so an agent choosing between them is making
 * a real choice under a real budget.
 *
 * Third-party providers list through the same registry with the same probe.
 */
export type StallSpec = {
  id: string;
  port: number;
  name: string;
  provider: string;
  path: string;
  priceUsdc: number;
  category: string;
  description: string;
  /** Independent payout address — must never be the buyer's wallet. */
  payoutAddress: `0x${string}`;
};

export const STALLS: StallSpec[] = [
  {
    id: "gas-oracle",
    port: 4021,
    name: "Arc Gas Oracle",
    provider: "Ovolyn Labs",
    path: "/gas",
    priceUsdc: 0.001,
    category: "CHAIN_DATA",
    description: "Current Arc Testnet base fee and block height, denominated in USDC.",
    payoutAddress: "0x705197b03726d10d220e06f2c097ff34727eb8d3",
  },
  {
    id: "usyc-nav",
    port: 4022,
    name: "USYC NAV Feed",
    provider: "Meridian Data",
    path: "/nav",
    priceUsdc: 0.004,
    category: "FINANCIAL_ANALYSIS",
    description: "Live USYC net asset value and implied yield, read from the Teller contract.",
    payoutAddress: "0xf034096ea62322db6e15e9903cf9762c0e0a54f6",
  },
  {
    id: "treasury-signal",
    port: 4023,
    name: "Treasury Signal",
    provider: "Halden Research",
    path: "/signal",
    priceUsdc: 0.008,
    category: "FINANCIAL_ANALYSIS",
    description: "Allocation guidance for a stablecoin treasury: idle ratio, yield capture, FX exposure.",
    payoutAddress: "0x43b53ec907ad9e1c7180f9e38d64e52b7f2250d8",
  },
  {
    id: "deep-analysis",
    port: 4024,
    name: "Deep Market Analysis",
    provider: "Halden Research",
    path: "/deep",
    priceUsdc: 0.05,
    category: "FINANCIAL_ANALYSIS",
    description: "Full market microstructure report. Priced above a conservative per-transaction limit.",
    payoutAddress: "0x1ffb3e19926f228dd2cff357470907b5f85d3fb8",
  },
];

export const stallUrl = (s: StallSpec): string => `http://localhost:${s.port}${s.path}`;
