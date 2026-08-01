import { redirect } from "next/navigation";

/** Treasury folded into the bank page. */
export default function TreasuryRedirect() {
  redirect("/bank");
}
