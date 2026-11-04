import type { MetadataRoute } from "next";
import { BRAND_BG } from "@/lib/brand-icon";
import { HQ, OWNERS } from "@/hq.config";

/** Lets you install HQ from Safari: Share → Add to Home Screen. It then opens full-screen, like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: HQ.appName,
    short_name: "HQ",
    description: `${OWNERS} private headquarters of AI employees.`,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f151c",
    theme_color: BRAND_BG,
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/maskable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
