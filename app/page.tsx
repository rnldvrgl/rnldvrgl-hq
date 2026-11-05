import { redirect } from "next/navigation";
import { currentOwner } from "@/lib/auth";
import { loadOfficeState } from "@/lib/state";
import { OfficeLoader } from "@/components/office/OfficeLoader";
import { SessionLock } from "@/components/SessionLock";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!(await currentOwner())) redirect("/login?error=owner");
  const state = await loadOfficeState();
  return (
    <>
      <SessionLock />
      <OfficeLoader initial={state} />
    </>
  );
}
