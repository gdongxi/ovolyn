"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Run, Stage } from "@/lib/runbook";

const MARK: Record<Stage["state"], string> = {
  pending: "○",
  running: "◐",
  done: "●",
  skipped: "◌",
  failed: "✕",
};

function elapsed(s: Stage): string {
  if (!s.startedAt) return "";
  const end = s.endedAt ? new Date(s.endedAt) : new Date();
  const secs = Math.max(0, Math.round((end.getTime() - new Date(s.startedAt).getTime()) / 1000));
  return `${secs}s`;
}

export function RunPanel({ initial }: { initial: Run | null }) {
  const router = useRouter();
  const [run, setRun] = useState<Run | null>(initial);
  const wasRunning = useRef(false);

  const running = run?.state === "running";

  useEffect(() => {
    if (!running) {
      // Refresh balances once the sequence finishes.
      if (wasRunning.current) {
        wasRunning.current = false;
        router.refresh();
      }
      return;
    }
    wasRunning.current = true;
    const timer = setInterval(async () => {
      const res = await fetch("/api/demo/run", { cache: "no-store" });
      setRun(await res.json());
    }, 1500);
    return () => clearInterval(timer);
  }, [running, router]);

  async function start() {
    const res = await fetch("/api/demo/run", { method: "POST" });
    setRun(await res.json());
  }

  return (
    <div className="runpanel">
      <div className="runhead">
        <div>
          <div className="label">Run the bank</div>
          <div className="mono-sm">Deposit → earn → spend → govern, as one sequence on Arc Testnet</div>
        </div>
        <button className="btn runbtn" onClick={start} disabled={running}>
          {running ? "Running…" : run ? "Run again" : "Run"}
        </button>
      </div>

      <div className="stages">
        {(run?.stages ?? []).map((s) => (
          <div key={s.id} className={`stage ${s.state}`}>
            <div className="stagemark">{MARK[s.state]}</div>
            <div className="stagebody">
              <div className="stagetitle">
                {s.title}
                <span className="stagetime">{elapsed(s)}</span>
              </div>
              <div className="stagecaption">{s.detail ?? s.caption}</div>
              {s.txHash && (
                <a className="tx" href={`https://testnet.arcscan.app/tx/${s.txHash}`} target="_blank" rel="noreferrer">
                  ↗ {s.txHash.slice(0, 14)}…
                </a>
              )}
            </div>
          </div>
        ))}
        {!run && <div className="stage-empty">Four money flows, one click. Takes about three minutes on-chain.</div>}
      </div>
    </div>
  );
}
