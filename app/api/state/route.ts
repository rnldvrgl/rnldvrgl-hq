import { NextResponse } from "next/server";
import { currentOwner } from "@/lib/auth";
import { loadOfficeState } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await currentOwner())) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  return NextResponse.json(await loadOfficeState());
}
