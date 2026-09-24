/**
 * Which screen a `/room/<code>` visitor belongs on.
 *
 * Pulled out of `RoomGate` as a pure function because the decision is the source
 * of a real production bug: a host who had just created a room was sent to the
 * join form. A room can be missing from the provider for two very different
 * reasons — "this device is not in this room" (bounce to `/join/<code>`) and
 * "the provider is still opening this room" (wait). Treating the second as the
 * first threw hosts out of their own lobby.
 */
export type RoomEntryDecision =
  /** Still opening/restoring this room: show the connecting screen, never redirect. */
  | "wait"
  /** Not a member of this room: send them to the join form for it. */
  | "join"
  /** This room is gone (ended, or removed by another device): go home instead. */
  | "home"
  /** In the room, but on the display-only host screen without being the host. */
  | "play"
  /** In the room on the right side: render the page. */
  | "ready";

export interface RoomEntryInput {
  /** Room code from the URL. */
  roomCode: string;
  /** Provider is still resolving its stored session. */
  loading: boolean;
  /** Room the provider is currently opening (create/join/restore) but has not confirmed. */
  pendingRoomCode: string | null;
  /** Room currently held by the provider, if any. */
  roomId: string | null;
  /** Room this tab was in that no longer exists, if any. */
  lostRoomCode?: string | null;
  hasPlayer: boolean;
  hostOnly: boolean;
  isHost: boolean;
  isDisplay: boolean;
}

/** Room codes are case-insensitive in URLs; `abcde` and `ABCDE` are one room. */
export function sameRoomCode(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.trim().toUpperCase() === b.trim().toUpperCase();
}

export function decideRoomEntry(input: RoomEntryInput): RoomEntryDecision {
  const inRoom = input.hasPlayer && sameRoomCode(input.roomId, input.roomCode);
  if (!inRoom) {
    // A handshake in progress for this very room is not a rejection: the host
    // view must survive the moment between "room created" and "room received".
    const openingThisRoom = sameRoomCode(input.pendingRoomCode, input.roomCode);
    if (input.loading || openingThisRoom) return "wait";
    // Ending a room clears the session; the join form for a code that no longer
    // exists is a dead end, so the tab goes home instead of racing there.
    return sameRoomCode(input.lostRoomCode, input.roomCode) ? "home" : "join";
  }
  if (input.hostOnly && !input.isHost && !input.isDisplay) return "play";
  return "ready";
}
