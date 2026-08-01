import { getLedger } from "@/lib/store";
import { PageHead } from "@/app/pagehead";
import { LedgerTable } from "./table";

export const dynamic = "force-dynamic";

export default async function Ledger() {
  const entries = getLedger();
  return (
    <>
      <PageHead
        title="Ledger"
        lede="Every movement, including the refusals."
      />
      <LedgerTable entries={entries} />
    </>
  );
}
