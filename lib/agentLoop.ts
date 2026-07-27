import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { chatJson, type ChatMessage } from "./llm";
import { marketView, type Listing } from "./registry";
import { agentSpend } from "./agent";
import { gatewayUsdc } from "./arc";
import { getPolicy, spentTodayUsdc } from "./store";

/**
 * The autonomy loop.
 *
 * The model decides *what to try*; it never moves money. Every purchase it
 * proposes goes through the same four gates as a human-initiated spend
 * (allowlist → live quote → per-tx limit → daily budget), enforced server-side.
 * A refusal comes back as a structured reason the model must reason about —
 * downgrade, abort, or escalate — which is where the behaviour stops being a
 * script and starts being a decision.
 */

export type Decision = {
  action: "buy" | "stop";
  serviceId?: string;
  reasoning: string;
  /** Set when the model decides the goal cannot be met within policy. */
  escalate?: string;
};

export type Step = {
  n: number;
  at: string;
  decision: Decision;
  outcome?: "SETTLED" | "BLOCKED" | "ERROR" | "STOPPED";
  reason?: string;
  priceUsdc?: number;
  data?: unknown;
};

export type LoopRun = {
  id: string;
  goal: string;
  startedAt: string;
  endedAt?: string;
  state: "running" | "done" | "failed";
  steps: Step[];
  spentUsdc: number;
  summary?: string;
};

const DATA_DIR = join(process.cwd(), "data");
const FILE = "agentloop.json";
const MAX_STEPS = 5;

function path(): string {
  mkdirSync(DATA_DIR, { recursive: true });
  return join(DATA_DIR, FILE);
}

export function readLoop(): LoopRun | null {
  const p = path();
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as LoopRun;
  } catch {
    return null;
  }
}

function write(run: LoopRun): void {
  writeFileSync(path(), JSON.stringify(run, null, 2));
}

const SYSTEM = `You are the spending agent for an Ovolyn account — an autonomous bank account for AI agents.

You may buy data services from a market to accomplish your goal. You do not hold funds or keys: you propose a purchase, and the bank's policy engine either executes it or refuses it. The policy is set by a human and you cannot change it.

Rules:
- Choose from the listed services only, by their exact id.
- Respect the budget you are shown. Prefer the cheapest service that actually serves the goal; do not buy data you do not need.
- If a purchase is refused, read the reason and adapt: pick a cheaper service, stop, or escalate to the human.
- Keep working while the goal is still unmet and the budget still allows it. If a goal has several parts, buy what each part needs.
- Stop only when the goal is fully met, or when nothing affordable can advance it — in that case escalate and say what the human would need to change. Never keep buying just to use up the budget.

Reply with JSON only:
{"action":"buy","serviceId":"<id>","reasoning":"<one sentence>"}
or
{"action":"stop","reasoning":"<one sentence>","escalate":"<optional message to the human>"}`;

function marketBrief(listings: Listing[]): string {
  return listings
    .map((l) => `- ${l.id} · $${l.priceUsdc} · ${l.name} (${l.provider}) — ${l.description}`)
    .join("\n");
}

function stateBrief(spendable: number, spentToday: number, perTx: number, daily: number): string {
  return [
    `Spendable balance: $${spendable.toFixed(4)}`,
    `Per-transaction limit: $${perTx}`,
    `Daily budget: $${daily} (spent so far today: $${spentToday.toFixed(4)}, remaining: $${Math.max(0, daily - spentToday).toFixed(4)})`,
  ].join("\n");
}

async function summarise(goal: string, steps: Step[]): Promise<string> {
  const bought = steps.filter((s) => s.outcome === "SETTLED");
  if (!bought.length) return "No purchase was made.";
  try {
    return await chatJson<{ summary: string }>([
      { role: "system", content: 'Summarise findings for the human who set the goal. Reply as JSON: {"summary":"<2-3 sentences>"}' },
      {
        role: "user",
        content: `Goal: ${goal}\n\nData purchased:\n${bought
          .map((s) => `- ${s.decision.serviceId} ($${s.priceUsdc}): ${JSON.stringify(s.data).slice(0, 700)}`)
          .join("\n")}`,
      },
    ]).then((r) => r.summary);
  } catch {
    return `Bought ${bought.length} service(s): ${bought.map((s) => s.decision.serviceId).join(", ")}.`;
  }
}

async function execute(run: LoopRun): Promise<void> {
  const policy = getPolicy();
  const listings = marketView();
  const transcript: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `Goal: ${run.goal}\n\nServices available:\n${marketBrief(listings)}\n\nAccount state:\n${stateBrief(
        Number(await gatewayUsdc()) || 0,
        spentTodayUsdc(),
        policy.perTxLimitUsdc,
        policy.dailyBudgetUsdc,
      )}\n\nWhat do you do first?`,
    },
  ];

  for (let n = 1; n <= MAX_STEPS; n++) {
    let decision: Decision;
    try {
      decision = await chatJson<Decision>(transcript);
    } catch (e) {
      run.steps.push({ n, at: new Date().toISOString(), decision: { action: "stop", reasoning: "model call failed" }, outcome: "ERROR", reason: String(e).slice(0, 200) });
      run.state = "failed";
      break;
    }

    const step: Step = { n, at: new Date().toISOString(), decision };
    run.steps.push(step);
    write(run);

    if (decision.action === "stop") {
      step.outcome = "STOPPED";
      write(run);
      break;
    }

    const target = listings.find((l) => l.id === decision.serviceId);
    if (!target) {
      step.outcome = "ERROR";
      step.reason = `unknown service "${decision.serviceId}"`;
      transcript.push({ role: "assistant", content: JSON.stringify(decision) });
      transcript.push({ role: "user", content: `That service id does not exist. Choose from: ${listings.map((l) => l.id).join(", ")}.` });
      write(run);
      continue;
    }

    // The gate — identical to a human-initiated spend.
    const result = await agentSpend(target.endpoint, `${target.name} (agent)`);
    step.outcome = result.outcome === "SETTLED" ? "SETTLED" : result.outcome === "BLOCKED" ? "BLOCKED" : "ERROR";
    step.priceUsdc = result.priceUsdc;
    step.reason = result.reason;
    step.data = result.response;
    if (result.outcome === "SETTLED" && result.priceUsdc) run.spentUsdc += result.priceUsdc;
    write(run);

    transcript.push({ role: "assistant", content: JSON.stringify(decision) });
    transcript.push({
      role: "user",
      content:
        result.outcome === "SETTLED"
          ? `Purchase settled ($${result.priceUsdc}). Data received:\n${JSON.stringify(result.response).slice(0, 900)}\n\nIs the goal met? If yes, stop.`
          : result.outcome === "BLOCKED"
            ? `REFUSED by the policy engine: ${result.reason}\nThe money did not move. Adapt: pick a cheaper service, stop, or escalate.`
            : `The purchase errored: ${result.reason}. Decide what to do next.`,
    });
  }

  if (run.state === "running") run.state = "done";
  run.summary = await summarise(run.goal, run.steps);
  run.endedAt = new Date().toISOString();
  write(run);
}

export function startLoop(goal: string): LoopRun {
  const existing = readLoop();
  if (existing?.state === "running") return existing;

  const run: LoopRun = {
    id: `loop-${Date.now()}`,
    goal,
    startedAt: new Date().toISOString(),
    state: "running",
    steps: [],
    spentUsdc: 0,
  };
  write(run);
  void execute(run).catch((e) => {
    run.state = "failed";
    run.summary = String(e).slice(0, 200);
    run.endedAt = new Date().toISOString();
    write(run);
  });
  return run;
}
