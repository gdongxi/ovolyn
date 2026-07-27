import { NextResponse } from "next/server";
import { startRun, readRun } from "@/lib/runbook";

export const maxDuration = 600;

/** Start the sequence; returns immediately — progress is polled via GET. */
export async function POST() {
  return NextResponse.json(startRun());
}

export async function GET() {
  const run = readRun();
  return NextResponse.json(run ?? { state: "idle", stages: [] });
}
