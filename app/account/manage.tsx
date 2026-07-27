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

export function AgentManager({ accountId, agents }: { accountId: string; agents: AgentRecord[] }) {
  const router = useRouter();
  const [name, setName] = useState("my-gpt");
  const [issued, setIssued] = useState<{ key: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function register() {
    setBusy(true);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accountId, name }),
      });
      const body = await res.json();
      if (res.ok) setIssued({ key: body.key, name: body.agent.name });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="runpanel">
      <div className="runhead">
        <div>
          <div className="label">Agents</div>
          <div className="mono-sm">Each key spends within the allowance you grant it — and nothing until you do.</div>
        </div>
        <div className="acct-actions">
          <input className="field inline" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn runbtn" onClick={register} disabled={busy || !name}>
            {busy ? "Issuing…" : "Register an agent"}
          </button>
        </div>
      </div>

      {issued && (
        <div className="keyreveal">
          <div className="label">Key for {issued.name} — shown once</div>
          <code>{issued.key}</code>
          <p className="mono-sm">
            Give this to your agent. It can read balances and request purchases; it cannot open an
            account, change policy, raise its own limit, or withdraw.
          </p>
        </div>
      )}

      {agents.length === 0 ? (
        <div className="stage-empty">No agents yet. Register one, then grant it an allowance.</div>
      ) : (
        agents.map((a) => <AgentRow key={a.id} agent={a} />)
      )}
    </div>
  );
}
