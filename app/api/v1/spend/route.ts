import { NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/accounts";
import { agentSpend } from "@/lib/agent";

/**
 * The agent-facing spend endpoint.
 *
 * An agent presents its key and *requests* a purchase. It never holds funds:
 * the bank executes the payment after the request clears the agent's own
 * allowance and then the account policy. A refusal is a normal answer, not an
 * error — it comes back with a reason the agent can reason about.
 */
export const maxDuration = 120;

function bearer(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

export async function POST(req: Request) {
  const key = bearer(req);
  if (!key) return NextResponse.json({ error: "Bearer agent key required" }, { status: 401 });

  const agent = authenticateAgent(key);
  if (!agent) return NextResponse.json({ error: "invalid or revoked agent key" }, { status: 401 });

  if (!agent.allowance.activated) {
    return NextResponse.json(
      {
        outcome: "BLOCKED",
        reason: "this agent has no allowance yet — its owner must grant one before it can spend",
      },
      { status: 200 },
    );
  }

  const { url, label } = await req.json().catch(() => ({}));
  if (typeof url !== "string" || !/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  const result = await agentSpend(url, `${label ?? "agent request"} · ${agent.name}`, {
    perTxLimitUsdc: agent.allowance.perTxLimitUsdc,
  });
  return NextResponse.json(result);
}
