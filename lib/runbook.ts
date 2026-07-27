import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { cctpDeposit } from "./cctp";
import { evaluateAutoSweep, sweepToUsyc } from "./treasury";
import { agentSpend } from "./agent";
import { walletUsdc } from "./arc";
import { getPolicy } from "./store";

/**
 * "Run the bank" — the four money flows executed as one narratable sequence:
 * money arrives, idle money goes to work, the agent spends within policy, and
 * the policy stops it when it steps out of bounds.
 */

export type StageId = "deposit" | "sweep" | "spend" | "block";
export type StageState = "pending" | "running" | "done" | "skipped" | "failed";

export type Stage = {
  id: StageId;
  title: string;
  caption: string;
  state: StageState;
  detail?: string;
  txHash?: string;
  startedAt?: string;
  endedAt?: string;
};

export type Run = {
  id: string;
  startedAt: string;
  endedAt?: string;
  state: "running" | "done" | "failed";
  stages: Stage[];
};

const RUN_FILE = "run.json";
const DATA_DIR = join(process.cwd(), "data");

const DEPOSIT_USDC = 2;
const STALL = process.env.STALL_URL ?? "http://localhost:4021";

function blank(): Stage[] {
  return [
    { id: "deposit", title: "Deposit", caption: `${DEPOSIT_USDC} USDC from Sepolia via CCTP V2`, state: "pending" },
    { id: "sweep", title: "Earn", caption: "Idle above threshold sweeps into USYC", state: "pending" },
    { id: "spend", title: "Spend", caption: "Agent buys a service within policy", state: "pending" },
    { id: "block", title: "Govern", caption: "Agent tries an over-limit purchase", state: "pending" },
  ];
}

function path(): string {
  mkdirSync(DATA_DIR, { recursive: true });
  return join(DATA_DIR, RUN_FILE);
}

export function readRun(): Run | null {
  const p = path();
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as Run;
  } catch {
    return null;
  }
}

function write(run: Run): void {
  writeFileSync(path(), JSON.stringify(run, null, 2));
}

function update(run: Run, id: StageId, patch: Partial<Stage>): void {
  const stage = run.stages.find((s) => s.id === id)!;
  Object.assign(stage, patch);
  write(run);
}

/** Runs the four stages in order, persisting progress so the console can poll. */
async function execute(run: Run): Promise<void> {
  // 1 · money arrives from another chain
  update(run, "deposit", { state: "running", startedAt: new Date().toISOString() });
  const deposit = await cctpDeposit(DEPOSIT_USDC);
  if (deposit.outcome !== "DEPOSITED") {
    update(run, "deposit", { state: "failed", detail: deposit.reason, endedAt: new Date().toISOString() });
    run.state = "failed";
    run.endedAt = new Date().toISOString();
    write(run);
    return;
  }
  update(run, "deposit", {
    state: "done",
    detail: `${DEPOSIT_USDC} USDC minted on Arc · burn ${deposit.burnTx?.slice(0, 10)}…`,
    txHash: deposit.mintTx,
    endedAt: new Date().toISOString(),
  });

  // 2 · idle money goes to work
  update(run, "sweep", { state: "running", startedAt: new Date().toISOString() });
  const policy = getPolicy();
  const idle = Number(await walletUsdc());
  const decision = evaluateAutoSweep(idle, policy.idleThresholdUsdc);
  if (decision.action === "HOLD") {
    update(run, "sweep", { state: "skipped", detail: decision.reason, endedAt: new Date().toISOString() });
  } else {
    const swept = await sweepToUsyc(decision.amount);
    update(run, "sweep", {
      state: swept.outcome === "SWEPT" ? "done" : "failed",
      detail:
        swept.outcome === "SWEPT"
          ? `idle ${decision.idle.toFixed(2)} > threshold ${decision.threshold.toFixed(2)} — swept ${decision.amount} USDC, minted ${swept.mintedUsyc} USYC`
          : swept.reason,
      txHash: swept.depositTx,
      endedAt: new Date().toISOString(),
    });
  }

  // 3 · the agent spends, within policy
  update(run, "spend", { state: "running", startedAt: new Date().toISOString() });
  const spend = await agentSpend(`${STALL}/oracle`, "market insight");
  update(run, "spend", {
    state: spend.outcome === "SETTLED" ? "done" : "failed",
    detail:
      spend.outcome === "SETTLED"
        ? `paid $${spend.priceUsdc} to an independent merchant · settled through Gateway`
        : (spend.reason ?? "spend failed"),
    endedAt: new Date().toISOString(),
  });

  // 4 · the policy stops it when it steps out of bounds
  update(run, "block", { state: "running", startedAt: new Date().toISOString() });
  const blocked = await agentSpend(`${STALL}/deep-analysis`, "deep analysis");
  update(run, "block", {
    // A refusal is the intended outcome here — the gate did its job.
    state: blocked.outcome === "BLOCKED" ? "done" : "failed",
    detail:
      blocked.outcome === "BLOCKED"
        ? `refused — ${blocked.reason}`
        : `expected a refusal, got ${blocked.outcome}`,
    endedAt: new Date().toISOString(),
  });

  run.state = "done";
  run.endedAt = new Date().toISOString();
  write(run);
}

export function startRun(): Run {
  const existing = readRun();
  if (existing?.state === "running") return existing;

  const run: Run = {
    id: `run-${Date.now()}`,
    startedAt: new Date().toISOString(),
    state: "running",
    stages: blank(),
  };
  write(run);
  // Detached on purpose: the console polls the run file for progress.
  void execute(run).catch((e) => {
    run.state = "failed";
    run.endedAt = new Date().toISOString();
    const running = run.stages.find((s) => s.state === "running");
    if (running) Object.assign(running, { state: "failed", detail: String(e).slice(0, 200) });
    write(run);
  });
  return run;
}
