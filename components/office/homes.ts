import { TEAM, type EmployeeId } from "@/lib/team";
import { HQ } from "@/hq.config";
import { SHIRTS } from "./palette";
import { BACK_STREETS, SIDE_STREETS } from "./world";

/**
 * Who lives where. Every house on the residential streets has a slot (the same list Neighbourhood.tsx builds
 * from); the team and the boss each own one in the first street behind the office. Their house is painted in
 * their colour, has a name badge floating over it (HomeBadges.tsx), and is where they walk to at the end of
 * the day (routes.ts) and from in the morning.
 */

export type HouseSlot = { i: number; row: number; x: number; gateZ: number };

/** The deterministic random stream each house is built from (Neighbourhood.tsx's house()). */
export function rnd(seed: number): () => number {
  let s = (seed * 9301 + 49297) % 2147483647;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
/** Does house i get an upstairs? (The same draws house() makes: its width, then this.) */
const twoStorey = (i: number) => { const r = rnd(i + 3); r(); return r() < 0.45; };

/** Every house lot, in build order: x is the lot's left edge, gateZ the fence line on the street. */
export const HOUSE_SLOTS: readonly HouseSlot[] = (() => {
  const out: HouseSlot[] = [];
  let i = 0;
  BACK_STREETS.forEach((b, row) => {
    const gateZ = b.z0 - 0.45;
    for (let x = -46 + row * 3.4; x < 66; x += 7.6) {
      if (SIDE_STREETS.some((st) => x + 7 > st.x0 - 0.3 && x - 0.5 < st.x1 + 0.3)) continue; // keep the side streets clear
      out.push({ i, row, x, gateZ });
      i++;
    }
  });
  return out;
})();

export type Who = EmployeeId | "owner";

export type Home = {
  who: Who;
  name: string;
  /** Their colour (shirt colour; the boss's is charcoal and gold). */
  color: string;
  slot: HouseSlot;
  /** Middle of the gate on the street, and the front door inside the yard. */
  gate: { x: number; z: number };
  door: { x: number; z: number };
  /** Where the name badge floats. */
  badge: [number, number, number];
};

/** The house a gate is in: gate 0.2–2.8 m in from the lot's left edge, the door 1 m in, 1.9 m behind the fence. */
const homeAt = (slot: HouseSlot, who: Who, name: string, color: string): Home => ({
  who, name, color, slot,
  gate: { x: slot.x + 1.5, z: slot.gateZ },
  door: { x: slot.x + 1.0, z: slot.gateZ - 1.9 + 0.3 },
  badge: [slot.x + 3, who === "owner" || twoStorey(slot.i) ? 6.6 : 4.4, slot.gateZ - 3.2],
});

/** Lot x (left edge) of each person's house on the first street, nearest the office first. The boss's is right behind it. */
const OWNER_LOT = 7.2;
/** The boss's big house takes two lots side by side (Mansion in Neighbourhood.tsx). */
export const OWNER_LOTS = [7.2, 14.8] as const;
const TEAM_LOTS = [-0.4, -8, 22.4, 30, 37.6, -23.2, -30.8, -38.4];

const slotAt = (x: number) => HOUSE_SLOTS.find((s) => s.row === 0 && Math.abs(s.x - x) < 0.01)!;

export const OWNER_COLOR = "#f59e0b";

export const HOMES: readonly Home[] = [
  homeAt(slotAt(OWNER_LOT), "owner", HQ.owner.name, OWNER_COLOR),
  ...TEAM.map((m, k) => homeAt(slotAt(TEAM_LOTS[k % TEAM_LOTS.length]), m.id, m.name, SHIRTS[m.color - 1])),
];

export const homeOf = (who: Who): Home => HOMES.find((h) => h.who === who)!;

/**
 * The boss's house: a modern two-storey on the double lot behind the office, with a garage on its right.
 * x0..x1 along the street, the wall and gates on gateZ; the car parks in the garage facing −z.
 */
export const MANSION = (() => {
  const x0 = OWNER_LOTS[0] - 0.2, x1 = OWNER_LOTS[1] + 7.2, gateZ = slotAt(OWNER_LOTS[0]).gateZ;
  const garage = { x0: x1 - 4.6, x1: x1 - 0.6 };
  return {
    x0, x1, gateZ,
    /** The house's front wall, its back wall. */
    front: gateZ - 3.0, back: gateZ - 8.0,
    garage,
    /** Middle of the driveway gate, and where the car stands in the garage. */
    driveX: (garage.x0 + garage.x1) / 2,
    park: { x: (garage.x0 + garage.x1) / 2, z: gateZ - 5.4 },
  };
})();
/** The home on this lot, if someone from the office lives there. */
export const homeBySlot = (i: number): Home | undefined => HOMES.find((h) => h.slot.i === i);
