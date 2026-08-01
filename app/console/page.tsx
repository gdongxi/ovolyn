import { redirect } from "next/navigation";

/** Console and treasury merged into one page — the operator's money in one place. */
export default function ConsoleRedirect() {
  redirect("/bank");
}
