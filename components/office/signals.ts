import { FAR_WALK, ROAD, SIDE_STREETS, SIDEWALK } from "./world";

/**
 * The traffic lights where the two side streets meet the main road. Cars (Traffic.tsx), the lights
 * themselves (TrafficLights.tsx) and the people walking (Walkers.tsx) all read the same clock, so a car
 * stops on red exactly when people get the walk signal.
 *
 * One 32-second cycle per junction (the two are offset so they don't change together):
 *   main road   green 0–17 s, amber 17–20 s, red 20–32 s
 *   walk        (crossing the main road, and the side street's own traffic) green 21–29 s, flashing 29–31 s
 * A second of all-red on each change, like real signals.
 */

export const CYCLE = 32;
export type Lamp = "green" | "amber" | "red";

export type Junction = {
  /** The side street's mouth. */
  x0: number; x1: number;
  /** Centre of the zebra crossing over the main road (just west of the side street) and its width along x. */
  crossX: number; crossW: number;
  /** Where each main-road lane stops: near lane drives +x (stops west of the zebra), far lane −x (stops east of the junction). */
  stopNear: number; stopFar: number;
  offset: number;
};

export const JUNCTIONS: readonly Junction[] = SIDE_STREETS.map((st, i) => {
  const crossW = 2.2, crossX = st.x0 - 0.4 - crossW / 2;
  return { x0: st.x0, x1: st.x1, crossX, crossW, stopNear: crossX - crossW / 2 - 0.45, stopFar: st.x1 + 0.7, offset: i * 11 };
});

/** The road and sidewalks the zebra joins. */
export const CROSS_Z = { near: (SIDEWALK.z0 + SIDEWALK.z1) / 2, far: (FAR_WALK.z0 + FAR_WALK.z1) / 2, road0: ROAD.z0, road1: ROAD.z1 } as const;

/** Seconds on the shared signal clock. */
export const signalClock = (): number => performance.now() / 1000;

const inCycle = (j: Junction, t: number) => (((t + j.offset) % CYCLE) + CYCLE) % CYCLE;

/** The main road's lamp. */
export function mainLamp(j: Junction, t: number): Lamp {
  const c = inCycle(j, t);
  return c < 17 ? "green" : c < 20 ? "amber" : "red";
}

/** The walk signal (and the side street's lamp). */
export function walkLamp(j: Junction, t: number): Lamp {
  const c = inCycle(j, t);
  return c >= 21 && c < 29 ? "green" : c >= 29 && c < 31 ? "amber" : "red";
}

/** Seconds of walk-green left (0 when it isn't green): people only start across if they'll make it. */
export function walkLeft(j: Junction, t: number): number {
  const c = inCycle(j, t);
  return c >= 21 && c < 29 ? 29 - c : 0;
}
