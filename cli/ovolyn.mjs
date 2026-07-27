#!/usr/bin/env node
/**
 * ovolyn — the agent's own command line.
 *
 * An agent runs this itself, with a pairing code its owner handed over. It
 * registers, stores its key locally, and can then read its budget, search the
 * market and request purchases. Everything it can do here is bounded by the
 * allowance its owner grants; nothing here can open an account, change policy
 * or withdraw.
 *
 *   npx ovolyn connect <pairing-code> [--name my-gpt] [--url http://...]
 *   npx ovolyn budget
 *   npx ovolyn market [query]
 *   npx ovolyn buy <service-id|url>
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

const CONFIG = join(homedir(), ".ovolyn", "agent.json");
const DEFAULT_URL = "http://localhost:3000";

const args = process.argv.slice(2);
const command = args[0];

function flag(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

function loadConfig() {
  if (!existsSync(CONFIG)) return null;
  try {
    return JSON.parse(readFileSync(CONFIG, "utf8"));
  } catch {
    return null;
  }
}

function saveConfig(config) {
  mkdirSync(dirname(CONFIG), { recursive: true });
  writeFileSync(CONFIG, JSON.stringify(config, null, 2), { mode: 0o600 });
}

function requireConfig() {
  const config = loadConfig();
  if (!config?.key) {
    console.error("Not connected. Ask your owner for a pairing code, then run:\n  npx ovolyn connect <code>");
    process.exit(1);
  }
  return config;
}

async function api(config, path, init = {}) {
  const res = await fetch(`${config.url}${path}`, {
    ...init,
    headers: { "content-type": "application/json", authorization: `Bearer ${config.key}`, ...(init.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`${res.status}: ${body.error ?? "request failed"}`);
    process.exit(1);
  }
  return body;
}

async function connect() {
  const code = args[1];
  if (!code) {
    console.error("Usage: npx ovolyn connect <pairing-code>");
    process.exit(1);
  }
  const url = flag("url", DEFAULT_URL);
  const name = flag("name", "agent");
  const res = await fetch(`${url}/api/agents`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pairingCode: code, name }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`Could not connect — ${body.error ?? res.status}`);
    process.exit(1);
  }
  saveConfig({ url, key: body.key, agentId: body.agent.id, name: body.agent.name });
  console.log(`Connected as "${body.agent.name}" (${body.agent.id}).`);
  console.log("Key stored in ~/.ovolyn/agent.json");
  console.log("\nYou have no spending allowance yet — your owner grants it from their account page.");
  console.log("Check any time with: npx ovolyn budget");
}

async function budget() {
  const b = await api(requireConfig(), "/api/v1/budget");
  console.log(`${b.agent.name} · ${b.agent.activated ? "may spend" : "no allowance yet"}`);
  console.log(`  spendable balance   $${b.spendableUsdc.toFixed(4)}`);
  console.log(`  per-transaction     $${b.perTxLimitUsdc}`);
  console.log(`  remaining today     $${b.remainingTodayUsdc.toFixed(4)} of $${b.dailyBudgetUsdc}`);
}

async function market() {
  const q = args.slice(1).filter((a) => !a.startsWith("--")).join(" ");
  const { listings } = await api(requireConfig(), `/api/v1/market${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  if (!listings.length) return console.log("No services matched.");
  for (const l of listings) {
    console.log(`${l.id.padEnd(18)} $${String(l.priceUsdc).padEnd(7)} ${l.name} — ${l.provider}`);
    console.log(`${" ".repeat(18)} ${l.description}`);
  }
}

async function buy() {
  const target = args[1];
  if (!target) {
    console.error("Usage: npx ovolyn buy <service-id|url>");
    process.exit(1);
  }
  const config = requireConfig();
  let url = target;
  if (!/^https?:\/\//.test(target)) {
    const { listings } = await api(config, "/api/v1/market");
    const match = listings.find((l) => l.id === target);
    if (!match) {
      console.error(`No service "${target}". Run: npx ovolyn market`);
      process.exit(1);
    }
    url = match.endpoint;
  }
  const result = await api(config, "/api/v1/spend", { method: "POST", body: JSON.stringify({ url, label: target }) });
  if (result.outcome === "SETTLED") {
    console.log(`Paid $${result.priceUsdc}.`);
    console.log(JSON.stringify(result.response, null, 2));
  } else {
    // A refusal is an answer, not a crash — the agent is expected to adapt.
    console.log(`Refused: ${result.reason}`);
  }
}

const commands = { connect, budget, market, buy };
const run = commands[command];
if (!run) {
  console.log("ovolyn — the agent's command line\n");
  console.log("  npx ovolyn connect <pairing-code> [--name my-gpt] [--url http://...]");
  console.log("  npx ovolyn budget");
  console.log("  npx ovolyn market [query]");
  console.log("  npx ovolyn buy <service-id|url>");
  process.exit(command ? 1 : 0);
}
await run();
