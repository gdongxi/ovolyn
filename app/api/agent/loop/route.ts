import { NextResponse } from "next/server";
import { startLoop, readLoop } from "@/lib/agentLoop";

export const maxDuration = 600;

export async function POST(req: Request) {
  const { goal } = await req.json();
  if (typeof goal !== "string" || goal.trim().length < 4) {
    return NextResponse.json({ error: "goal required" }, { status: 400 });
  }
  return NextResponse.json(startLoop(goal.trim()));
}

export async function GET() {
  return NextResponse.json(readLoop() ?? { state: "idle", steps: [] });
}
