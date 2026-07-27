import { NextResponse } from "next/server";
import { verifyMessage } from "viem";
import { issueChallenge, consumeChallenge, issueSession } from "@/lib/session";
import { findAccountByAddress, createAccount } from "@/lib/accounts";

/**
 * Sign-In With Ethereum. The signature is the human act that roots an
 * account's authority — there is deliberately no way for an agent to
 * produce one on the owner's behalf.
 *
 * Verified with viem rather than the siwe package, which pulls in ethers as
 * a peer; the message is composed here so its shape stays explicit.
 */

const DOMAIN = process.env.SIWE_DOMAIN ?? "localhost:3000";
const STATEMENT = "Sign in to Ovolyn — the autonomous bank for AI agents.";

export function buildMessage(address: string, nonce: string, issuedAt: string): string {
  return [
    `${DOMAIN} wants you to sign in with your Ethereum account:`,
    address,
    "",
    STATEMENT,
    "",
    `URI: http://${DOMAIN}`,
    "Version: 1",
    "Chain ID: 5042002",
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
}

/** Step 1 — hand out a nonce and the exact message the wallet must sign. */
export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address");
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "valid address required" }, { status: 400 });
  }
  const nonce = issueChallenge(address.toLowerCase(), "nonce");
  const issuedAt = new Date().toISOString();
  return NextResponse.json({ nonce, issuedAt, message: buildMessage(address, nonce, issuedAt) });
}

/** Step 2 — verify the signature, then open or resume the account. */
export async function POST(req: Request) {
  const { address, message, signature } = await req.json().catch(() => ({}));
  if (typeof address !== "string" || typeof message !== "string" || typeof signature !== "string") {
    return NextResponse.json({ error: "address, message and signature required" }, { status: 400 });
  }

  const nonce = message.match(/^Nonce: (.+)$/m)?.[1];
  if (!nonce || !consumeChallenge(address.toLowerCase(), nonce)) {
    return NextResponse.json({ error: "unknown or expired nonce" }, { status: 401 });
  }

  const valid = await verifyMessage({
    address: address as `0x${string}`,
    message,
    signature: signature as `0x${string}`,
  }).catch(() => false);
  if (!valid) return NextResponse.json({ error: "signature verification failed" }, { status: 401 });

  const account =
    findAccountByAddress(address) ?? createAccount({ address, authMethod: "siwe" });
  await issueSession(account.id);
  return NextResponse.json({ account });
}
