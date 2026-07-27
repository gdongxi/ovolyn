import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/** Owner sessions: short-lived cookies proving a human authenticated. */

const COOKIE = "ovolyn_session";
const TTL = "7d";

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET not configured");
  return new TextEncoder().encode(s);
}

export async function issueSession(accountId: string): Promise<void> {
  const token = await new SignJWT({ accountId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TTL)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function currentAccountId(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return (payload.accountId as string) ?? null;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/* ---------- one-time challenges: SIWE nonces and email OTPs ---------- */

type Challenge = { value: string; subject: string; expiresAt: number };
const DATA_DIR = join(process.cwd(), "data");
const FILE = "challenges.json";

function path(): string {
  mkdirSync(DATA_DIR, { recursive: true });
  return join(DATA_DIR, FILE);
}

function load(): Challenge[] {
  const p = path();
  if (!existsSync(p)) return [];
  try {
    return (JSON.parse(readFileSync(p, "utf8")) as Challenge[]).filter((c) => c.expiresAt > Date.now());
  } catch {
    return [];
  }
}

function save(list: Challenge[]): void {
  writeFileSync(path(), JSON.stringify(list, null, 2));
}

export function issueChallenge(subject: string, kind: "nonce" | "otp"): string {
  const value = kind === "nonce"
    ? randomBytes(16).toString("hex")
    : String(Math.floor(100000 + Math.random() * 900000));
  const list = load().filter((c) => c.subject !== subject);
  list.push({ value, subject, expiresAt: Date.now() + 10 * 60 * 1000 });
  save(list);
  return value;
}

/** Single-use: a consumed challenge is removed whether or not it matched. */
export function consumeChallenge(subject: string, value: string): boolean {
  const list = load();
  const i = list.findIndex((c) => c.subject === subject);
  if (i < 0) return false;
  const ok = list[i].value === value;
  list.splice(i, 1);
  save(list);
  return ok;
}
