import { NextResponse } from "next/server";
import { issueChallenge, consumeChallenge, issueSession } from "@/lib/session";
import { findAccountByEmail, createAccount } from "@/lib/accounts";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Step 1 — send a one-time code to the address. */
export async function GET(req: Request) {
  const email = new URL(req.url).searchParams.get("email")?.toLowerCase();
  if (!email || !EMAIL.test(email)) {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  }
  const code = issueChallenge(email, "otp");
  // No mail provider is wired up on testnet; the code is logged and, outside
  // production, returned so the flow can be exercised end to end.
  console.log(`[auth] OTP for ${email}: ${code}`);
  return NextResponse.json({
    sent: true,
    ...(process.env.NODE_ENV !== "production" ? { devCode: code } : {}),
  });
}

/** Step 2 — verify the code, then open or resume the account. */
export async function POST(req: Request) {
  const { email, code } = await req.json();
  const addr = String(email ?? "").toLowerCase();
  if (!EMAIL.test(addr) || typeof code !== "string") {
    return NextResponse.json({ error: "email and code required" }, { status: 400 });
  }
  if (!consumeChallenge(addr, code)) {
    return NextResponse.json({ error: "wrong or expired code" }, { status: 401 });
  }
  const account = findAccountByEmail(addr) ?? createAccount({ email: addr, authMethod: "email" });
  await issueSession(account.id);
  return NextResponse.json({ account });
}
