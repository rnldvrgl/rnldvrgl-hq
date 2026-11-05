import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/auth";
import { tick } from "@/lib/employees";
import { forEachHq } from "@/lib/hq";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handle(req: Request) {
  if (!isCronRequest(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // every HQ gets its turn: yours first, then each friend's
  const ran: string[] = [];
  await forEachHq(async (hq) => { for (const r of await tick()) ran.push(hq.founder ? r : `${hq.email}:${r}`); });
  return NextResponse.json({ ok: true, ran });
}

export const GET = handle;
export const POST = handle;
