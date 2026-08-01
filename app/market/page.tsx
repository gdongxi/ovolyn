import { getListings } from "@/lib/registry";
import { PageHead } from "@/app/pagehead";
import { AgentActions } from "@/app/controls";
import { Listings, ListServiceForm } from "./listings";

export const dynamic = "force-dynamic";

export default async function Market() {
  const listings = getListings();

  return (
    <>
      <PageHead
        title="Market"
        lede="Anyone may list. No one reviews it — a probe does, and its verdict is the tier."
      />

      <Listings listings={listings} />

      <div className="buybar">
        <AgentActions listings={listings} />
      </div>

      <ListServiceForm />
    </>
  );
}
