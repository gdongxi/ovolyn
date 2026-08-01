import { getListings } from "@/lib/registry";
import { getPolicy } from "@/lib/store";
import { PageHead } from "@/app/pagehead";
import { AgentActions } from "@/app/controls";
import { Listings, ListServiceForm } from "./listings";

export const dynamic = "force-dynamic";

export default async function Market() {
  const listings = getListings();
  const policy = getPolicy();

  return (
    <>
      <PageHead
        title="Market"
        lede="An open registry of paid services. Anyone may list; no one reviews the listing. A probe checks that the endpoint is alive, quotes a valid 402 and charges what it advertises — and that probe sets the tier."
      />

      <Listings listings={listings} />

      <div className="grid grid-2" style={{ marginTop: 34 }}>
        <AgentActions listings={listings} />
        <div className="card">
          <div className="label">What the policy allows</div>
          <div className="policy-row">
            <span>Per-transaction limit</span>
            <span className="mono-sm">${policy.perTxLimitUsdc}</span>
          </div>
          <div className="policy-row">
            <span>Daily budget</span>
            <span className="mono-sm">${policy.dailyBudgetUsdc}</span>
          </div>
          <div className="policy-row">
            <span>Merchants permitted</span>
            <span className="mono-sm">{policy.allowlist.length}</span>
          </div>
          <div className="mono-sm" style={{ marginTop: 14 }}>
            The registry decides who exists. The operator decides who their agent may trade with —
            change that on the Agents page.
          </div>
        </div>
      </div>

      <ListServiceForm />
    </>
  );
}
