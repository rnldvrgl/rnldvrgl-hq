/** Colours for the 3D office. WebGL can't read CSS variables, so the two palettes live here. */
export type Palette = typeof DAY;

export const DAY = {
  floor: "#dfe4e8", floorLine: "#c8d0d6", wallLeft: "#c9d3d8", wallRight: "#d8e0e4", trim: "#9fb0ba",
  window: "#bfe3f2", windowGlow: 0.35, board: "#fbfcfd", boardInk: "#33414d", needsInk: "#c77a10",
  deskTop: "#e2c79c", deskSide: "#b8976a", deskMetal: "#8d99a3", drawer: "#d6bb8e", handle: "#4d5964",
  bezel: "#26313b", keycap: "#dfe5ea", mousepad: "#2e3a45",
  screenIdle: "#3a4b5a", screenOn: "#7fd3e8", screenOff: "#20272e", screenError: "#e07a7a", screenLine: "#c9f1fb",
  chair: "#3c4752", chairLeg: "#59656f", skin: "#c68b63", hair: "#2b2220",
  lampShade: "#e9b949", bulb: "#fff1c2",
  pot: "#6f7d77", leafA: "#4f9a6a", leafB: "#6bb383",
  clockFace: "#ffffff", clockInk: "#1b2733", clockSecond: "#d64545", ledPanel: "#0e1519", led: "#4ade80", ledDim: "#2c6b47",
  selected: "#0f7c86", ambient: 0.85, sun: 1.15, sunColor: "#fff6e8",
  // owner's corner office
  officeFloor: "#c9a77a", rug: "#2f6f78", glass: "#bfe6f2", glassOpacity: 0.16, glassFrame: "#55636e", frost: "#eef6f9",
  execDesk: "#5a3e2c", execDeskSide: "#3f2b1f", execChair: "#1f2328", ownerShirt: "#c2410c",
  ultrawide: "#5bb8e0", sideScreen: "#9b7bea", pcCase: "#1a1f24", sign: "#1b2733", signInk: "#ffffff", signAccent: "#5fd0d8",
  officeLight: "#ffe2b8",
};

export const NIGHT: Palette = {
  floor: "#1b242d", floorLine: "#26323d", wallLeft: "#222e39", wallRight: "#283541", trim: "#3b4b59",
  window: "#1d3550", windowGlow: 0.6, board: "#2b3844", boardInk: "#d8e2ea", needsInk: "#f0b04a",
  deskTop: "#8b6f4c", deskSide: "#5c472f", deskMetal: "#4c5761", drawer: "#7a6142", handle: "#1f262c",
  bezel: "#0b0f13", keycap: "#3a444d", mousepad: "#151c22",
  screenIdle: "#22313d", screenOn: "#63c7e0", screenOff: "#11161b", screenError: "#c95d5d", screenLine: "#b4ecf8",
  chair: "#2b343d", chairLeg: "#45515c", skin: "#b07a55", hair: "#1a1412",
  lampShade: "#c99a2e", bulb: "#ffe08a",
  pot: "#4e5a55", leafA: "#3f7d56", leafB: "#569a6b",
  clockFace: "#c9d3db", clockInk: "#0f151c", clockSecond: "#e05a5a", ledPanel: "#06090b", led: "#4ade80", ledDim: "#1d4a31",
  selected: "#4cc3cc", ambient: 0.45, sun: 0.55, sunColor: "#b9c8ff",
  officeFloor: "#5b4631", rug: "#1f4d54", glass: "#6fa9c4", glassOpacity: 0.12, glassFrame: "#2a343c", frost: "#9fb7c2",
  execDesk: "#3b2819", execDeskSide: "#281b11", execChair: "#121518", ownerShirt: "#ea580c",
  ultrawide: "#4aa6d0", sideScreen: "#8b6be0", pcCase: "#0b0e11", sign: "#0d1318", signInk: "#e6eef4", signAccent: "#4cc3cc",
  officeLight: "#ffcf8f",
};

/** Shirt colours, matching --c1..--c8 in globals.css. */
export const SHIRTS = ["#e0a43a", "#4a8fd8", "#2f9e8f", "#d46a6a", "#8a6fd1", "#5aa34f", "#3f5c7a", "#c46aa6"] as const;

/**
 * Room geometry, in the same tile units as lib/team.ts desk positions.
 * The team's desks fill x 1–9.9; the owner's glass office takes the back-right corner beyond that.
 */
export const ROOM = { W: 15.3, D: 8.3, H: 2.6 } as const;
export const DESK = { W: 1.7, D: 0.85, H: 0.74 } as const;
/** The owner's office: from x0 to the room's right edge, from the back wall (z = 0) to z1. */
export const OFFICE = { x0: 10.7, x1: ROOM.W, z1: 4.2 } as const;
/** Middle of the room volume: what the camera orbits by default. */
export const CENTER = { x: ROOM.W / 2, y: ROOM.H / 2, z: ROOM.D / 2 } as const;

/** Font for 3D text (clock, whiteboard, signs). Served from /public so it works offline and in the installed app;
 *  without it drei's <Text> would fetch a default font from a CDN at runtime. */
export const SCENE_FONT = "/fonts/ibm-plex-mono-latin-500-normal.woff";
