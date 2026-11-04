import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/auth";
import { tick } from "@/lib/employees";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handle(req: Request) {
  if (!isCronRequest(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ran = await tick();
  return NextResponse.json({ ok: true, ran });
}

export const GET = handle;
export const POST = handle;
