"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Listing } from "@/lib/registry";

type Eip1193 = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };

function injectedWallet(): Eip1193 | null {
  const w = globalThis as unknown as {
    ethereum?: Eip1193 & { providers?: Eip1193[] };
    okxwallet?: Eip1193;
    BinanceChain?: Eip1193;
  };
  return w.ethereum?.providers?.[0] ?? w.ethereum ?? w.okxwallet ?? w.BinanceChain ?? null;
}

export function Listings({ listings }: { listings: Listing[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function reprobe() {
    setBusy(true);
    try {
      await fetch("/api/registry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "probe" }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="listing-table">
      <div className="listing-head">
        <span>Service</span>
        <span>Provider</span>
        <span>Probe</span>
        <span className="right">Price</span>
      </div>
      {listings.map((l) => (
        <div className="listing-row" key={l.id}>
          <div>
            <div className="lname">
              {l.name}
              {l.firstParty && <span className="badge">first-party</span>}
            </div>
            <div className="lmeta">{l.description}</div>
            <div className="lmeta">{l.endpoint}</div>
          </div>
          <div className="lprov">
            {l.provider}
            <div className="lmeta">{l.payoutAddress.slice(0, 10)}…</div>
          </div>
          <div>
            {l.probe?.passed ? (
              <span className="probe-ok">✓ tier {l.tier} · quote matches</span>
            ) : l.probe ? (
              <span className="probe-bad">✕ {l.probe.note?.slice(0, 44)}</span>
            ) : (
              <span className="lmeta">not probed</span>
            )}
          </div>
          <div className="lprice right">${l.priceUsdc}</div>
        </div>
      ))}
      <button className="linkish" onClick={reprobe} disabled={busy}>
        {busy ? "Probing…" : "Re-probe every listing"}
      </button>
    </div>
  );
}

const BLANK = {
  id: "",
  name: "",
  provider: "",
  endpoint: "",
  priceUsdc: "0.002",
  category: "OTHER",
  description: "",
};

/**
 * Listing is permissionless but not anonymous: the provider signs a statement
 * naming the endpoint and price with the address that will be paid.
 */
export function ListServiceForm() {
  const router = useRouter();
  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const set = (k: keyof typeof BLANK) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit() {
    setResult(null);
    const wallet = injectedWallet();
    if (!wallet) {
      setResult({ ok: false, text: "No wallet detected. Listing requires a signature from the payout address." });
      return;
    }
    setBusy(true);
    try {
      const [address] = (await wallet.request({ method: "eth_requestAccounts" })) as string[];
      const q = new URLSearchParams({
        address,
        id: form.id,
        endpoint: form.endpoint,
        priceUsdc: form.priceUsdc,
      });
      const { message, error } = await (await fetch(`/api/registry/sign?${q}`)).json();
      if (!message) throw new Error(error ?? "could not prepare the statement");

      const signature = (await wallet.request({ method: "personal_sign", params: [message, address] })) as string;
      const res = await fetch("/api/registry/sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, priceUsdc: Number(form.priceUsdc), address, message, signature }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "listing rejected");

      setResult({
        ok: data.probe.passed,
        text: data.probe.passed
          ? `Listed — probe passed, quoting $${data.probe.quotedUsdc}.`
          : `Listed, but the probe failed: ${data.probe.note}. Fix the endpoint and re-probe.`,
      });
      setForm(BLANK);
      router.refresh();
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : "listing failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="listform">
      <h2 className="display">List your service</h2>
      <p>
        Serve an x402-paywalled endpoint and sign with the address you want paid. There is no
        review queue — the probe runs immediately and its verdict is your tier.
      </p>
      <div className="listform-grid">
        <label>
          <span>Service id</span>
          <input className="field" value={form.id} onChange={set("id")} placeholder="my-price-feed" />
        </label>
        <label>
          <span>Name</span>
          <input className="field" value={form.name} onChange={set("name")} placeholder="My Price Feed" />
        </label>
        <label>
          <span>Provider</span>
          <input className="field" value={form.provider} onChange={set("provider")} placeholder="Acme Data" />
        </label>
        <label>
          <span>Price · USDC per call</span>
          <input className="field" value={form.priceUsdc} onChange={set("priceUsdc")} />
        </label>
        <label className="wide">
          <span>Endpoint</span>
          <input className="field" value={form.endpoint} onChange={set("endpoint")} placeholder="https://api.example.com/quote" />
        </label>
        <label className="wide">
          <span>Description</span>
          <input className="field" value={form.description} onChange={set("description")} placeholder="What an agent gets for the money." />
        </label>
      </div>
      <button className="btn" onClick={submit} disabled={busy || !form.id || !form.endpoint}>
        {busy ? "Waiting for signature…" : "Sign with payout address and list"}
      </button>
      {result && <div className={`spend-result ${result.ok ? "ok" : "blocked"}`}>{result.text}</div>}
    </section>
  );
}
