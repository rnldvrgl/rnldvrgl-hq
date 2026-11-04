import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Lexend, Atkinson_Hyperlegible, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeSync } from "@/components/ThemePicker";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import "./globals.css";
import { HQ, OWNERS } from "@/hq.config";

const display = Lexend({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const body = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-body" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex" });

export const metadata: Metadata = {
    title: HQ.appName,
    description: `${OWNERS} private headquarters of AI employees.`,
    robots: { index: false, follow: false },
    applicationName: HQ.shortName,
    // Installed from Safari's "Add to Home Screen": full screen, content runs under the status bar.
    appleWebApp: { capable: true, title: HQ.shortName, statusBarStyle: "black-translucent" },
    formatDetection: { telephone: false },
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    // System default (Light / Dark backgrounds); <ThemeSync> rewrites it to match the chosen theme.
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#dfe3ea" },
        { media: "(prefers-color-scheme: dark)", color: "#232a36" },
    ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        // The boot script sets data-theme / data-mode before hydration, hence suppressHydrationWarning.
        <html lang="en" data-theme="light" data-mode="light" data-style={HQ.style} className={`${display.variable} ${body.variable} ${mono.variable}`} suppressHydrationWarning>
            <head>
                {/* Applies the saved theme before first paint, so there's no flash of the wrong one. Static string, no user data. */}
                <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
            </head>
            <body>
                {children}
                <ThemeSync />
                <Toaster />
            </body>
        </html>
    );
}
