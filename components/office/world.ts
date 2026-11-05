import { CARPORT, OUTSIDE, ROOM, VAPE, VAPE_DECK } from "./palette";

/**
 * The town around the office, in the same metres as the room (x along the street, z toward the street).
 * The camera always looks from the front-right (+x, +z), so buildings face +z and their fronts are visible.
 *
 *   back (z < 0)       two residential streets, each lined with houses facing it (and the camera)
 *   same side (z ≤ D)  the office, its patio and yard, shops on both sides; a side street on the left
 *   street             sidewalk, two-lane road, far sidewalk
 *   across             gas station, basketball court, parking lot, a little park
 */

export const SIDEWALK = { z0: ROOM.D + 0.05, z1: ROOM.D + 1.4 } as const;
export const ROAD = { z0: SIDEWALK.z1, z1: SIDEWALK.z1 + 6.2 } as const;
export const FAR_WALK = { z0: ROAD.z1, z1: ROAD.z1 + 1.4 } as const;
/** The street runs far past anything the camera can reach, so its ends are never on screen. */
export const ROAD_X = { x0: -160, x1: 180 } as const;
/** Lanes: near lane drives toward +x, far lane toward -x. */
export const LANE = { near: ROAD.z0 + 1.55, far: ROAD.z0 + 4.55 } as const;

/** Side streets off the main road, running back past both residential streets (left of the office, and past McDonald's). */
export const SIDE_STREET = { x0: -6.4, x1: -3.2, z0: -60 } as const;
export const SIDE_STREET_2 = { x0: 52.2, x1: 55.4, z0: -60 } as const;
export const SIDE_STREETS = [SIDE_STREET, SIDE_STREET_2] as const;

/**
 * The residential streets behind the office, running along x. The houses of each row stand on the -z side
 * with their fronts and gates on the street, so from the camera you see their faces, not their backs.
 */
export const BACK_STREETS = [
  { z0: -8.4, z1: -5.2 },
  { z0: -20.6, z1: -17.4 },
] as const;
export const BACK_X = { x0: -70, x1: 90 } as const;
/** Lane centre and direction of each back street's single slow lane. */
export const BACK_LANE = [BACK_STREETS[0].z0 + 1.6, BACK_STREETS[1].z0 + 1.6] as const;

/** Republic Central Colleges' campus across the street, east of the barangay hall (students go in at its gate). */
export const SCHOOL = { x0: 57.5, x1: 77.5, gateX: 66.5 } as const;

/** One big ground plane: wide enough that zoomed all the way out, panned to the edge, you still see ground. */
export const GROUND = { cx: 10, cz: 8, size: 420 } as const;

/** Where the camera target may go: the whole neighbourhood, not the empty fields past it. */
export const TOWN = { x0: -26, x1: 66, z0: -12, z1: FAR_WALK.z1 + 10 } as const;

/** The office's own yard to the right of the patio (dog, trees), before the next shop. */
export const YARD_X1 = OUTSIDE.x1 + 5.7;

/** Roofs outdoors that keep the rain off: drops stop at them and nothing splashes underneath. */
export const ROOFS: readonly { x0: number; x1: number; z0: number; z1: number; y: number }[] = [
  { x0: CARPORT.x0, x1: CARPORT.x1, z0: CARPORT.z0, z1: CARPORT.z1, y: CARPORT.yEdge },
  { x0: VAPE.x - VAPE_DECK.w / 2 - 0.15, x1: VAPE.x + VAPE_DECK.w / 2 + 0.15, z0: VAPE.z - VAPE_DECK.d / 2 - 0.15, z1: VAPE.z + VAPE_DECK.d / 2 + 0.15, y: 2.55 },
];
export const underRoof = (x: number, z: number): { y: number } | undefined =>
  ROOFS.find((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);
