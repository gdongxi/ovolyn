"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LoopRun, Step } from "@/lib/agentLoop";

const PRESET = "What does it cost to transact on Arc right now, is our idle USDC earning a competitive rate, and get me the deepest market analysis you can.";

function badge(s: Step): { text: string; cls: string } {
  if (s.decision.action === "stop") return { text: "stopped", cls: "" };
  switch (s.outcome) {
    case "SETTLED": return { text: `paid $${s.priceUsdc}`, cls: "ok" };
    case "BLOCKED": return { text: "refused", cls: "blocked" };
    case "ERROR": return { text: "error", cls: "blocked" };
    default: return { text: "deciding…", cls: "" };
  }
}

export function AgentLoopPanel({ initial }: { initial: LoopRun | null }) {
  const router = useRouter();
  const [run, setRun] = useState<LoopRun | null>(initial);
  const [goal, setGoal] = useState(PRESET);
  const wasRunning = useRef(false);
  const running = run?.state === "running";

  useEffect(() => {
    if (!running) {
      if (wasRunning.current) {
        wasRunning.current = false;
        router.refresh();
      }
      return;
    }
    wasRunning.current = true;
    const t = setInterval(async () => {
      const res = await fetch("/api/agent/loop", { cache: "no-store" });
      setRun(await res.json());
    }, 1500);
    return () => clearInterval(t);
  }, [running, router]);

  async function start() {
    const res = await fetch("/api/agent/loop", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goal }),
    });
    setRun(await res.json());
  }

  return (
    <div className="runpanel">
      <div className="runhead">
        <div>
          <div className="label">Agent · autonomous run</div>
          <div className="mono-sm">The model decides what to buy. The policy engine decides what it may buy.</div>
        </div>
        <button className="btn runbtn" onClick={start} disabled={running}>
          {running ? "Thinking…" : "Give the agent a goal"}
        </button>
      </div>

      <textarea
        className="goalbox"
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        disabled={running}
        rows={2}
      />

      {run && (
        <div className="steps">
          {run.steps.map((s) => {
            const b = badge(s);
            return (
              <div key={s.n} className="step">
                <div className="stepn">{s.n}</div>
                <div className="stepbody">
                  <div className="stepline">
                    <span className="stepaction">
                      {s.decision.action === "buy" ? `buy ${s.decision.serviceId}` : "stop"}
                    </span>
                    <span className={`stepbadge ${b.cls}`}>{b.text}</span>
                  </div>
                  <div className="stepreason">{s.decision.reasoning}</div>
                  {s.reason && s.outcome !== "SETTLED" && <div className="steprefusal">{s.reason}</div>}
                  {s.decision.escalate && <div className="stepescalate">↑ to the human: {s.decision.escalate}</div>}
                </div>
              </div>
            );
          })}
          {run.summary && run.state !== "running" && (
            <div className="loopsummary">
              <div className="label">Result · spent ${run.spentUsdc.toFixed(4)}</div>
              <p>{run.summary}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
