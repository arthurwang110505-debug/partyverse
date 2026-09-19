import type { RoomSettings } from "@/types";

/** Characters used for room codes. Ambiguous glyphs (0/O, 1/I/L) are excluded. */
export const ROOM_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 5;

export const AVATARS = ["🦊", "🐻", "🦁", "🐼", "🐨", "🦄", "🐙", "🦋", "🐸", "🦈", "🐯", "🦉"];

export const SESSION_KEY = "partyverse_session";
export const NICKNAME_KEY = "partyverse_nickname";

/** Idle rooms older than this may be swept. */
export const ROOM_TTL_MS = 6 * 60 * 60 * 1000;

/** A host that has not ticked in this long is treated as gone. */
export const HOST_STALE_MS = 20_000;

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  timer: 15,
  difficulty: "easy",
  rounds: 3,
  soundEnabled: true,
  ageMode: "family",
};

export const MAX_NICKNAME_LENGTH = 16;
