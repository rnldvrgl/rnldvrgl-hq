"use client";

import { create } from "zustand";

/**
 * Which Settings page is open, so anything in the office can send you straight to one
 * ("Connect it" on an unhired desk opens Settings → Connections).
 */
export type SettingsPage =
  | "appearance" | "team" | "boss" | "office" | "sound" | "holidays" | "connections" | "friends" | "account";

type Nav = { open: boolean; page: SettingsPage | null; openSettings: (page?: SettingsPage | null) => void; close: () => void; go: (page: SettingsPage | null) => void };

export const useSettingsNav = create<Nav>()((set) => ({
  open: false,
  page: null,
  openSettings: (page = null) => set({ open: true, page }),
  close: () => set({ open: false }),
  go: (page) => set({ page }),
}));

export const openSettings = (page?: SettingsPage | null): void => useSettingsNav.getState().openSettings(page);
