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
   * Short rules shown in the pre-game rules tour (`engine/rulesTour.ts`).
   * Games registered without `withRulesPhase` simply never render it.
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
