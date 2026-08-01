import { NextResponse } from "next/server";
import { requireOperator } from "@/lib/guard";
import { agentSpend } from "@/lib/agent";

export async function POST(req: Request) {
  const denied = await requireOperator();
  if (denied) return denied;

  const { url, label } = await req.json();
  if (typeof url !== "string" || !/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }
  const result = await agentSpend(url, typeof label === "string" ? label : "agent task");
  return NextResponse.json(result, { status: result.outcome === "ERROR" ? 500 : 200 });
}
