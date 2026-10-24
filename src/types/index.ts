export const CATEGORIES = {
  PARTY: "PARTY",
  SOCIAL: "SOCIAL",
  CREATIVE: "CREATIVE",
  MYSTERY: "MYSTERY",
  MUSIC: "MUSIC",
} as const;

export type Category = (typeof CATEGORIES)[keyof typeof CATEGORIES];

export type GameStatus = "LOBBY" | "PLAYING" | "RESULTS";

export interface Player {
  id: string;
  nickname: string;
  avatar: string;
  isHost: boolean;
  /** Display-only hosts never receive turns or count toward player limits. */
  role?: "player" | "display";
  isConnected: boolean;
  score: number;
  /** Whether player has marked themselves ready in the lobby */
  isReady?: boolean;
  /** Server timestamp of the last time this client dropped its connection. */
  leftAt?: number;
}

export interface RoomSettings {
  timer: number;
  difficulty: "easy" | "medium" | "hard";
  rounds: number;
  soundEnabled: boolean;
  ageMode: "family" | "adults";
}

/** The three time-boxed random-party modes: 3 / 5 / 10 minutes of games. */
export type PlayModeId = "flash" | "standard" | "marathon";

/** One game of a randomized party-session playlist. */
export interface RoomSessionEntry {
  gameId: string;
  /** Minutes the playlist budgeted for this game. */
  minutes: number;
  /**
   * Settings suggested so the game fits its slot. A suggestion only — the host
   * can still change everything in the lobby before starting.
   */
  settings: RoomSettings;
  /** True when the draw had to repeat a game because every candidate was used. */
  repeated?: boolean;
}

/**
 * A randomized, time-boxed playlist attached to a room.
 *
 * `entries[0]` is the game currently in play (or waiting in the lobby), the rest
 * queue behind it. Advancing moves `entries[0]` into `played` and promotes the
 * next entry, so `played.length + entries.length` is the size of the session.
 */
export interface RoomSessionPlan {
  mode: PlayModeId;
  budgetMinutes: number;
  entries: RoomSessionEntry[];
  /** Games finished (or skipped) earlier in this session, in play order. */
  played: string[];
  startedAt: number;
  /** Set once the last entry has been played: the session is over. */
  completedAt?: number;
}

/**
 * How a room is presented.
 *
 * - `tv` (default): the host device is a display-only big screen. It never
 *   counts as a participant, and every player joins from their own phone.
 * - `phone`: the host phone *is* the stage. No TV, projector or computer is
 *   needed. The host may additionally play (`role: "player"`) on that same
 *   phone, switching between the stage and their own controller.
 *
 * Rooms created before this feature have no `hostMode` and must keep behaving
 * like `tv`; never branch on `"phone"` without a fallback.
 */
export type HostMode = "tv" | "phone";

/** How the host device should be set up when the room is created. */
export interface HostModeOptions {
  hostMode: HostMode;
  /** Phone mode only: the host also plays. Ignored for `tv` rooms. */
  hostPlays?: boolean;
}

export interface ReactionItem {
  id: string;
  emoji: string;
  nickname: string;
  at: number;
}

/**
 * A live room as stored in the Realtime Database.
 *
 * `S` is the shape of `gameState` for the game currently running in the room.
 * Code that does not care about a specific game can use the default
 * (`Record<string, unknown>`); engines parameterise it with their own state type.
 */
export interface Room<S = Record<string, unknown>> {
  id: string;
  gameId: string;
  hostPlayerId: string;
  status: GameStatus;
  createdAt: number;
  /** Rooms are eligible for sweeping once this timestamp passes. */
  expiresAt?: number;
  settings: RoomSettings;
  players: Record<string, Player>;
  gameState: S;
  /** Ephemeral reactions broadcast from player controllers */
  reactions?: Record<string, ReactionItem>;
  /** Server timestamp written by the authoritative tick, used to detect a stalled host. */
  lastTickAt?: number;
  startedAt?: number;
  finishedAt?: number;
  /** Frozen when a match starts. Late joiners spectate until the next match. */
  participantIds?: string[];
  /** Small content history retained across rematches; never stores drawings. */
  contentHistory?: Record<string, string[]>;
  /**
   * RESULTS-screen poll: playerId → gameId they want next.
   * Cleared when the host starts a rematch or switches games.
   */
  nextGameVotes?: Record<string, string>;
  /**
   * Active randomized party session ("3分鐘快閃" / "5分鐘正常" / "10分鐘最久").
   * Absent for rooms that were created by picking a single game.
   */
  sessionPlan?: RoomSessionPlan;
  /**
   * How this room is presented. Absent means `"tv"` (legacy rooms and the
   * default big-screen flow). See `HostMode`.
   */
  hostMode?: HostMode;
  /**
   * Host-only secret mirror of gameState fields (roles, words, passcodes).
   * Engines hydrate from this; phones never receive it unless they are host.
   */
  privateHost?: Record<string, unknown>;
  /** Per-player secrets. Rules should allow each uid to read only private/{uid}. */
  private?: Record<string, Record<string, unknown>>;
}

export interface GameDefinition {
  id: string;
  name: string;
  /** English title, used for search and for `lang="en"` labelling in the UI. */
  nameEn: string;
  description: string;
  longDescription: string;
  minPlayers: number;
  maxPlayers: number;
  estimatedDuration: string;
  category: Category;
  icon: string;
  color: string;
  gradient: string;
  tags: string[];
  difficulty: string;
  /**
   * Optional extended rules for game detail pages.
   * The shared briefing uses constants/gameGuides.ts.
   */
  rules?: string[];
}

export interface Achievement {
  id: string;
  name: string;
  icon: string;
  description: string;
  playerId: string;
}

export interface GameSummary {
  scores: Record<string, number>;
  achievements: Achievement[];
  winnerId: string;
  winnerIds?: string[];
}

/**
 * The contract every game implements.
 *
 * Engines are pure: they take the room they were given and return the next
 * `gameState`. They never touch the database — the host loop in
 * `providers/RoomContext.tsx` is the only thing that persists state, inside a
 * transaction, so concurrent player actions cannot clobber a tick.
 */
export interface GameEngine<S = Record<string, unknown>> {
  /** Build the initial state for a room that is about to start. */
  createGame(room: Room<S>): S;
  /** Alias for `createGame`; kept separate so a game can vary a restart. */
  startGame(room: Room<S>): S;
  /** Apply one player action and return the next state. */
  handlePlayerAction(room: Room<S>, playerId: string, action: unknown): S;
  /** Advance the clock by one tick and return the next state. */
  updateGameState(room: Room<S>): S;
  /** Reset state for another round of the same game. */
  endRound(room: Room<S>): S;
  /** Produce final scores and achievements. */
  endGame(room: Room<S>): GameSummary;
  /** Read the current scoreboard out of a state. */
  calculateScores(room: Room<S>): Record<string, number>;
}
