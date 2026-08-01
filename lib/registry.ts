import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * The open service registry.
 *
 * Listing is permissionless: anyone with a payout address and an x402
 * endpoint can list, and no human approves anything. What the registry does
 * instead is *probe* — liveness, a valid 402 quote, and a price that matches
 * what the listing claims — and publish the result as a trust tier. The
 * registry curates display, never access: an unlisted endpoint is still
 * payable by URL.
 *
 * Tier 0 · Listed    — probe passed (alive, valid 402, price matches)
 * Tier 1 · Verified  — provider identity verified (roadmap)
 * Tier 2 · Audited   — quality reviewed (roadmap)
 */

export type Listing = {
  id: string;
  name: string;
  provider: string;
  endpoint: string;
  method: "GET" | "POST";
  priceUsdc: number;
  category: string;
  description: string;
  payoutAddress: string;
  /** First-party seed supply is labelled, never disguised as a third party. */
  firstParty: boolean;
  tier: 0 | 1 | 2;
  probe?: ProbeResult;
};

export type ProbeResult = {
  checkedAt: string;
  alive: boolean;
  valid402: boolean;
  quotedUsdc: number | null;
  priceMatches: boolean;
  passed: boolean;
  note?: string;
};

const DATA_DIR = join(process.cwd(), "data");
const FILE = "registry.json";

function path(): string {
  mkdirSync(DATA_DIR, { recursive: true });
  return join(DATA_DIR, FILE);
}

/**
 * Seed listings mirror services/stalls/catalog.ts — kept as data here so the
 * Next build and the standalone stall process stay independent of each other.
 */
function seed(): Listing[] {
  const s = (
    id: string, name: string, provider: string, port: number, path: string,
    priceUsdc: number, category: string, description: string, payoutAddress: string,
  ): Listing => ({
    id, name, provider, endpoint: `http://localhost:${port}${path}`, method: "GET",
    priceUsdc, category, description, payoutAddress, firstParty: true, tier: 0,
  });
  return [
    s("gas-oracle", "Arc Gas Oracle", "Ovolyn Labs", 4021, "/gas", 0.001, "CHAIN_DATA",
      "Current Arc Testnet base fee and block height, denominated in USDC.",
      "0x705197b03726d10d220e06f2c097ff34727eb8d3"),
    s("usyc-nav", "USYC NAV Feed", "Meridian Data", 4022, "/nav", 0.004, "FINANCIAL_ANALYSIS",
      "Live USYC net asset value and implied yield, read from the Teller contract.",
      "0xf034096ea62322db6e15e9903cf9762c0e0a54f6"),
    s("treasury-signal", "Treasury Signal", "Halden Research", 4023, "/signal", 0.008, "FINANCIAL_ANALYSIS",
      "Allocation guidance for a stablecoin treasury: idle ratio, yield capture, FX exposure.",
      "0x43b53ec907ad9e1c7180f9e38d64e52b7f2250d8"),
    s("deep-analysis", "Deep Market Analysis", "Halden Research", 4024, "/deep", 0.05, "FINANCIAL_ANALYSIS",
      "Full market microstructure report. Priced above a conservative per-transaction limit.",
      "0x1ffb3e19926f228dd2cff357470907b5f85d3fb8"),
  ];
}

export function getListings(): Listing[] {
  const p = path();
  if (!existsSync(p)) {
    const listings = seed();
    writeFileSync(p, JSON.stringify(listings, null, 2));
    return listings;
  }
  try {
    return JSON.parse(readFileSync(p, "utf8")) as Listing[];
  } catch {
    return seed();
  }
}

function save(listings: Listing[]): void {
  writeFileSync(path(), JSON.stringify(listings, null, 2));
}

export function addListing(input: Omit<Listing, "tier" | "probe" | "firstParty">): Listing {
  const listings = getListings();
  const listing: Listing = { ...input, firstParty: false, tier: 0 };
  const i = listings.findIndex((l) => l.id === listing.id);
  if (i >= 0) listings[i] = { ...listings[i], ...listing };
  else listings.push(listing);
  save(listings);
  return listing;
}

/** Stores a probe result against a listing. */
export function recordProbe(id: string, result: ProbeResult): Listing | undefined {
  const listings = getListings();
  const listing = listings.find((l) => l.id === id);
  if (!listing) return undefined;
  listing.probe = result;
  save(listings);
  return listing;
}

/**
 * Tier-0 probe. Reads the 402 challenge without paying: a live endpoint must
 * refuse an unpaid request with a PAYMENT-REQUIRED header, and the amount it
 * quotes must match the advertised price.
 */
export async function probe(listing: Listing): Promise<ProbeResult> {
  const checkedAt = new Date().toISOString();
  try {
    const res = await fetch(listing.endpoint, { method: listing.method, signal: AbortSignal.timeout(8000) });
    const alive = true;
    const header = res.headers.get("payment-required");
    if (res.status !== 402 || !header) {
      return { checkedAt, alive, valid402: false, quotedUsdc: null, priceMatches: false, passed: false,
        note: `expected 402 with a PAYMENT-REQUIRED header, got ${res.status}` };
    }
    const decoded = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
    const accepts: { amount?: string; network?: string }[] = decoded.accepts ?? [];
    const arc = accepts.find((a) => a.network === "eip155:5042002") ?? accepts[0];
    const quotedUsdc = arc?.amount ? Number(arc.amount) / 1e6 : null;
    const priceMatches = quotedUsdc !== null && Math.abs(quotedUsdc - listing.priceUsdc) < 1e-9;
    return {
      checkedAt, alive, valid402: true, quotedUsdc, priceMatches,
      passed: priceMatches,
      note: priceMatches ? undefined : `quote $${quotedUsdc} does not match listed $${listing.priceUsdc}`,
    };
  } catch (e) {
    return { checkedAt, alive: false, valid402: false, quotedUsdc: null, priceMatches: false, passed: false,
      note: String(e).slice(0, 120) };
  }
}

/** Probes every listing and persists the results. */
export async function probeAll(): Promise<Listing[]> {
  const listings = getListings();
  const probed = await Promise.all(
    listings.map(async (l) => ({ ...l, probe: await probe(l) })),
  );
  save(probed);
  return probed;
}

/** What an agent sees when it looks at the market: only listings that pass. */
export function marketView(): Listing[] {
  return getListings()
    .filter((l) => l.probe?.passed !== false)
    .sort((a, b) => a.priceUsdc - b.priceUsdc);
}
