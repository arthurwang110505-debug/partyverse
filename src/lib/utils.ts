import { AVATARS, MAX_NICKNAME_LENGTH, ROOM_CODE_CHARS, ROOM_CODE_LENGTH } from "@/constants/room";

export function generateRoomCode(length = ROOM_CODE_LENGTH): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ROOM_CODE_CHARS.charAt(bytes[i] % ROOM_CODE_CHARS.length);
  }
  return code;
}

export function generatePlayerId(): string {
  return `player_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function cn(...classes: Array<string | false | undefined | null>): string {
  return classes.filter(Boolean).join(" ");
}

export function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Deterministic emoji for a name, so a returning player looks the same. */
export function getAvatarFromName(name: string): string {
  let hash = 0;
  for (const c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return AVATARS[Math.abs(hash) % AVATARS.length];
}

/**
 * First unused avatar in the room, falling back to a hash of the nickname.
 *
 * Previously every player in a room was given the *game's* icon as their avatar,
 * so a Bomb Countdown lobby showed fifteen identical 💣.
 */
export function pickAvatar(nickname: string, takenAvatars: Iterable<string>): string {
  const taken = new Set(takenAvatars);
  const free = AVATARS.find((a) => !taken.has(a));
  return free ?? getAvatarFromName(nickname);
}

/**
 * Nicknames are typed by strangers in a shared lobby and rendered to a big
 * screen. React escapes them, so this is about readability, not injection:
 * strip control characters and zero-width glyphs, collapse whitespace, cap length.
 */
export function sanitizeNickname(raw: unknown, maxLength = MAX_NICKNAME_LENGTH): string {
  const str = typeof raw === "string" ? raw : String(raw ?? "");
  return str
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028\u2029\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

/** Normalise a typed room code: uppercase, drop anything outside the alphabet. */
export function normalizeRoomCode(raw: unknown): string {
  const str = typeof raw === "string" ? raw : String(raw ?? "");
  return str
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, ROOM_CODE_LENGTH);
}
