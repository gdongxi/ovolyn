import { NextResponse } from "next/server";
import { getPolicy, setPolicy, type Policy } from "@/lib/store";

export async function GET() {
  return NextResponse.json(getPolicy());
}

export async function POST(req: Request) {
  const body = await req.json();
  const current = getPolicy();
  const next: Policy = {
    perTxLimitUsdc: Number(body.perTxLimitUsdc ?? current.perTxLimitUsdc),
    dailyBudgetUsdc: Number(body.dailyBudgetUsdc ?? current.dailyBudgetUsdc),
    allowlist: Array.isArray(body.allowlist) ? body.allowlist : current.allowlist,
  };
  if (!Number.isFinite(next.perTxLimitUsdc) || !Number.isFinite(next.dailyBudgetUsdc)) {
    return NextResponse.json({ error: "invalid numbers" }, { status: 400 });
  }
  setPolicy(next);
  return NextResponse.json(next);
}
