import Link from "next/link";
import { currentAccountId } from "@/lib/session";
import { getAccount, listAgents } from "@/lib/accounts";
import { getPolicy } from "@/lib/store";
import { readLoop } from "@/lib/agentLoop";
import { PageHead } from "@/app/pagehead";
import { PolicyCard } from "@/app/controls";
import { AgentLoopPanel } from "@/app/agentloop";
import { AgentManager, SignOut } from "@/app/account/manage";

export const dynamic = "force-dynamic";

/** Signed out: explain why this page is the one that asks, rather than bounce. */
function Locked() {
  return (
    <>
      <PageHead
        title="Agents"
        lede="The only page that asks you to sign in."
      />
      <div className="locked">
        <p>
          The keys and the limits on this page are yours alone. The bank, the market and the
          ledger stay open — anyone can audit what this bank has done.
        </p>
        <Link className="btn" href="/signin">
          Open or resume your account
        </Link>
      </div>
    </>
  );
}

export default async function Agents() {
  const accountId = await currentAccountId();
  if (!accountId) return <Locked />;
  const account = getAccount(accountId);
  if (!account) return <Locked />;

  return (
    <>
      <div className="acct-head">
        <div>
          <PageHead
            title="Agents"
            lede="They register themselves. You decide what each may spend."
          />
          <div className="acct-id">{account.address ?? account.email}</div>
          <div className="mono-sm">
            account opened {account.createdAt.slice(0, 10)} ·{" "}
            {account.authMethod === "siwe" ? "wallet" : "email"}
            {account.payoutAddress && ` · payout ${account.payoutAddress.slice(0, 10)}…`}
          </div>
        </div>
        <div className="acct-actions">
          <SignOut />
        </div>
      </div>

      <AgentManager agents={listAgents(accountId)} />

      <div className="grid grid-2">
        <PolicyCard policy={getPolicy()} />
        <div className="card">
          <div className="label">How a spend is decided</div>
          <ol className="gatelist">
            <li>Is the merchant on the allowlist?</li>
            <li>What does it actually quote right now?</li>
            <li>Is that within this agent&apos;s own limit?</li>
            <li>Is it within today&apos;s budget?</li>
          </ol>
          <div className="mono-sm">
            An allowance narrows the policy, never widens it — the stricter of the two applies.
          </div>
        </div>
      </div>

      <AgentLoopPanel initial={readLoop()} />
    </>
  );
}
