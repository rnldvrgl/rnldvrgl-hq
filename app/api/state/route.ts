import { NextResponse } from "next/server";
import { hqRoute } from "@/lib/hq";
import { loadOfficeState } from "@/lib/state";

export const dynamic = "force-dynamic";

export const GET = hqRoute(async () => {
  return NextResponse.json(await loadOfficeState());
});
