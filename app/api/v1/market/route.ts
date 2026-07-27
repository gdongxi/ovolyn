import { NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/accounts";
import { marketView } from "@/lib/registry";

/** The market as the agent sees it: listings that pass the probe. */
export async function GET(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!key) return NextResponse.json({ error: "Bearer agent key required" }, { status: 401 });
  if (!authenticateAgent(key)) {
    return NextResponse.json({ error: "invalid or revoked agent key" }, { status: 401 });
  }

  const q = new URL(req.url).searchParams.get("q")?.toLowerCase();
  const listings = marketView()
    .filter((l) => !q || `${l.name} ${l.description} ${l.category}`.toLowerCase().includes(q))
    .map((l) => ({
      id: l.id,
      name: l.name,
      provider: l.provider,
      endpoint: l.endpoint,
      priceUsdc: l.priceUsdc,
      category: l.category,
      description: l.description,
      tier: l.tier,
      firstParty: l.firstParty,
    }));
  return NextResponse.json({ listings });
}
