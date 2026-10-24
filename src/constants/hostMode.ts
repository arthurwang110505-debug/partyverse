import type { HostMode } from "@/types";

/**
 * The two ways to host a PartyVerse room.
 *
 * `tv` is the original experience and stays the default: one big screen shows
 * the stage, every player joins from a phone and the host screen is never a
 * participant. `phone` removes the big screen entirely — the host phone shows
 * the stage, and the host can play from that same phone.
 */
export interface HostModePreset {
  id: HostMode;
  label: string;
  short: string;
  icon: string;
  tagline: string;
  /** One line explaining who counts as a player in this mode. */
  hint: string;
  color: string;
}

export const HOST_MODES: readonly HostModePreset[] = [
  {
    id: "tv",
    label: "大螢幕主持",
    short: "電視",
    icon: "📺",
    tagline: "客廳電視或電腦當主畫面",
    hint: "主持畫面不占玩家名額，所有參賽者用手機掃碼加入。",
    color: "#22d3ee",
  },
  {
    id: "phone",
    label: "手機主持",
    short: "手機",
    icon: "📱",
    tagline: "沒有電視也能全場玩完",
    hint: "這支手機就是全場的主持畫面，可以同時下場一起玩。",
    color: "#a855f7",
  },
];

export const DEFAULT_HOST_MODE: HostMode = "tv";

export function isHostMode(value: unknown): value is HostMode {
  return value === "tv" || value === "phone";
}

export function hostModePreset(id: HostMode): HostModePreset {
  return HOST_MODES.find((mode) => mode.id === id) ?? HOST_MODES[0];
}

/** Guests always leave this choice on, so a phone-only party can start at 2. */
export const DEFAULT_HOST_PLAYS = true;

/** Remembers the host's choice between rooms on this device. */
export const HOST_MODE_STORAGE_KEY = "partyverse_host_mode";
