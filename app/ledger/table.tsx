"use client";

import { useMemo, useState } from "react";
import type { LedgerEntry } from "@/lib/store";

const STATUSES = ["ALL", "SETTLED", "CONFIRMED", "BLOCKED", "FAILED"] as const;

export function LedgerTable({ entries }: { entries: LedgerEntry[] }) {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("ALL");
  const [type, setType] = useState("ALL");

  const types = useMemo(
    () => ["ALL", ...Array.from(new Set(entries.map((e) => e.type)))],
    [entries],
  );

  const rows = entries.filter(
    (e) => (status === "ALL" || e.status === status) && (type === "ALL" || e.type === type),
  );

  const settled = rows.filter((e) => e.status === "SETTLED" || e.status === "CONFIRMED").length;
  const refused = rows.filter((e) => e.status === "BLOCKED").length;

  return (
    <>
      <div className="ledger-controls">
        <div className="filtergroup">
          {STATUSES.map((s) => (
            <button
              key={s}
              className={`chip ${status === s ? "on" : ""}`}
              onClick={() => setStatus(s)}
            >
              {s.toLowerCase()}
            </button>
          ))}
        </div>
        <select className="field inline" value={type} onChange={(e) => setType(e.target.value)}>
          {types.map((t) => (
            <option key={t} value={t}>
              {t === "ALL" ? "every kind" : t}
            </option>
          ))}
        </select>
        <div className="mono-sm ledger-count">
          {rows.length} entries · {settled} carried out · {refused} refused
        </div>
      </div>

      <table className="ledger labelled">
        <thead>
          <tr>
            <th>Time (UTC)</th>
            <th>Type</th>
            <th>Detail</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="ledger-empty">
                Nothing matches that filter.
              </td>
            </tr>
          )}
          {rows.map((e, i) => (
            <tr key={i}>
              <td data-label="Time (UTC)">{e.ts.slice(0, 16).replace("T", " ")}</td>
              <td data-label="Type">{e.type}</td>
              <td data-label="Detail">
                {e.detail}
                {e.reason ? ` — ${e.reason}` : ""}
                {e.txHash && (
                  <a
                    className="tx"
                    href={`https://testnet.arcscan.app/tx/${e.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {" "}
                    ↗ {e.txHash.slice(0, 12)}…
                  </a>
                )}
              </td>
              <td data-label="Amount">{e.amount}</td>
              <td
                data-label="Status"
                className={e.status === "BLOCKED" || e.status === "FAILED" ? "blocked" : "ok"}
              >
                {e.status}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
