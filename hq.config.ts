/**
 * Who this HQ belongs to. Making a copy of the app for someone else starts here: change the names, the city
 * and the look in this one file, then put their own keys in .env.local / Vercel (see README → "Make a copy").
 *
 * Everything in the app reads these values: the header, the boss in the 3D office, the AI prompts,
 * the weather, the wall clock and the signs. Safe to import from both server and browser code (no secrets here).
 */

export type BossLook = "him" | "her";
export type BossOffice = "auto" | "executive" | "gaming" | "cozy" | "minimal" | "studio" | "heritage";
export type StyleName = "slate" | "blush" | "mango";
export type LoginBackdrop = "street" | "aurora";
export type AskAgain = "phones" | "always" | "never";

export const HQ = {
  /** The owner: shown on the office sign, the header and in prompts ("sign as …"). */
  owner: {
    /** First name, used in sentences ("Ronald's car", "Waiting in Ronald's office"). */
    name: "Ronald",
    /** Short handle on the sign in the corner office and the logo line in the header. */
    handle: "rnldvrgl",
    /** The boss's default look in the 3D office (each viewer can still change it in Settings → Boss). */
    look: "him" as BossLook,
    /** The corner office's default interior. "auto" matches the look: executive for him, cozy for her. */
    office: "auto" as BossOffice,
  },

  /** App name in the browser tab, the installed Home Screen app and notifications. */
  appName: "rnldvrgl HQ",
  shortName: "HQ",

  /** The sign-in page. */
  login: {
    /** The line under the greeting. */
    tagline: "Your AI team is on the clock.",
    /**
     * What's behind the glass card: "street" is the office's street at this hour in your city (sky, sun or
     * moon, lit windows at night); "aurora" is soft colour fields in the app's colour style.
     */
    backdrop: "street" as LoginBackdrop,
    /**
     * When to ask you to sign in again after closing the app (or the tab) and coming back:
     * "phones" asks on phones and tablets only, "always" on every device, "never" keeps you signed in
     * for weeks like before. Each new open asks again, which is handy for using a passkey.
     */
    askAgain: "phones" as AskAgain,
  },

  /** Default colour style of the app (Settings → Appearance can change it per device). "blush" is the rosé look. */
  style: "slate" as StyleName,

  /** Where the office is: live weather, the wall clock's city label, the skyline. Time zone is Philippine time. */
  city: {
    name: "Mabalacat",
    full: "Mabalacat City, Pampanga",
    /** Upper-case label on the LED under the wall clock. */
    clockLabel: "MABALACAT",
    lat: 15.2215,
    lon: 120.5735,
  },

  /**
   * The town around the office. realBrands: real Philippine chains on the signs (Jollibee, McDonald's, Shell,
   * Petron, 7-Eleven, Mercury Drug). Set it to false for a copy you publish, to show generic look-alike names.
   */
  town: { realBrands: true, barangay: "BRGY. DAU" },

  /** The car parked outside. */
  car: { plate: "HQ 2026", badge: "TYPE R" },

  /**
   * Employee names (the jobs stay the same). Leave one out to keep its default name.
   * ids: chief-of-staff, inbox-triage, job-hunter, reminder-bot, scheduler, researcher, dev-assistant, weekly-reviewer
   */
  teamNames: {} as Partial<Record<string, string>>,

  /** The janitor who mops the floor three times a day. */
  janitorName: "Malupiton",
} as const;

/** "Ronald's", "Maria's", "James'" */
export const possessive = (name: string): string => (name.endsWith("s") ? `${name}'` : `${name}'s`);
export const OWNER = HQ.owner.name;
export const OWNERS = possessive(HQ.owner.name);
