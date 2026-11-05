import { NextResponse } from "next/server";
import { hqRoute } from "@/lib/hq";
import { listFriends } from "@/lib/friends-server";

export const dynamic = "force-dynamic";

/** Every HQ in the circle (names and icons), and which one is yours. */
export const GET = hqRoute(async () => NextResponse.json(await listFriends()));
