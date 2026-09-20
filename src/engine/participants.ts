import type { Player, Room } from "@/types";

/** Legacy players without an explicit role remain players. */
export function isParticipant(player: Player): boolean {
  return player.role !== "display";
}
export function participantIds(room: Room<unknown>): string[] {
  return (room.participantIds ?? Object.keys(room.players ?? {})).filter(
    (id) => room.players?.[id] && isParticipant(room.players[id]),
  );
}
export function connectedParticipantIds(room: Room<unknown>): string[] {
  return participantIds(room).filter((id) => room.players[id].isConnected !== false);
}
/** Give engines only the match roster, never a display or a mid-match joiner. */
export function engineRoom<S>(room: Room<S>): Room<S> {
  return { ...room, players: Object.fromEntries(participantIds(room).map((id) => [id, room.players[id]])) };
}
