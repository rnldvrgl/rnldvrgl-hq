import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { defaultHandle, loadPrefs } from "@/lib/prefs-server";
import { syncNames } from "@/lib/names-server";
import { appNameOf, DEFAULT_ICON, iconKey } from "@/lib/prefs";
import { HQ } from "@/hq.config";
import { currentHq, inHq } from "@/lib/hq";
import { loadOfficeState } from "@/lib/state";
import { OfficeLoader } from "@/components/office/OfficeLoader";
import { SessionLock } from "@/components/SessionLock";

export const dynamic = "force-dynamic";

/** The tab title, favicon, Home Screen icon and install manifest of the signed-in HQ (Settings → Appearance). */
export async function generateMetadata(): Promise<Metadata> {
  const hq = await currentHq();
  if (!hq) return {};
  const { prefs, handle } = await inHq(hq, async () => {
    const [{ prefs }, names] = await Promise.all([loadPrefs(), syncNames()]);
    return { prefs, handle: prefs.handle ?? defaultHandle(names.owner ?? HQ.owner.name, HQ.owner.handle) };
  });
  const key = iconKey(prefs.icon ?? DEFAULT_ICON);
  const name = appNameOf(handle);
  return {
    title: name,
    icons: { icon: [{ url: `/hq-icon/${key}/64`, type: "image/png" }], apple: `/hq-icon/${key}/180` },
    manifest: `/hq-manifest/${key}?h=${encodeURIComponent(handle)}`,
    appleWebApp: { capable: true, title: name, statusBarStyle: "black-translucent" },
  };
}

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
