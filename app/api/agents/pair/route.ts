import { NextResponse } from "next/server";
import { currentAccountId } from "@/lib/session";
import { issuePairingCode } from "@/lib/accounts";

/**
 * The owner's invitation for an agent to register itself. Issued only from an
 * authenticated human session — this is the point where human authority is
 * handed down to a machine, so it cannot be self-served by the machine.
 */
export async function POST() {
  const accountId = await currentAccountId();
  if (!accountId) return NextResponse.json({ error: "sign in first" }, { status: 401 });

  const pairing = issuePairingCode(accountId);
  const base = process.env.OVOLYN_URL ?? "http://localhost:3000";
  return NextResponse.json({
    code: pairing.code,
    expiresAt: new Date(pairing.expiresAt).toISOString(),
    command: `npx ovolyn connect ${pairing.code}`,
    prompt: `Register yourself with my Ovolyn account by running: npx ovolyn connect ${pairing.code} --url ${base}`,
  });
}
