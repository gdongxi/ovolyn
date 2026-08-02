import { NextResponse } from "next/server";
import { verifyMessage } from "viem";
import { issueChallenge, consumeChallenge } from "@/lib/session";
import { addListing, probe, recordProbe, getListings } from "@/lib/registry";

/**
 * Listing a service is permissionless, but a payout address has to be proven.
 * The provider signs a statement naming the endpoint and the price, so the
 * listing is bound to the address that will receive the money — an agent
 * without the key cannot produce one.
 */

function statement(fields: {
  address: string;
  id: string;
  endpoint: string;
  priceUsdc: string;
  nonce: string;
}): string {
  return [
    "Ovolyn — list a service",
    "",
    `Payout address: ${fields.address}`,
    `Service id: ${fields.id}`,
    `Endpoint: ${fields.endpoint}`,
    `Price: $${fields.priceUsdc} USDC per call`,
    "",
    "Signing proves this payout address is mine.",
    `Nonce: ${fields.nonce}`,
  ].join("\n");
}

/** Step 1 — the exact words the provider must sign. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const address = q.get("address");
  const id = q.get("id");
  const endpoint = q.get("endpoint");
  const priceUsdc = q.get("priceUsdc");
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address) || !id || !endpoint || !priceUsdc) {
    return NextResponse.json({ error: "address, id, endpoint and priceUsdc required" }, { status: 400 });
  }
  const nonce = issueChallenge(`listing:${address.toLowerCase()}`, "nonce");
  return NextResponse.json({ message: statement({ address, id, endpoint, priceUsdc, nonce }), nonce });
}

/** Step 2 — verify, list, then probe. The probe decides the tier. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { address, message, signature } = body;
  if (typeof address !== "string" || typeof message !== "string" || typeof signature !== "string") {
    return NextResponse.json({ error: "address, message and signature required" }, { status: 400 });
  }

  const nonce = message.match(/^Nonce: (.+)$/m)?.[1];
  if (!nonce || !consumeChallenge(`listing:${address.toLowerCase()}`, nonce)) {
    return NextResponse.json({ error: "unknown or expired nonce" }, { status: 401 });
  }
  const valid = await verifyMessage({
    address: address as `0x${string}`,
    message,
    signature: signature as `0x${string}`,
  }).catch(() => false);
  if (!valid) return NextResponse.json({ error: "signature verification failed" }, { status: 401 });

  const id = String(body.id ?? "").trim();
  if (!id || getListings().some((l) => l.id === id && l.firstParty)) {
    return NextResponse.json({ error: "invalid or reserved service id" }, { status: 400 });
  }

  let listing;
  try {
    listing = addListing({
      id,
      name: String(body.name ?? id).slice(0, 60),
      provider: String(body.provider ?? "Independent").slice(0, 60),
      endpoint: String(body.endpoint ?? ""),
      method: body.method === "POST" ? "POST" : "GET",
      priceUsdc: Number(body.priceUsdc),
      category: String(body.category ?? "OTHER").slice(0, 40),
      description: String(body.description ?? "").slice(0, 240),
      payoutAddress: address.toLowerCase(),
    });
  } catch (e) {
    // An unreachable address is the provider's mistake, not a server fault.
    return NextResponse.json({ error: String((e as Error).message) }, { status: 400 });
  }

  // No human reviews this — the probe does.
  const result = await probe(listing);
  const listed = recordProbe(listing.id, result) ?? { ...listing, probe: result };
  return NextResponse.json({ listing: listed, probe: result }, { status: 201 });
}
