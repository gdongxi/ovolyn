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

      {/* These stalls take money from anyone, not only from this bank — which is
          the difference between a market and a demo. Say so where a visitor is
          standing, and point at the tap they will need. */}
      <div className="tryit">
        <div className="label">Buy from a stall yourself</div>
        <p>
          Every stall quotes over x402 and settles on a dozen testnets. You do not need an account
          here — you need testnet USDC in your own wallet.
        </p>
        <code>curl -i https://ovolyn.xyz/stall/gas-oracle</code>
        <a className="linkish" href="https://faucet.circle.com" target="_blank" rel="noreferrer">
          Circle testnet faucet →
        </a>
      </div>

      <div className="buybar">
        <AgentActions listings={listings} />
      </div>

      <ListServiceForm />
    </>
  );
}
