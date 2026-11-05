/** Chat rooms (isomorphic): the Lounge, everyone in the circle; and a direct message room per pair of HQs. */

export const LOUNGE = "lounge";
export const MESSAGE_MAX = 1000;

export type ChatMessage = { id: string; room: string; from_hq: string; body: string; created_at: string };

/** The DM room of two HQs: the same name whoever opens it. */
export const dmRoom = (a: string, b: string): string => `dm:${[a, b].sort().join(":")}`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function isRoom(room: unknown): room is string {
  if (room === LOUNGE) return true;
  if (typeof room !== "string" || !room.startsWith("dm:")) return false;
  const [a, b] = room.slice(3).split(":");
  return !!a && !!b && a !== b && UUID.test(a) && UUID.test(b) && room === dmRoom(a, b);
}

/** May this HQ read and write in this room? (The Lounge: everyone; a DM: its two HQs.) */
export const canUse = (room: string, hq: string): boolean => room === LOUNGE || room.slice(3).split(":").includes(hq);

/** The other HQ of a DM room. */
export const otherOf = (room: string, me: string): string | null =>
  room.startsWith("dm:") ? room.slice(3).split(":").find((x) => x !== me) ?? null : null;
