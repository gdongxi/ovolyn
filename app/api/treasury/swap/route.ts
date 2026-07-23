import { NextResponse } from "next/server";
import { fxRebalance } from "@/lib/fx";

export const maxDuration = 300;

export async function POST(req: Request) {
  const { amountUsdc } = await req.json();
  const amount = Number(amountUsdc);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 50) {
    return NextResponse.json({ error: "invalid amount" }, { status: 400 });
  }
  const result = await fxRebalance(amount);
  return NextResponse.json(result, { status: result.outcome === "ERROR" ? 500 : 200 });
}
