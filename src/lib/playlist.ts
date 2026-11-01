import type { PlayModeId, RoomSessionEntry, RoomSessionPlan, RoomSettings } from "@/types";
import { GAMES } from "@/constants/games";
import { isPlayable } from "@/engine";
import { gameSettingsProfile, normalizeSettings } from "@/constants/gameSettings";
import { settingsForPace, type PaceId } from "@/constants/pacePresets";
import { playModeById, type PlayMode } from "@/constants/playModes";

/**
 * Random playlist drawing for the time-boxed modes and the 8-game battle mode.
 *
 * Everything here is pure: no clock, no storage, no randomness beyond the
 * injected `random()`. Callers pass in what has already been played so the draw
 * can avoid repeats where possible, and the room stores the result as a
 * `RoomSessionPlan`.
 */

/** Used when a game's `estimatedDuration` cannot be read. */
const FALLBACK_RANGE = { lo: 5, hi: 10 };
/** Nothing may be shorter than a minute in the plan's accounting. */
const MIN_ENTRY_MINUTES = 1;
/** Shortening beyond this is not believable, so the estimate stops here. */
const MIN_VOLUME_RATIO = 0.4;
/** …and this is how much slower the estimate gets when rounds are pushed up. */
const MAX_VOLUME_RATIO = 1.5;
/** How many of the biggest fitting games a single time-box draw chooses between. */
const SHORTLIST_SIZE = 3;

export interface DurationRange {
  /** Fast end of the published estimate, in minutes. */
  lo: number;
  /** Slow end of the published estimate, in minutes. */
  hi: number;
}

/** `"3-8 分鐘"` → `{ lo: 3, hi: 8 }`; tolerant of full-width dashes and `"10 分鐘"`. */
export function parseDurationRange(text: string | null | undefined): DurationRange {
  const numbers = text?.match(/\d+/g);
  if (!numbers?.length) return { ...FALLBACK_RANGE };
  const lo = Number(numbers[0]);
  if (!Number.isFinite(lo) || lo <= 0) return { ...FALLBACK_RANGE };
  const hi = numbers.length > 1 ? Number(numbers[1]) : lo;
  return { lo, hi: Number.isFinite(hi) && hi > lo ? hi : lo };
}

export function durationRange(gameId: string): DurationRange {
  return parseDurationRange(GAMES.find((game) => game.id === gameId)?.estimatedDuration);
}

/**
 * Minutes a game is expected to take with `settings`.
 *
 * Anchored on the fast end of the game's published estimate and scaled by how
 * much play the settings ask for (rounds × seconds per round). A shortened game
 * therefore never claims to be longer than its own advertised floor, and a
 * tightened mode can still reach games whose default pace would blow the budget.
 */
export function estimatedMinutes(gameId: string, settings?: RoomSettings): number {
  const { lo, hi } = durationRange(gameId);
  const profile = gameSettingsProfile(gameId);
  const wanted = normalizeSettings(gameId, settings ?? {});
  const defaults = normalizeSettings(gameId);
  const volume = (value: RoomSettings) =>
    Math.max(1, value.rounds) * (profile.hasTimer ? Math.max(1, value.timer) : 30);
  const ratio = clamp(volume(wanted) / volume(defaults), MIN_VOLUME_RATIO, MAX_VOLUME_RATIO);
  return clamp(Math.round(lo * ratio), MIN_ENTRY_MINUTES, Math.max(hi, MIN_ENTRY_MINUTES));
}

/** A pace preset applied on top of the game's own defaults (never below them). */
function pacedSettings(gameId: string, pace: PaceId, patch: Partial<RoomSettings> = {}): RoomSettings {
  return normalizeSettings(gameId, {
    ...normalizeSettings(gameId),
    ...settingsForPace(gameId, pace),
    ...patch,
  });
}

/**
 * Suggested settings for a game that has to finish inside `budgetMinutes`:
 * the quick pace first, then fewer rounds, then the shortest legal timer.
 *
 * These are suggestions, not enforcement — the lobby still lets the host edit
 * every value, and `estimatedMinutes` re-reads whatever ends up stored.
 */
export function suggestedSettings(gameId: string, budgetMinutes: number): RoomSettings {
  const profile = gameSettingsProfile(gameId);
  const ladder: RoomSettings[] = [
    pacedSettings(gameId, "quick"),
    pacedSettings(gameId, "quick", { rounds: 1 }),
    pacedSettings(gameId, "quick", { rounds: 1, ...(profile.hasTimer ? { timer: profile.timerMin } : {}) }),
  ];
  return ladder.find((settings) => estimatedMinutes(gameId, settings) <= budgetMinutes) ?? ladder[ladder.length - 1];
}

/** Human summary of the suggestion, e.g. `"回合數 2 · 作答秒數 15 秒"`. */
export function settingsSummary(gameId: string, settings: RoomSettings): string {
  const profile = gameSettingsProfile(gameId);
  const parts: string[] = [];
  if (profile.hasTimer) parts.push(`${profile.timerLabel} ${settings.timer} 秒`);
  if (profile.maxRounds > 1) parts.push(`${profile.roundsLabel} ${settings.rounds}`);
  return parts.join(" · ") || "預設節奏";
}

export interface Playlist {
  mode: PlayModeId;
  /** Wall-clock budget for time-boxed modes; null for fixed-count modes. */
  budgetMinutes: number | null;
  /** Required playlist size for fixed-count modes such as battle. */
  targetGames: number | null;
  entries: RoomSessionEntry[];
  /** Sum of the entries' estimates — at most the budget for time-box modes. */
  totalMinutes: number;
  /** Games that fitted but were passed over because they were played recently. */
  avoided: string[];
}

export interface BuildPlaylistOptions {
  mode: PlayModeId | PlayMode;
  /** Restrict the draw to games that seat this many players (best effort). */
  playerCount?: number;
  /** Games already played this evening, most recent last. */
  history?: readonly string[];
  /** Limit the draw to these game ids (defaults to every playable game). */
  gameIds?: readonly string[];
  random?: () => number;
}

/**
 * Draw a playlist for the selected mode.
 *
 * Time-boxed modes stay inside their budget and draw as many unique games as
 * fit. Battle mode draws exactly `gameCount` distinct, seat-compatible games
 * whenever the pool contains enough; it returns a partial list otherwise so
 * the UI can explain why the tournament cannot start yet.
 */
export function buildPlaylist({
  mode,
  playerCount,
  history = [],
  gameIds,
  random = Math.random,
}: BuildPlaylistOptions): Playlist {
  const preset = typeof mode === "string" ? (playModeById(mode) ?? playModeById("standard")!) : mode;
  const budget = preset.budgetMinutes ?? 0;
  const targetGames = preset.gameCount ?? null;
  const isFixedCount = targetGames !== null;
  const roster = gameIds ?? GAMES.filter((game) => isPlayable(game.id)).map((game) => game.id);
  const played = [...history];
  const playedSet = new Set(played);

  /**
   * Freshness score: bigger is better. Never played scores `Infinity`; otherwise
   * the further back the game sits in `history`, the higher its score — so once
   * everything has been played the oldest games have priority.
   */
  const freshness = (gameId: string): number => {
    const index = played.lastIndexOf(gameId);
    return index === -1 ? Number.POSITIVE_INFINITY : played.length - index;
  };

  const draft = (seated: boolean): RoomSessionEntry[] =>
    GAMES.filter((game) => roster.includes(game.id) && isPlayable(game.id))
      .filter((game) => !seated || playerCount === undefined || (playerCount >= game.minPlayers && playerCount <= game.maxPlayers))
      .map((game) => {
        const settings = isFixedCount ? pacedSettings(game.id, "quick") : suggestedSettings(game.id, budget);
        return { gameId: game.id, minutes: estimatedMinutes(game.id, settings), settings, repeated: false };
      });

  // A time-box draw relaxes seat filtering if nobody can play any candidate.
  // Battle mode never does: eight incompatible games are worse than an explicit
  // "need more players" state.
  const seated = draft(true);
  const candidates = seated.length ? seated : isFixedCount ? [] : draft(false);
  const fitting = isFixedCount ? candidates : candidates.filter((entry) => entry.minutes <= budget);

  const entries: RoomSessionEntry[] = [];
  const used = new Set<string>();
  let remaining = budget;

  if (targetGames !== null) {
    while (entries.length < targetGames) {
      const pool = fitting.filter((entry) => !used.has(entry.gameId));
      if (!pool.length) break;
      const fresh = pool.filter((entry) => freshness(entry.gameId) === Number.POSITIVE_INFINITY);
      // Use unplayed games first, then bring back the least-recently-played
      // games before more recent repeats, while still randomizing within a tier.
      const oldestScore = Math.max(...pool.map((entry) => freshness(entry.gameId)));
      const oldestRepeats = pool.filter((entry) => freshness(entry.gameId) === oldestScore);
      const chooser = fresh.length ? fresh : oldestRepeats;
      const pick = chooser[Math.min(chooser.length - 1, Math.floor(random() * chooser.length))];
      entries.push({ ...pick, repeated: playedSet.has(pick.gameId) });
      used.add(pick.gameId);
    }
  } else {
    while (true) {
      const pool = fitting.filter((entry) => !used.has(entry.gameId) && entry.minutes <= remaining);
      if (!pool.length) break;
      const freshest = Math.max(...pool.map((entry) => freshness(entry.gameId)));
      const tier = pool.filter((entry) => freshness(entry.gameId) === freshest);
      const keepsGoing = tier.filter((entry) =>
        pool.some((other) => other.gameId !== entry.gameId && other.minutes <= remaining - entry.minutes),
      );
      const chooser = keepsGoing.length ? keepsGoing : tier;
      const shortlist = [...chooser].sort((a, b) => b.minutes - a.minutes).slice(0, SHORTLIST_SIZE);
      const pick = shortlist[Math.min(shortlist.length - 1, Math.floor(random() * shortlist.length))];
      entries.push({ ...pick, repeated: freshness(pick.gameId) !== Number.POSITIVE_INFINITY });
      used.add(pick.gameId);
      remaining -= pick.minutes;
    }

    // A budget tighter than every game still deserves one game to play.
    if (!entries.length && candidates.length) {
      const shortest = [...candidates].sort((a, b) => a.minutes - b.minutes)[0];
      entries.push({ ...shortest, repeated: freshness(shortest.gameId) !== Number.POSITIVE_INFINITY });
      used.add(shortest.gameId);
    }
  }

  return {
    mode: preset.id,
    budgetMinutes: preset.budgetMinutes,
    targetGames,
    entries,
    totalMinutes: entries.reduce((sum, entry) => sum + entry.minutes, 0),
    avoided: fitting
      .filter((entry) => !used.has(entry.gameId) && playedSet.has(entry.gameId))
      .map((entry) => entry.gameId),
  };
}

/** The stored form of a drawn playlist. */
export function toSessionPlan(playlist: Playlist, now = Date.now()): RoomSessionPlan {
  return {
    mode: playlist.mode,
    budgetMinutes: playlist.budgetMinutes,
    entries: playlist.entries.map((entry) => ({ ...entry })),
    played: [],
    startedAt: now,
  };
}

export interface SessionProgress {
  mode: PlayModeId;
  label: string;
  budgetMinutes: number | null;
  /** 1-based position of the game in play; 0 once the session is over. */
  index: number;
  /** Games in the whole session (played + queued). */
  total: number;
  /** Games that have not started yet, current one excluded. */
  upcoming: RoomSessionEntry[];
  /** Minutes still queued behind the current game. */
  remainingMinutes: number;
  finished: boolean;
}

/** Read-only summary of where a session stands, for headers and progress bars. */
export function sessionProgress(plan: RoomSessionPlan | null | undefined): SessionProgress | null {
  if (!plan) return null;
  const preset = playModeById(plan.mode);
  const upcoming = plan.entries.slice(1);
  return {
    mode: plan.mode,
    label: preset?.label ?? plan.mode,
    budgetMinutes: plan.budgetMinutes,
    index: plan.entries.length ? plan.played.length + 1 : 0,
    total: plan.played.length + plan.entries.length,
    upcoming,
    remainingMinutes: upcoming.reduce((sum, entry) => sum + entry.minutes, 0),
    finished: plan.entries.length === 0,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
