import type { HostMode, Player, Room } from "@/types";
import { DEFAULT_HOST_MODE, DEFAULT_HOST_PLAYS, isHostMode } from "@/constants/hostMode";
import { isParticipant } from "@/engine/participants";
import { RULES_PHASE } from "@/engine/rulesTour";

/** Which phone-host tab is on screen. */
export type PhoneHostTab = "stage" | "controller";

/**
 * A room's presentation mode.
 *
 * Rooms created before phone-host mode existed have no `hostMode`. They are
 * big-screen rooms, so every read goes through this function instead of
 * touching `room.hostMode` directly.
 */
export function hostModeOf(room: Pick<Room, "hostMode"> | null | undefined): HostMode {
  const value = room?.hostMode;
  return isHostMode(value) ? value : DEFAULT_HOST_MODE;
}

export function isPhoneHostRoom(room: Pick<Room, "hostMode"> | null | undefined): boolean {
  return hostModeOf(room) === "phone";
}

/**
 * The player record a newly created room gets for its host.
 *
 * - Big screen → display seat: never takes a turn, never counts toward limits,
 *   always "ready" because there is nothing for it to confirm.
 * - Phone → a display seat when the host only wants to present, or a normal
 *   participant when they want to play. A playing host is *not* pre-readied:
 *   they should confirm readiness like everybody else in the lobby.
 */
export function resolveHostRole(
  hostMode: HostMode,
  hostPlays: boolean | undefined,
): { role: NonNullable<Player["role"]>; isReady: boolean } {
  const plays = hostMode === "phone" && (hostPlays ?? DEFAULT_HOST_PLAYS);
  return plays ? { role: "player", isReady: false } : { role: "display", isReady: true };
}

/** True when the host phone is also a player (phone mode + host plays). */
export function hostIsPlaying(room: Room | null | undefined): boolean {
  const host = room ? room.players?.[room.hostPlayerId] : null;
  return Boolean(host && isParticipant(host));
}

/**
 * First tab shown when a phone host opens a game.
 *
 * The briefing phase needs the host's own controller (the "我看懂了" button
 * lives there), so it opens on the controller; play opens on the stage.
 */
export function initialPhoneHostTab(room: Room | null | undefined): PhoneHostTab {
  if (!room) return "stage";
  return room.gameState?.phase === RULES_PHASE ? "controller" : "stage";
}

/**
 * What to call the shared screen in copy that used to say "電視" / "大螢幕".
 * Phones have no television, and telling a player to "look at the TV" when the
 * host is holding one is simply wrong.
 */
export function screenLabel(room: Pick<Room, "hostMode"> | null | undefined): string {
  return isPhoneHostRoom(room) ? "主持畫面" : "電視大螢幕";
}

/**
 * Short noun for the shared screen inside a sentence: "看<noun>揭曉".
 * `screenLabel` is the fuller form ("電視大螢幕") for standalone copy.
 */
export function screenNoun(room: Pick<Room, "hostMode"> | null | undefined): string {
  return isPhoneHostRoom(room) ? "主持畫面" : "大螢幕";
}

/** Whether this room needs the phone-host chrome at all. */
export function usesPhoneHostChrome(room: Room | null | undefined): boolean {
  return Boolean(room && isPhoneHostRoom(room));
}

/** Best guess for a sensible default, used before the host picks a card. */
export function defaultHostModeFor(view: { width: number; isTouchDevice?: boolean }): HostMode {
  if (!view.width) return DEFAULT_HOST_MODE;
  const narrow = view.width < 768;
  if (narrow && view.isTouchDevice !== false) return "phone";
  return DEFAULT_HOST_MODE;
}

/** A stored preference, or the device-based default when there is none. */
export function storedHostMode(
  raw: unknown,
  view: { width: number; isTouchDevice?: boolean },
): HostMode {
  return isHostMode(raw) ? raw : defaultHostModeFor(view);
}
