/**
 * Colours and layout for the 3D office. WebGL can't read CSS variables, so the palette lives here.
 * The time of day is handled by the lights (see Lighting.tsx), so surfaces keep one set of colours.
 */
export const PAL = {
  // shell
  floor: "#d9c2a0", floorSeam: "#c2a77f", tile: "#e7e4de", tileSeam: "#cfcac1",
  wall: "#eceeec", wallSide: "#e3e6e4", accentWall: "#2f5249", slat: "#a8784f", slatDark: "#7d5838",
  trim: "#3a4650", baseboard: "#cfd3d1", windowFrame: "#2b3640", sill: "#f6f6f4",
  // furniture
  deskTop: "#f3f1ec", deskEdge: "#c9a77c", deskLeg: "#2b3640", divider: "#9fb7ad", drawer: "#e7e3dc", handle: "#3a4650",
  bezel: "#1d252c", keycap: "#e8ecef", mousepad: "#2e3a45", metal: "#9aa5ae",
  screenIdle: "#33475a", screenOn: "#7fd3e8", screenOff: "#141a20", screenError: "#e07a7a", screenNeeds: "#f2b23a", screenLine: "#d4f4fb",
  chair: "#2f3a44", chairLeg: "#59656f",
  lampShade: "#e9b949", bulb: "#fff1c2",
  pot: "#d8d2c8", potDark: "#5e6a64", leafA: "#3f8a5a", leafB: "#5fae78", leafC: "#2f6f4a",
  sofa: "#5c7f9c", sofaDark: "#4a6982", rugLounge: "#e0d6c6", wood: "#b88a5e", woodDark: "#8a6342",
  counter: "#f4f2ee", counterSide: "#2f3a44", steel: "#c4ccd2",
  // people
  skin: ["#c68b63", "#e0ac84", "#a8714d", "#f1c6a0", "#8d5a3b"] as readonly string[],
  hair: "#2b2220", pants: "#2f3a4a", shoes: "#1c2228",
  // clock & signs
  clockFace: "#ffffff", clockInk: "#1b2733", clockSecond: "#d64545", ledPanel: "#0e1519", led: "#4ade80", ledDim: "#2c6b47",
  board: "#0f1a22", boardInk: "#d8e8f0", boardAccent: "#5fd0d8", needsInk: "#f2b23a",
  selected: "#0f7c86",
  // owner's corner office
  officeFloor: "#7a5638", rug: "#2f6f78", glass: "#bfe6f2", glassOpacity: 0.14, glassFrame: "#2b3640", frost: "#eef6f9",
  execDesk: "#4a3324", execDeskSide: "#33231a", execChair: "#1f2328", ownerShirt: "#1f3a52",
  ultrawide: "#5bb8e0", sideScreen: "#9b7bea", pcCase: "#1a1f24", sign: "#1b2733", signInk: "#ffffff", signAccent: "#5fd0d8",
  // utilities
  ac: "#f7f8f8", acVent: "#b9c1c6", acLed: "#34d399", condenser: "#d9dcdc", fan: "#3a4650",
  bin: "#3d4a55", binLid: "#56636e", paper: "#f4f1ea", bag: "#20262c",
  dumpster: "#2f6d4f", dumpsterLid: "#245a40", concrete: "#b9bcb8", concreteSeam: "#a6a9a5", grass: "#6aa35c", asphalt: "#5b6166",
  janitor: "#3b82a0", janitorCap: "#f59e0b", bucket: "#facc15", mop: "#e5e7eb",
};

export type Palette = typeof PAL;

/** Shirt colours, matching --c1..--c8 in globals.css. */
export const SHIRTS = ["#e0a43a", "#4a8fd8", "#2f9e8f", "#d46a6a", "#8a6fd1", "#5aa34f", "#3f5c7a", "#c46aa6"] as const;

/**
 * Room geometry in metres (= the tile units of lib/team.ts desk positions).
 * The team's desks fill x 1–9.9; the owner's glass office takes the back-right corner beyond that;
 * the pantry and lounge sit in front of it, and the street entrance is on the right wall.
 */
export const ROOM = { W: 15.3, D: 8.3, H: 2.7 } as const;
export const DESK = { W: 1.7, D: 0.85, H: 0.74 } as const;
/** The owner's office: from x0 to the room's right edge, from the back wall (z = 0) to z1. Door gap at x0..x0+1. */
export const OFFICE = { x0: 10.7, x1: ROOM.W, z1: 4.2, doorX: 11.2 } as const;
/** Glass entrance on the right wall, centred on z. */
export const ENTRANCE = { z: 6.6, w: 1.3 } as const;
/** Paved area outside the entrance, with the big bin. */
export const OUTSIDE = { x0: ROOM.W + 0.05, x1: ROOM.W + 3.1, z0: 3.0, z1: ROOM.D } as const;
export const DUMPSTER = { x: ROOM.W + 1.75, z: 4.25 } as const;
/** Whole diorama (room + outside), for camera framing and limits. */
export const SCENE = { x0: 0, x1: OUTSIDE.x1, z0: 0, z1: ROOM.D } as const;
/** Middle of the room volume: what the camera orbits by default. */
export const CENTER = { x: SCENE.x1 / 2, y: ROOM.H / 2, z: ROOM.D / 2 } as const;
/** Seat height of the office chairs (employees sit with their hips here). */
export const SEAT_Y = 0.5;

/** Walking lanes (z) and the gaps between desks (x) that people use to get around. */
export const LANES = {
  /** Between the back row's chairs and the front row's desks. */
  mid: 4.3,
  /** In front of the front row's chairs. */
  front: 7.65,
  /** Along the back wall, behind the back row. */
  back: 0.8,
  /** Left wall aisle. */
  left: 0.5,
  /** Between the last desk and the owner's glass. */
  right: 10.3,
  /** Through the pantry, past the counter. */
  pantry: 5.7,
} as const;

/** Font for 3D text (clock, signs). Served from /public so it works offline and in the installed app;
 *  without it drei's <Text> would fetch a default font from a CDN at runtime. */
export const SCENE_FONT = "/fonts/ibm-plex-mono-latin-500-normal.woff";
