/** Colours for the 3D office. WebGL can't read CSS variables, so the two palettes live here. */
export type Palette = typeof DAY;

export const DAY = {
  floor: "#dfe4e8", floorLine: "#c8d0d6", wallLeft: "#c9d3d8", wallRight: "#d8e0e4", trim: "#9fb0ba",
  window: "#bfe3f2", windowGlow: 0.35, board: "#fbfcfd", boardInk: "#33414d",
  deskTop: "#e2c79c", deskSide: "#b8976a", bezel: "#26313b",
  screenIdle: "#3a4b5a", screenOn: "#7fd3e8", screenOff: "#20272e", screenError: "#e07a7a",
  chair: "#3c4752", chairLeg: "#59656f", skin: "#c68b63", hair: "#2b2220",
  pot: "#6f7d77", leafA: "#4f9a6a", leafB: "#6bb383", clockFace: "#ffffff", clockInk: "#1b2733",
  selected: "#0f7c86", ambient: 0.85, sun: 1.15, sunColor: "#fff6e8",
};

export const NIGHT: Palette = {
  floor: "#1b242d", floorLine: "#26323d", wallLeft: "#222e39", wallRight: "#283541", trim: "#3b4b59",
  window: "#1d3550", windowGlow: 0.6, board: "#2b3844", boardInk: "#d8e2ea",
  deskTop: "#8b6f4c", deskSide: "#5c472f", bezel: "#0b0f13",
  screenIdle: "#22313d", screenOn: "#63c7e0", screenOff: "#11161b", screenError: "#c95d5d",
  chair: "#2b343d", chairLeg: "#45515c", skin: "#b07a55", hair: "#1a1412",
  pot: "#4e5a55", leafA: "#3f7d56", leafB: "#569a6b", clockFace: "#c9d3db", clockInk: "#0f151c",
  selected: "#4cc3cc", ambient: 0.45, sun: 0.55, sunColor: "#b9c8ff",
};

/** Shirt colours, matching --c1..--c8 in globals.css. */
export const SHIRTS = ["#e0a43a", "#4a8fd8", "#2f9e8f", "#d46a6a", "#8a6fd1", "#5aa34f", "#3f5c7a", "#c46aa6"] as const;

/** Room geometry, in the same tile units as lib/team.ts desk positions. */
export const ROOM = { W: 10.6, D: 8.3, H: 2.6 } as const;
export const DESK = { W: 1.7, D: 0.85, H: 0.74 } as const;
export const CENTER = { x: ROOM.W / 2, z: ROOM.D / 2 + 0.4 } as const;
