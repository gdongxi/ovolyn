import { redirect } from "next/navigation";

/** The account page folded into /agents — the identity and its agents are one story. */
export default function AccountRedirect() {
  redirect("/agents");
}
