import { NextResponse } from "next/server";
import { getListings, probeAll } from "@/lib/registry";

export const maxDuration = 60;

/** The market as agents and operators see it. */
export async function GET() {
  return NextResponse.json(getListings());
}

/**
 * Re-probing is open, because the probe is the thing that keeps the market
 * honest and anyone should be able to make it run again.
 *
 * Listing is not here. It goes through /api/registry/sign, which makes the
 * provider sign for the payout address that will receive the money — the
 * market page says a signature is required, and this is where that is true.
 * An unsigned path also let a stranger take over a listing by reusing its id,
 * payout address and all.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body.action === "probe") {
    return NextResponse.json(await probeAll());
  }
  return NextResponse.json(
    { error: "list a service at /api/registry/sign — the payout address has to sign for it" },
    { status: 400 },
  );
}
