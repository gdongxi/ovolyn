import Link from "next/link";
import { redirect } from "next/navigation";
import { currentAccountId } from "@/lib/session";
import { getAccount, listAgents } from "@/lib/accounts";
import { AgentManager, SignOut } from "./manage";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const accountId = await currentAccountId();
  if (!accountId) redirect("/signin");
  const account = getAccount(accountId);
  if (!account) redirect("/signin");

  return (
    <>
      <div className="acct-head">
        <div>
          <div className="label">Account</div>
          <div className="acct-id">{account.address ?? account.email}</div>
          <div className="mono-sm">
            opened {account.createdAt.slice(0, 10)} · {account.authMethod === "siwe" ? "wallet" : "email"}
            {account.payoutAddress && ` · payout ${account.payoutAddress.slice(0, 10)}…`}
          </div>
        </div>
        <div className="acct-actions">
          <Link className="btn btn-outline" href="/">Console</Link>
          <SignOut />
        </div>
      </div>

      <AgentManager agents={listAgents(accountId)} />
    </>
  );
}
