"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AgentRecord } from "@/lib/accounts";

export function SignOut() {
  const router = useRouter();
  return (
    <button
      className="btn btn-outline"
      onClick={async () => {
        await fetch("/api/auth/signout", { method: "POST" });
        router.push("/signin");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}

function AgentRow({ agent }: { agent: AgentRecord }) {
  const router = useRouter();
  const [perTx, setPerTx] = useState(String(agent.allowance.perTxLimitUsdc));
  const [daily, setDaily] = useState(String(agent.allowance.dailyBudgetUsdc));
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch("/api/agents", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentId: agent.id, ...body }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`agentrow ${agent.allowance.activated ? "live" : "dormant"}`}>
      <div className="agentmeta">
        <div className="agentname">
          {agent.name}
          <span className={`badge ${agent.allowance.activated ? "on" : ""}`}>
            {agent.allowance.activated ? "can spend" : "no allowance"}
          </span>
        </div>
        <div className="mono-sm">
          {agent.id} · registered {agent.createdAt.slice(0, 10)}
          {agent.lastUsedAt && ` · last used ${agent.lastUsedAt.slice(0, 10)}`}
        </div>
      </div>
      <div className="agentgrant">
        <label>
          per-tx $
          <input value={perTx} onChange={(e) => setPerTx(e.target.value)} />
        </label>
        <label>
          daily $
          <input value={daily} onChange={(e) => setDaily(e.target.value)} />
        </label>
        <button
          className="btn"
          disabled={busy}
          onClick={() => patch({ perTxLimitUsdc: Number(perTx), dailyBudgetUsdc: Number(daily) })}
        >
          {agent.allowance.activated ? "Update" : "Grant"}
        </button>
        <button className="btn btn-outline" disabled={busy} onClick={() => patch({ revoke: true })}>
          Revoke
        </button>
      </div>
    </div>
  );
}

export function AgentManager({ agents }: { agents: AgentRecord[] }) {
  const router = useRouter();
  const [pairing, setPairing] = useState<{ prompt: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function invite() {
    setBusy(true);
    setCopied(false);
    try {
      const res = await fetch("/api/agents/pair", { method: "POST" });
      if (res.ok) setPairing(await res.json());
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!pairing) return;
    await navigator.clipboard.writeText(pairing.prompt);
    setCopied(true);
  }

  return (
    <div className="runpanel">
      <div className="runhead">
        <div>
          <div className="label">Agents</div>
          <div className="mono-sm">Your agents register themselves. You decide what each one may spend.</div>
        </div>
        <button className="btn runbtn" onClick={invite} disabled={busy}>
          {busy ? "Issuing…" : "Connect an agent"}
        </button>
      </div>

      {pairing && (
        <div className="keyreveal">
          <div className="label">Give this to your AI</div>
          <code>{pairing.prompt}</code>
          <div className="pairactions">
            <button className="btn btn-outline" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
            <span className="mono-sm">expires {new Date(pairing.expiresAt).toLocaleTimeString()}</span>
          </div>
          <p className="mono-sm">
            Your agent runs this itself and receives its own key — we never show it to you, and it
            arrives with no allowance. Grant one below once the agent appears.
          </p>
        </div>
      )}

      {agents.length === 0 ? (
        <div className="stage-empty">
          No agents yet. Issue a pairing command, hand it to your AI, and it will register itself here.
        </div>
      ) : (
        agents.map((a) => <AgentRow key={a.id} agent={a} />)
      )}
    </div>
  );
}
