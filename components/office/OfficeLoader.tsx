"use client";

import dynamic from "next/dynamic";
import type { OfficeState } from "@/lib/team";
import { LoadingScreen } from "./LoadingScreen";

/**
 * The office is rendered in the browser only: WebGL, GSAP and matchMedia all need `window`,
 * and keeping it client-side means the Zustand store never lives on the server.
 */
const Office = dynamic(() => import("./Office"), {
  ssr: false,
  loading: () => <LoadingScreen label="Unlocking the office" />,
});

export function OfficeLoader({ initial }: { initial: OfficeState }) {
  return <Office initial={initial} />;
}
