import { Sun, Inbox, Briefcase, Bell, CalendarDays, BookOpen, Code2, ClipboardCheck, type LucideIcon } from "lucide-react";
import type { IconName } from "@/lib/team";

export const ICONS: Record<IconName, LucideIcon> = {
  sun: Sun,
  inbox: Inbox,
  briefcase: Briefcase,
  bell: Bell,
  calendar: CalendarDays,
  book: BookOpen,
  code: Code2,
  clipboard: ClipboardCheck,
};

export const STATUS_LABEL = {
  idle: "Idle",
  working: "Working",
  needs_you: "Needs you",
  error: "Hit an error",
  off: "Paused",
} as const;

/** Tailwind classes for the status lamp, from the --st-* tokens. */
export const LAMP = {
  idle: "bg-idle",
  working: "bg-working animate-pulse",
  needs_you: "bg-needs animate-pulse",
  error: "bg-error",
  off: "bg-off",
} as const;

export type LampKey = keyof typeof LAMP;
