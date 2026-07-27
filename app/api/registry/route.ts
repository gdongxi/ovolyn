import { NextResponse } from "next/server";
import { getListings, addListing, probeAll } from "@/lib/registry";

export const maxDuration = 60;

/** The market as agents and operators see it. */
export async function GET() {
  return NextResponse.json(getListings());
}

/** Permissionless listing — no human approval, the probe decides the tier. */
export async function POST(req: Request) {
  const body = await req.json();
  if (body.action === "probe") {
    return NextResponse.json(await probeAll());
  }
  const required = ["id", "name", "provider", "endpoint", "priceUsdc", "payoutAddress"];
  const missing = required.filter((k) => !body[k]);
  if (missing.length) {
    return NextResponse.json({ error: `missing: ${missing.join(", ")}` }, { status: 400 });
  }
  const listing = addListing({
    id: String(body.id),
    name: String(body.name),
    provider: String(body.provider),
    endpoint: String(body.endpoint),
    method: body.method === "POST" ? "POST" : "GET",
    priceUsdc: Number(body.priceUsdc),
    category: String(body.category ?? "OTHER"),
    description: String(body.description ?? ""),
    payoutAddress: String(body.payoutAddress),
  });
  return NextResponse.json(listing, { status: 201 });
}
