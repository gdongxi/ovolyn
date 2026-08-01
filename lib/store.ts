import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { defaultAllowlist } from "./stalls";

const DATA_DIR = join(process.cwd(), "data");

export type Policy = {
  perTxLimitUsdc: number;
  dailyBudgetUsdc: number;
  allowlist: string[];
  /** Idle USDC above this stays in the spending wallet; the excess sweeps to yield. */
  idleThresholdUsdc: number;
};

export type LedgerEntry = {
  ts: string; // ISO
  type: "x402 spend" | "gateway deposit" | "faucet fund" | "blocked spend" | "usyc sweep" | "cctp deposit" | "fx swap";
  detail: string;
  amount: string; // signed, e.g. "-0.001000"
  status: "SETTLED" | "CONFIRMED" | "BLOCKED" | "FAILED";
  reason?: string;
  /** Arc tx hash when the movement reached the chain — renders as an explorer link. */
  txHash?: string;
};

const DEFAULT_POLICY: Policy = {
  perTxLimitUsdc: 0.01,
  dailyBudgetUsdc: 0.1,
  // Merchants the operator permits; the registry decides who exists, the
  // operator decides who their agent may trade with.
  allowlist: defaultAllowlist(),
  idleThresholdUsdc: 10,
};

// The ledger starts empty. Every row is written by an actual money movement
// executed through this app — nothing is seeded.
const EMPTY_LEDGER: LedgerEntry[] = [];

function file(name: string): string {
  mkdirSync(DATA_DIR, { recursive: true });
  return join(DATA_DIR, name);
}

function load<T>(name: string, fallback: T): T {
  const p = file(name);
  if (!existsSync(p)) return fallback;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function save(name: string, value: unknown): void {
  writeFileSync(file(name), JSON.stringify(value, null, 2));
}

export function getPolicy(): Policy {
  return { ...DEFAULT_POLICY, ...load<Partial<Policy>>("policy.json", {}) };
}

export function setPolicy(p: Policy): void {
  save("policy.json", p);
}

export function getLedger(): LedgerEntry[] {
  return load<LedgerEntry[]>("ledger.json", EMPTY_LEDGER);
}

export function appendLedger(entry: LedgerEntry): void {
  const ledger = getLedger();
  ledger.unshift(entry);
  save("ledger.json", ledger);
}

export function spentTodayUsdc(): number {
  const today = new Date().toISOString().slice(0, 10);
  return getLedger()
    .filter((e) => e.status === "SETTLED" && e.type === "x402 spend" && e.ts.startsWith(today))
    .reduce((sum, e) => sum + Math.abs(Number(e.amount)), 0);
}
