import { redirect } from "next/navigation";
import { currentAccountId } from "@/lib/session";
import { SignInForm } from "./form";

export const dynamic = "force-dynamic";

export default async function SignIn() {
  if (await currentAccountId()) redirect("/account");
  // No mail provider is wired on testnet, so the code never leaves the server.
  // The door stays visible and says so, rather than accepting an address and
  // sending nothing.
  const emailWorks = process.env.NODE_ENV !== "production";
  return (
    <div className="signin">
      <h1>Open your account</h1>
      <p className="lede">
        An account is opened by you, in person — with your wallet or your email. Your agents
        register themselves against it afterwards, and spend only what you allow.
      </p>
      <SignInForm emailWorks={emailWorks} />
      <p className="footnote">
        Agents can register, read balances and request spending. They cannot open an account,
        raise their own limits, or withdraw.
      </p>
    </div>
  );
}
