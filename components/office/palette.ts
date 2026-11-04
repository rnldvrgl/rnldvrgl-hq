/**
 * Colours and layout for the 3D office. WebGL can't read CSS variables, so the palette lives here.
 * The time of day is handled by the lights (see Lighting.tsx), so surfaces keep one set of colours.
 */
export const PAL = {
  // shell
  floor: "#d9c2a0", floorSeam: "#c2a77f", tile: "#e7e4de", tileSeam: "#cfcac1",
  wall: "#f1ebe2", wallSide: "#e8e0d4", accentWall: "#2f5249", slat: "#a8784f", slatDark: "#7d5838",
  trim: "#3a4650", baseboard: "#d8cfc2", windowFrame: "#2b3640", sill: "#f6f6f4",
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

/** The Blush style's office: a dusty-rose feature wall, blush sofa and rugs, rosé-gold lamps (same layout). */
export const PAL_BLUSH: Palette = {
  ...PAL,
  accentWall: "#a86a80", slat: "#c79a86", slatDark: "#a87866",
  sofa: "#d7a4b6", sofaDark: "#c08aa0", rugLounge: "#f1dde3", rug: "#b9728f",
  lampShade: "#e8b4a0", officeFloor: "#8a5f52", divider: "#d9b7c2", signAccent: "#f0a3c4", selected: "#b0577f",
};

/** Shirt colours, matching --c1..--c8 in globals.css. */
export const SHIRTS = ["#e0a43a", "#4a8fd8", "#2f9e8f", "#d46a6a", "#8a6fd1", "#5aa34f", "#3f5c7a", "#c46aa6"] as const;

/**
 * Room geometry in metres (= the tile units of lib/team.ts desk positions).
 * The team's desks fill x 1–9.9; the owner's glass office takes the back-right corner beyond that;
 * the pantry and dining table sit in front of it, and the street entrance is on the right wall.
 * The front zone (z > FRONT_Z) has a glass meeting room, the stand-up circle and the lounge.
 */
export const ROOM = { W: 15.3, D: 11.2, H: 2.7 } as const;
/** Where the desk floor ends and the front zone (meeting room, stand-up area, lounge) begins. */
export const FRONT_Z = 8.3;
export const DESK = { W: 1.7, D: 0.85, H: 0.74 } as const;
/** The owner's office: from x0 to the room's right edge, from the back wall (z = 0) to z1. Door gap at x0..x0+1. */
export const OFFICE = { x0: 10.7, x1: ROOM.W, z1: 4.2, doorX: 11.2 } as const;
/** Glass entrance on the right wall, centred on z. */
export const ENTRANCE = { z: 6.6, w: 1.3 } as const;
/** Paved lot outside the entrance: the covered carport at the front, the bins and the vape gazebo at the back. */
export const OUTSIDE = { x0: ROOM.W + 0.05, x1: ROOM.W + 8.5, z0: 0, z1: ROOM.D } as const;
/**
 * The carport: a lean-to roof off the building's side wall over two bays (the boss's car, and the team's
 * scooters and bike), and the walkway from the door to the street. People walking out stay dry.
 */
export const CARPORT = { x0: ROOM.W, x1: ROOM.W + 5.75, z0: 5.95, z1: ROOM.D, yWall: 2.75, yEdge: 2.45 } as const;
/** The roofed vape gazebo at the back of the lot (the 4:00–4:30 PM break, and where idle people hang out). */
export const VAPE = { x: ROOM.W + 7.0, z: 3.15, r: 0.8 } as const;
/** The gazebo's deck, centred on VAPE. */
export const VAPE_DECK = { w: 2.3, d: 3.3 } as const;
export const DUMPSTER = { x: ROOM.W + 1.75, z: 4.25 } as const;
/** The big bin inside, by the entrance: everyone empties their desk bin into it at 5:30 PM. */
export const MAIN_BIN = { x: ROOM.W - 0.38, z: 8.05 } as const;
/** Dining table in front of the pantry (lunch). */
export const DINING = { x: 12.95, z: 7.0, w: 2.6, d: 0.9 } as const;
/** Stand-up circle in the front zone. */
export const HUDDLE = { x: 7.4, z: 9.6, r: 1.05 } as const;
/** Glass meeting room in the front-left corner. */
export const MEETING = { x1: 4.4, z0: 8.65 } as const;
/** Lounge in the front-right. */
export const LOUNGE = { x: 12.9, z: 9.9 } as const;
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
  /** Along the front zone, between the dining table and the lounge. */
  lounge: 8.4,
} as const;

/** Font for 3D text (clock, signs). Served from /public so it works offline and in the installed app;
 *  without it drei's <Text> would fetch a default font from a CDN at runtime. */
export const SCENE_FONT = "/fonts/ibm-plex-mono-latin-500-normal.woff";
