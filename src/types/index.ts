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
  isConnected: boolean;
  score: number;
}

export interface RoomSettings {
  timer: number;
  difficulty: "easy" | "medium" | "hard";
  rounds: number;
  soundEnabled: boolean;
  ageMode: "family" | "adults";
}

export interface Room {
  id: string;
  gameId: string;
  hostPlayerId: string;
  status: GameStatus;
  createdAt: number;
  settings: RoomSettings;
  players: Record<string, Player>;
  gameState: Record<string, unknown>;
}

export interface GameDefinition {
  id: string;
  name: string;
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
}

export interface GameEngine {
  createGame(room: Room): Record<string, unknown>;
  startGame(room: Room): Record<string, unknown>;
  handlePlayerAction(room: Room, playerId: string, action: unknown): Record<string, unknown>;
  updateGameState(room: Room): Record<string, unknown>;
  endRound(room: Room): Record<string, unknown>;
  endGame(room: Room): { scores: Record<string, number>; achievements: Achievement[] };
  calculateScores(room: Room): Record<string, number>;
}

export interface Achievement {
  id: string;
  name: string;
  icon: string;
  description: string;
  playerId: string;
}
