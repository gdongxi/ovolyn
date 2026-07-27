import { redirect } from "next/navigation";
import { currentAccountId } from "@/lib/session";
import { SignInForm } from "./form";

export const dynamic = "force-dynamic";

export default async function SignIn() {
  if (await currentAccountId()) redirect("/account");
  return (
    <div className="signin">
      <h1>Open your account</h1>
      <p className="lede">
        An account is opened by you, in person — with your wallet or your email. Your agents
        register themselves against it afterwards, and spend only what you allow.
      </p>
      <SignInForm />
      <p className="footnote">
        Agents can register, read balances and request spending. They cannot open an account,
        raise their own limits, or withdraw.
      </p>
    </div>
  );
}
