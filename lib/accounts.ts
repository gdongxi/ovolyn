import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomBytes, createHash } from "node:crypto";

/**
 * Accounts, agents and the authority chain between them.
 *
 * A human opens the account; the account issues an agent's credential; the
 * agent spends inside limits the human set. Accounts are therefore created
 * only by an authenticated human (wallet signature or email OTP), while an
 * agent may register itself against an existing account — but lands with a
 * zero allowance until its owner sets a policy.
 */

export type AuthMethod = "siwe" | "email";

export type Account = {
  id: string;
  createdAt: string;
  /** Exactly one of these identifies the owner. */
  address?: string;
  email?: string;
  authMethod: AuthMethod;
  /** Payout address bound by signature; required before listing a service. */
  payoutAddress?: string;
};

export type AgentRecord = {
  id: string;
  accountId: string;
  name: string;
  createdAt: string;
  /** Only the hash is stored — the key is shown once, at creation. */
  keyHash: string;
  revokedAt?: string;
  /** A freshly registered agent may authenticate and read, but not spend. */
  allowance: {
    perTxLimitUsdc: number;
    dailyBudgetUsdc: number;
    /** False until the owner explicitly grants spending. */
    activated: boolean;
  };
  lastUsedAt?: string;
};

/**
 * A one-time code the owner hands to their agent so the agent can register
 * itself. Without it, knowing an account id would be enough to attach agents
 * to someone else's account.
 */
export type PairingCode = {
  code: string;
  accountId: string;
  createdAt: string;
  expiresAt: number;
  usedAt?: string;
};

type Db = { accounts: Account[]; agents: AgentRecord[]; pairings?: PairingCode[] };

const DATA_DIR = join(process.cwd(), "data");
const FILE = "accounts.json";

function path(): string {
  mkdirSync(DATA_DIR, { recursive: true });
  return join(DATA_DIR, FILE);
}

function load(): Db {
  const p = path();
  if (!existsSync(p)) return { accounts: [], agents: [] };
  try {
    return JSON.parse(readFileSync(p, "utf8")) as Db;
  } catch {
    return { accounts: [], agents: [] };
  }
}

function save(db: Db): void {
  writeFileSync(path(), JSON.stringify(db, null, 2));
}

const id = (prefix: string): string => `${prefix}_${randomBytes(9).toString("hex")}`;
const hash = (s: string): string => createHash("sha256").update(s).digest("hex");

/* ---------- accounts (human-created only) ---------- */

export function findAccountByAddress(address: string): Account | undefined {
  return load().accounts.find((a) => a.address?.toLowerCase() === address.toLowerCase());
}

export function findAccountByEmail(email: string): Account | undefined {
  return load().accounts.find((a) => a.email?.toLowerCase() === email.toLowerCase());
}

export function getAccount(accountId: string): Account | undefined {
  return load().accounts.find((a) => a.id === accountId);
}

/**
 * Called only from an authenticated human flow (verified signature or OTP).
 * There is deliberately no agent-facing path to this function.
 */
export function createAccount(input: { address?: string; email?: string; authMethod: AuthMethod }): Account {
  const db = load();
  const account: Account = {
    id: id("acct"),
    createdAt: new Date().toISOString(),
    address: input.address?.toLowerCase(),
    email: input.email?.toLowerCase(),
    authMethod: input.authMethod,
    // Signing in with a wallet already proves this address; it doubles as the
    // payout address if the owner later lists a service.
    payoutAddress: input.authMethod === "siwe" ? input.address?.toLowerCase() : undefined,
  };
  db.accounts.push(account);
  save(db);
  return account;
}

export function bindPayoutAddress(accountId: string, address: string): Account | undefined {
  const db = load();
  const account = db.accounts.find((a) => a.id === accountId);
  if (!account) return undefined;
  account.payoutAddress = address.toLowerCase();
  save(db);
  return account;
}

/* ---------- agents (may self-register, start powerless) ---------- */

export function listAgents(accountId: string): AgentRecord[] {
  return load().agents.filter((a) => a.accountId === accountId && !a.revokedAt);
}

/** Live agents across every account — for the public stats line. */
export function countAgents(): number {
  return load().agents.filter((a) => !a.revokedAt).length;
}

/* ---------- pairing: the owner's invitation for an agent to register ---------- */

/** Issued from an authenticated owner session; valid for 15 minutes, single use. */
export function issuePairingCode(accountId: string): PairingCode {
  const db = load();
  const pairing: PairingCode = {
    // Short and readable — it is meant to be pasted into a prompt.
    code: `pair_${randomBytes(6).toString("hex")}`,
    accountId,
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + 15 * 60 * 1000,
  };
  db.pairings = [...(db.pairings ?? []).filter((p) => p.expiresAt > Date.now() && !p.usedAt), pairing];
  save(db);
  return pairing;
}

/** Redeems a code and returns the account it grants access to register against. */
export function redeemPairingCode(code: string): string | undefined {
  const db = load();
  const pairing = (db.pairings ?? []).find((p) => p.code === code && !p.usedAt && p.expiresAt > Date.now());
  if (!pairing) return undefined;
  pairing.usedAt = new Date().toISOString();
  save(db);
  return pairing.accountId;
}

/* ---------- agent keys ---------- */

/** Returns the plaintext key exactly once; only its hash is persisted. */
export function issueAgentKey(accountId: string, name: string): { agent: AgentRecord; key: string } {
  const db = load();
  const key = `ovk_${randomBytes(24).toString("hex")}`;
  const agent: AgentRecord = {
    id: id("agent"),
    accountId,
    name,
    createdAt: new Date().toISOString(),
    keyHash: hash(key),
    // Zero allowance on purpose: registration is delegated, spending is granted.
    allowance: { perTxLimitUsdc: 0, dailyBudgetUsdc: 0, activated: false },
  };
  db.agents.push(agent);
  save(db);
  return { agent, key };
}

/** The owner's act that turns a registered agent into a spending one. */
export function setAgentAllowance(
  agentId: string,
  allowance: { perTxLimitUsdc: number; dailyBudgetUsdc: number },
): AgentRecord | undefined {
  const db = load();
  const agent = db.agents.find((a) => a.id === agentId);
  if (!agent) return undefined;
  agent.allowance = { ...allowance, activated: allowance.perTxLimitUsdc > 0 && allowance.dailyBudgetUsdc > 0 };
  save(db);
  return agent;
}

export function revokeAgent(agentId: string): boolean {
  const db = load();
  const agent = db.agents.find((a) => a.id === agentId);
  if (!agent) return false;
  agent.revokedAt = new Date().toISOString();
  save(db);
  return true;
}

/** Resolves a bearer key to a live agent, recording use. */
export function authenticateAgent(key: string): AgentRecord | undefined {
  const db = load();
  const agent = db.agents.find((a) => a.keyHash === hash(key) && !a.revokedAt);
  if (!agent) return undefined;
  agent.lastUsedAt = new Date().toISOString();
  save(db);
  return agent;
}
