import { redirect } from "next/navigation";
import { currentHq, inHq } from "@/lib/hq";
import { loadOfficeState } from "@/lib/state";
import { OfficeLoader } from "@/components/office/OfficeLoader";
import { SessionLock } from "@/components/SessionLock";

export const dynamic = "force-dynamic";

export default async function Home() {
  const hq = await currentHq();
  if (!hq) redirect("/login?error=owner");
  const state = await inHq(hq, loadOfficeState);
  return (
    <>
      <SessionLock />
      <OfficeLoader initial={state} />
    </>
  );
}
