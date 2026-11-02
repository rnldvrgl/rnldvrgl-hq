"use client";

import { useEffect, useState } from "react";
import { useMediaQuery } from "react-responsive";

/**
 * react-responsive reads window.matchMedia, which doesn't exist during the first render.
 * These hooks return the safe default until the component has mounted, so nothing flickers or mismatches.
 */
function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/** ≥1024px: side panel and full-quality 3D. Below: bottom sheet and lighter 3D. */
export function useIsDesktop() {
  const mounted = useMounted();
  const match = useMediaQuery({ minWidth: 1024 });
  return mounted ? match : true;
}

export function useIsPhone() {
  const mounted = useMounted();
  const match = useMediaQuery({ maxWidth: 639 });
  return mounted ? match : false;
}

export function usePrefersDark() {
  const mounted = useMounted();
  const match = useMediaQuery({ query: "(prefers-color-scheme: dark)" });
  return mounted ? match : false;
}

export function usePrefersReducedMotion() {
  const mounted = useMounted();
  const match = useMediaQuery({ query: "(prefers-reduced-motion: reduce)" });
  return mounted ? match : false;
}
