import { NextResponse } from "next/server";
import { requireOperator } from "@/lib/guard";
import { evaluateAutoSweep, sweepToUsyc } from "@/lib/treasury";
import { walletUsdc } from "@/lib/arc";
import { getPolicy } from "@/lib/store";

export const maxDuration = 300;

/** Evaluate the idle-threshold rule and sweep the excess if it triggers. */
export async function POST() {
  const denied = await requireOperator();
  if (denied) return denied;

  const [idleRaw, policy] = await Promise.all([walletUsdc(), Promise.resolve(getPolicy())]);
  const idle = Number(idleRaw);
  if (!Number.isFinite(idle)) {
    return NextResponse.json({ error: "idle balance unavailable" }, { status: 503 });
  }
  const decision = evaluateAutoSweep(idle, policy.idleThresholdUsdc);
  if (decision.action === "HOLD") {
    return NextResponse.json({ decision });
  }
  const result = await sweepToUsyc(decision.amount);
  return NextResponse.json({ decision, result }, { status: result.outcome === "ERROR" ? 500 : 200 });
}
