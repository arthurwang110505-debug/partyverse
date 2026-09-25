import type { Player, Room } from "@/types";

/**
 * The room this browser tab is currently in, kept outside React.
 *
 * `/create`, `/join` and `/room` each own a route-group layout that mounts its
 * own `RoomProvider`, so Next.js unmounts one provider and mounts a brand new
 * one whenever a host walks the path create → host screen (or a phone walks
 * join → controller). A new provider starts with `room === null` and has to
 * re-read its stored session, which takes a round trip against the database.
 * During that window the room gate reads "no room here" as "not a member of this
 * room" and replaces the URL with `/join/<code>` — the flash a returning host
 * sees after creating a second room.
 *
 * Keeping the last snapshot here means a fresh provider can render the room it
 * was just in immediately, instead of showing nothing and being judged as an
 * outsider. This is per-tab client state only: it never touches storage, never
 * survives a reload, and is deliberately reset whenever the tab leaves a room.
 */
interface RoomSession {
  room: Room;
  player: Player | null;
}

let session: RoomSession | null = null;
let endedRoomCode: string | null = null;

/** Called whenever the provider learns a new room snapshot (or its own player). */
export function rememberRoomSession(room: Room, player: Player | null): void {
  if (typeof window === "undefined") return;
  session = { room, player };
  endedRoomCode = null;
}

/** The last known room of this tab, or null when this tab is not in a room. */
export function recallRoomSession(): RoomSession | null {
  if (typeof window === "undefined") return null;
  return session;
}

/** Left, ended, or the room no longer exists — nothing may be resumed. */
export function forgetRoomSession(): void {
  session = null;
}

/**
 * A room this tab was in that no longer exists, remembered across provider
 * remounts: `/room/<code>` must send these visitors home rather than to the join
 * form for a code that cannot be joined.
 */
export function rememberEndedRoom(roomCode: string): void {
  if (typeof window === "undefined") return;
  endedRoomCode = roomCode;
}

export function recallEndedRoom(): string | null {
  if (typeof window === "undefined") return null;
  return endedRoomCode;
}
