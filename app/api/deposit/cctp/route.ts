import { NextResponse } from "next/server";
import { cctpDeposit } from "@/lib/cctp";

export const maxDuration = 600;

export async function POST(req: Request) {
  const { amountUsdc } = await req.json();
  const amount = Number(amountUsdc);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10) {
    return NextResponse.json({ error: "invalid amount" }, { status: 400 });
  }
  const result = await cctpDeposit(amount);
  return NextResponse.json(result, { status: result.outcome === "ERROR" ? 500 : 200 });
}
