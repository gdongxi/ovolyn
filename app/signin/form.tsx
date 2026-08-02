"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Eip1193 = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };

/** Whichever injected wallet the visitor has — MetaMask, OKX, Binance. */
function injectedWallet(): Eip1193 | null {
  const w = globalThis as unknown as {
    ethereum?: Eip1193 & { providers?: Eip1193[] };
    okxwallet?: Eip1193;
    BinanceChain?: Eip1193;
  };
  return w.ethereum?.providers?.[0] ?? w.ethereum ?? w.okxwallet ?? w.BinanceChain ?? null;
}

export function SignInForm({ emailWorks = true }: { emailWorks?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"wallet" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);

  async function signInWithWallet() {
    setError(null);
    const wallet = injectedWallet();
    if (!wallet) {
      setError("No wallet detected. Install MetaMask, OKX Wallet or Binance Wallet — or use email below.");
      return;
    }
    setBusy("wallet");
    try {
      const accounts = (await wallet.request({ method: "eth_requestAccounts" })) as string[];
      const address = accounts[0];
      const { message } = await (await fetch(`/api/auth/siwe?address=${address}`)).json();
      const signature = (await wallet.request({ method: "personal_sign", params: [message, address] })) as string;
      const res = await fetch("/api/auth/siwe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, message, signature }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "sign-in failed");
      router.push("/account");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "sign-in failed");
    } finally {
      setBusy(null);
    }
  }

  async function sendCode() {
    setError(null);
    setBusy("email");
    try {
      const res = await fetch(`/api/auth/email?email=${encodeURIComponent(email)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "could not send a code");
      setCodeSent(true);
      setDevCode(body.devCode ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not send a code");
    } finally {
      setBusy(null);
    }
  }

  async function verifyCode() {
    setError(null);
    setBusy("email");
    try {
      const res = await fetch("/api/auth/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "wrong code");
      router.push("/account");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "wrong code");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="doors">
      <div className="door">
        <div className="label">Wallet</div>
        <p className="doorhint">Your signature proves the address is yours — and doubles as your payout address if you list a service.</p>
        <button className="btn" onClick={signInWithWallet} disabled={busy !== null}>
          {busy === "wallet" ? "Waiting for signature…" : "Sign in with wallet"}
        </button>
      </div>

      <div className="door">
        <div className="label">Email</div>
        <p className="doorhint">A managed account: we hold the keys, you hold the authority.</p>
        <input
          className="field"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={!emailWorks || codeSent}
        />
        {codeSent && (
          <input
            className="field"
            inputMode="numeric"
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        )}
        <button
          className="btn btn-outline"
          onClick={codeSent ? verifyCode : sendCode}
          disabled={!emailWorks || busy !== null || !email}
        >
          {busy === "email" ? "Working…" : codeSent ? "Verify code" : "Email me a code"}
        </button>
        {!emailWorks && (
          <div className="cardnote">
            Not carrying mail on testnet — no message would arrive. Use a wallet; this door opens
            the same account either way.
          </div>
        )}
        {devCode && <div className="mono-sm devcode">testnet: your code is {devCode}</div>}
      </div>

      {error && <div className="doorerror">{error}</div>}
    </div>
  );
}
