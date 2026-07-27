import { NextResponse } from "next/server";
import { currentAccountId } from "@/lib/session";
import {
  listAgents, issueAgentKey, setAgentAllowance, revokeAgent, getAccount, redeemPairingCode,
} from "@/lib/accounts";

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

/**
 * An agent registers itself here, redeeming the one-time pairing code its
 * owner handed it. No session is involved — the agent is not a human and has
 * none — but it cannot attach to an account without an invitation, and it
 * cannot create one.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const code = String(body.pairingCode ?? "");
  if (!code) {
    return NextResponse.json(
      { error: "pairingCode required — ask your owner to issue one from their account page" },
      { status: 401 },
    );
  }
  const accountId = redeemPairingCode(code);
  if (!accountId || !getAccount(accountId)) {
    return NextResponse.json({ error: "pairing code is unknown, already used, or expired" }, { status: 401 });
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
