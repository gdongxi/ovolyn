import { NextResponse } from "next/server";
import { currentAccountId } from "./session";
import { getAccount } from "./accounts";

/**
 * Who is allowed to move money.
 *
 * Reading is public: balances, the market, the ledger and the authority chain
 * are all open, because the whole claim is that anyone can audit this bank.
 * Writing is not. On a public host every unauthenticated money route is an
 * invitation to drain the demo treasury, and `/api/policy` is worse than that
 * — the product's entire argument is that policy holds, so policy that a
 * stranger can rewrite is no argument at all.
 *
 * Operators are named in OPERATOR_ALLOWLIST (comma-separated addresses or
 * emails). With the list unset — a local checkout — any signed-in account
 * qualifies, and if there is no session at all the guard falls back to open
 * so `npm run dev` behaves as it always has.
 */

function allowlist(): string[] {
  return (process.env.OPERATOR_ALLOWLIST ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export type Denial = NextResponse | null;

/** Returns a 401/403 response when the caller may not spend, otherwise null. */
export async function requireOperator(): Promise<Denial> {
  const list = allowlist();

  // Unconfigured and running locally: keep the console usable out of the box.
  if (list.length === 0 && process.env.NODE_ENV !== "production") return null;

  const accountId = await currentAccountId();
  if (!accountId) {
    return NextResponse.json(
      { error: "sign in to operate this account — reading stays open to everyone" },
      { status: 401 },
    );
  }
  if (list.length === 0) return null;

  const account = getAccount(accountId);
  const identity = (account?.address ?? account?.email ?? "").toLowerCase();
  if (!identity || !list.includes(identity)) {
    return NextResponse.json(
      { error: "this account may read the bank but not move its money" },
      { status: 403 },
    );
  }
  return null;
}

/** True when the current visitor may move money — for rendering, not enforcement. */
export async function isOperator(): Promise<boolean> {
  return (await requireOperator()) === null;
}
