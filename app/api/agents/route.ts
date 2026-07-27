import { NextResponse } from "next/server";
import { currentAccountId } from "@/lib/session";
import { listAgents, issueAgentKey, setAgentAllowance, revokeAgent, getAccount } from "@/lib/accounts";

/**
 * Agent identities. An agent may register itself here against an account that
 * already exists — but it lands with a zero allowance. Turning it into a
 * spending agent is the owner's act (PATCH), performed from a session that
 * proves a human authenticated.
 */

export async function GET() {
  const accountId = await currentAccountId();
  if (!accountId) return NextResponse.json({ error: "sign in first" }, { status: 401 });
  return NextResponse.json(listAgents(accountId));
}

/** Register an agent. Requires an existing account; grants nothing. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  // Either the owner is signed in, or the caller names the account it attaches
  // to — the account must already exist. There is no path that creates one.
  const sessionAccount = await currentAccountId();
  const accountId = sessionAccount ?? String(body.accountId ?? "");
  if (!accountId || !getAccount(accountId)) {
    return NextResponse.json(
      { error: "no such account — an account must be opened by its owner before an agent can register" },
      { status: 404 },
    );
  }
  const name = String(body.name ?? "agent").slice(0, 40);
  const { agent, key } = issueAgentKey(accountId, name);
  return NextResponse.json(
    {
      agent,
      key,
      notice: "Store this key now — it is not shown again. The agent cannot spend until its owner grants an allowance.",
    },
    { status: 201 },
  );
}

/** The owner grants (or changes) an allowance, or revokes the agent. */
export async function PATCH(req: Request) {
  const accountId = await currentAccountId();
  if (!accountId) return NextResponse.json({ error: "sign in first" }, { status: 401 });

  const { agentId, perTxLimitUsdc, dailyBudgetUsdc, revoke } = await req.json();
  const owned = listAgents(accountId).some((a) => a.id === agentId);
  if (!owned) return NextResponse.json({ error: "agent not found on this account" }, { status: 404 });

  if (revoke) {
    revokeAgent(agentId);
    return NextResponse.json({ revoked: true });
  }
  const perTx = Number(perTxLimitUsdc);
  const daily = Number(dailyBudgetUsdc);
  if (!Number.isFinite(perTx) || !Number.isFinite(daily) || perTx < 0 || daily < 0) {
    return NextResponse.json({ error: "invalid allowance" }, { status: 400 });
  }
  return NextResponse.json(setAgentAllowance(agentId, { perTxLimitUsdc: perTx, dailyBudgetUsdc: daily }));
}
