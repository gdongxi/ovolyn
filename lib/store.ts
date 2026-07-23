import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "data");

export type Policy = {
  perTxLimitUsdc: number;
  dailyBudgetUsdc: number;
  allowlist: string[];
};

export type LedgerEntry = {
  ts: string; // ISO
  type: "x402 spend" | "gateway deposit" | "faucet fund" | "blocked spend" | "usyc sweep" | "cctp deposit";
  detail: string;
  amount: string; // signed, e.g. "-0.001000"
  status: "SETTLED" | "CONFIRMED" | "BLOCKED";
  reason?: string;
};

const DEFAULT_POLICY: Policy = {
  perTxLimitUsdc: 0.01,
  dailyBudgetUsdc: 0.1,
  allowlist: ["http://localhost:4021"],
};

// Real events from the first on-chain session (2026-07-23).
const SEED_LEDGER: LedgerEntry[] = [
  {
    ts: "2026-07-23T04:31:00Z",
    type: "x402 spend",
    detail: "ovolyn-demo-stall /oracle · eip155:5042002",
    amount: "-0.001000",
    status: "SETTLED",
  },
  {
    ts: "2026-07-23T04:24:00Z",
    type: "gateway deposit",
    detail: "direct on-chain · instant finality",
    amount: "-5.000000",
    status: "CONFIRMED",
  },
  {
    ts: "2026-07-23T04:21:00Z",
    type: "faucet fund",
    detail: "Circle testnet faucet",
    amount: "+20.000000",
    status: "CONFIRMED",
  },
];

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
  return load<Policy>("policy.json", DEFAULT_POLICY);
}

export function setPolicy(p: Policy): void {
  save("policy.json", p);
}

export function getLedger(): LedgerEntry[] {
  return load<LedgerEntry[]>("ledger.json", SEED_LEDGER);
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
