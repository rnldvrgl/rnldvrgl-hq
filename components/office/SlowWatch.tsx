"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { toast } from "sonner";
import { useOffice } from "@/lib/store";
import { LIGHT_SHOW, useSettings } from "@/lib/settings";

/** Measured over this long, after the scene has had this long to load. */
const WINDOW_S = 5, WARMUP_S = 10;
/** Below this the view feels choppy: first step is low-power rendering, then the full Battery saver preset. */
const SLOW_FPS = 25, VERY_SLOW_FPS = 16;

/**
 * Settings → Auto battery saver: watches the frame rate and steps down by itself when the office keeps running
 * slow (an older phone, a hot laptop on battery). Each step happens once per visit and says so in a toast.
 * Hidden tabs don't count (the browser pauses them).
 */
export function SlowWatch() {
  const acc = useRef({ frames: 0, time: 0, since: 0, stepped: 0 });
  useFrame((_, dt) => {
    const a = acc.current;
    a.since += dt;
    if (a.since < WARMUP_S || document.visibilityState !== "visible" || dt > 1) return;
    a.frames++; a.time += dt;
    if (a.time < WINDOW_S) return;
    const fps = a.frames / a.time;
    a.frames = 0; a.time = 0;
    // minimal motion caps the view at 12 fps on purpose: that's not slowness
    if (!useSettings.getState().autoSaver || useSettings.getState().motion === "minimal") return;
    const { lowPower, setLowPower } = useOffice.getState();
    if (!lowPower && fps < SLOW_FPS && a.stepped === 0) {
      a.stepped = 1;
      setLowPower(true);
      toast("Running slow, so the office switched to low-power rendering.", { description: "Change it in Settings → Performance." });
    } else if (lowPower && fps < VERY_SLOW_FPS && a.stepped === 1) {
      a.stepped = 2;
      const st = useSettings.getState();
      st.setMotion("minimal");
      st.setAllShow(LIGHT_SHOW);
      toast("Still slow, so the office switched to Battery saver.", { description: "Change it in Settings → Performance." });
    }
  });
  return null;
}
