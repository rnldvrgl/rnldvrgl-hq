"use client"

import type { CSSProperties } from "react"
import { CircleCheck, Info, Loader2, OctagonX, TriangleAlert, X } from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { useIsDesktop } from "@/hooks/use-media"
import { useThemeMode } from "@/components/ThemePicker"

/** Space for the app header, plus the notch / status bar on iPhone. */
const TOP_DESKTOP = "96px"
const TOP_PHONE = "calc(env(safe-area-inset-top, 0px) + 64px)"

const vars: CSSProperties & Record<`--${string}`, string> = {
  "--normal-bg": "var(--popover)",
  "--normal-text": "var(--popover-foreground)",
  "--normal-border": "var(--border)",
  "--border-radius": "calc(var(--radius) + 4px)",
  "--width": "380px",
}

/**
 * App toasts: card surface with a coloured accent and icon per type (see `.hq-toast` in globals.css).
 * Desktop: top-right under the header. Phones and tablets: top-centre below the notch, so they never
 * cover the bottom tab bar or the 3D view controls.
 */
const Toaster = (props: ToasterProps) => {
  const desktop = useIsDesktop()
  const mode = useThemeMode()
  return (
    <Sonner
      theme={mode}
      position={desktop ? "top-right" : "top-center"}
      offset={desktop ? { top: TOP_DESKTOP, right: "24px" } : { top: TOP_PHONE }}
      mobileOffset={{ top: TOP_PHONE, left: "12px", right: "12px" }}
      gap={10}
      visibleToasts={4}
      closeButton
      className="toaster group"
      icons={{
        success: <CircleCheck className="size-[18px]" />,
        info: <Info className="size-[18px]" />,
        warning: <TriangleAlert className="size-[18px]" />,
        error: <OctagonX className="size-[18px]" />,
        loading: <Loader2 className="size-[18px] animate-spin" />,
        close: <X className="size-3" />,
      }}
      toastOptions={{
        classNames: {
          toast: "hq-toast",
          title: "hq-toast-title",
          description: "hq-toast-description",
          closeButton: "hq-toast-close",
          actionButton: "hq-toast-action",
        },
      }}
      style={vars}
      {...props}
    />
  )
}

export { Toaster }
