import { NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/accounts";
import { getPolicy, spentTodayUsdc } from "@/lib/store";
import { gatewayUsdc } from "@/lib/arc";

/** What an agent is allowed to know: its own limits and what is left. */
export async function GET(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!key) return NextResponse.json({ error: "Bearer agent key required" }, { status: 401 });

  const agent = authenticateAgent(key);
  if (!agent) return NextResponse.json({ error: "invalid or revoked agent key" }, { status: 401 });

  const policy = getPolicy();
  const spentToday = spentTodayUsdc();
  const perTx = agent.allowance.activated
    ? Math.min(policy.perTxLimitUsdc, agent.allowance.perTxLimitUsdc)
    : 0;
  const daily = agent.allowance.activated
    ? Math.min(policy.dailyBudgetUsdc, agent.allowance.dailyBudgetUsdc)
    : 0;

  return NextResponse.json({
    agent: { id: agent.id, name: agent.name, activated: agent.allowance.activated },
    spendableUsdc: Number(await gatewayUsdc()) || 0,
    perTxLimitUsdc: perTx,
    dailyBudgetUsdc: daily,
    spentTodayUsdc: spentToday,
    remainingTodayUsdc: Math.max(0, daily - spentToday),
    allowedMerchants: policy.allowlist,
  });
}
