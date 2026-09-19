import type { Achievement, GameEngine, GameSummary, Room } from "@/types";

export const BOMB_GAME_ID = "bombcountdown";

export type ChallengeType = "reaction" | "quiz" | "math" | "speed";

export interface BombChallenge {
  type: ChallengeType;
  question: string;
  options: string[];
  correctAnswer: string;
  timeLimit: number;
  targetPlayerId: string;
}

export interface BombGameState {
  currentRound: number;
  totalRounds: number;
  bombHolderId: string;
  bombTimeLeft: number;
  challenge: BombChallenge | null;
  eliminatedPlayers: string[];
  currentScores: Record<string, number>;
  correctAnswers: Record<string, number>;
  lastEliminatedId: string | null;
  winnerId: string | null;
  phase: "challenge" | "exploded" | "result";
}

type Rng = () => number;

const CHALLENGES: Record<ChallengeType, Array<Omit<BombChallenge, "type" | "timeLimit" | "targetPlayerId">>> = {
  reaction: [
    { question: "點擊紅色！", options: ["🔴", "🔵", "🟢"], correctAnswer: "🔴" },
    { question: "點擊藍色！", options: ["🔴", "🔵", "🟢"], correctAnswer: "🔵" },
    { question: "點擊綠色！", options: ["🔴", "🔵", "🟢"], correctAnswer: "🟢" },
  ],
  quiz: [
    { question: "2 + 2 = ?", options: ["3", "4", "5"], correctAnswer: "4" },
    { question: "日本的首都？", options: ["東京", "大阪", "京都"], correctAnswer: "東京" },
    { question: "世界上有幾大洲？", options: ["5", "6", "7"], correctAnswer: "7" },
    { question: "H2O 是？", options: ["水", "鹽", "糖"], correctAnswer: "水" },
    { question: "最大的海洋？", options: ["大西洋", "太平洋", "印度洋"], correctAnswer: "太平洋" },
    { question: "台灣的最高山？", options: ["玉山", "雪山", "阿里山"], correctAnswer: "玉山" },
  ],
  math: [
    { question: "5 × 3 = ?", options: ["10", "15", "20"], correctAnswer: "15" },
    { question: "12 + 8 = ?", options: ["18", "20", "22"], correctAnswer: "20" },
    { question: "100 ÷ 4 = ?", options: ["20", "25", "30"], correctAnswer: "25" },
    { question: "7 × 8 = ?", options: ["54", "56", "58"], correctAnswer: "56" },
    { question: "15 + 27 = ?", options: ["42", "40", "44"], correctAnswer: "42" },
  ],
  speed: [{ question: "越快越好，點擊 GO！", options: ["GO!"], correctAnswer: "GO!" }],
};

/** Difficulty widens the challenge pool and shortens the clock. */
const TYPES_BY_DIFFICULTY: Record<string, ChallengeType[]> = {
  easy: ["reaction", "quiz"],
  medium: ["reaction", "quiz", "math"],
  hard: ["reaction", "quiz", "math", "speed"],
};

const CLOCK_BY_DIFFICULTY: Record<string, number> = { easy: 10, medium: 8, hard: 5 };

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Exported so tests can drive it with a seeded rng. */
export function generateChallenge(targetId: string, difficulty: string, rng: Rng = Math.random): BombChallenge {
  const pool = TYPES_BY_DIFFICULTY[difficulty] ?? TYPES_BY_DIFFICULTY.easy;
  const type = pool[Math.floor(rng() * pool.length)];
  const variants = CHALLENGES[type];
  const variant = variants[Math.floor(rng() * variants.length)];
  return {
    type,
    question: variant.question,
    // Shuffled so the correct option is not always in the same slot.
    options: shuffle(variant.options, rng),
    correctAnswer: variant.correctAnswer,
    timeLimit: CLOCK_BY_DIFFICULTY[difficulty] ?? 10,
    targetPlayerId: targetId,
  };
}

/** Players who are still in the game, in a stable order. */
export function survivorIds(room: Room<BombGameState>, extraEliminated: string[] = []): string[] {
  const out = new Set(extraEliminated);
  return Object.keys(room.players)
    .filter((id) => !out.has(id))
    .sort();
}

function zeroedScores(ids: string[]): Record<string, number> {
  return Object.fromEntries(ids.map((id) => [id, 0]));
}

function initialState(room: Room<BombGameState>, rng: Rng): BombGameState {
  const connected = Object.keys(room.players)
    .filter((id) => room.players[id]?.isConnected !== false)
    .sort();
  const ids = connected.length > 0 ? connected : Object.keys(room.players).sort();
  const holder = ids[Math.floor(rng() * ids.length)] ?? "";
  const difficulty = room.settings?.difficulty ?? "easy";

  return {
    currentRound: 1,
    totalRounds: room.settings?.rounds ?? 3,
    bombHolderId: holder,
    bombTimeLeft: room.settings?.timer ?? 10,
    challenge: holder ? generateChallenge(holder, difficulty, rng) : null,
    eliminatedPlayers: [],
    currentScores: zeroedScores(ids),
    correctAnswers: zeroedScores(ids),
    lastEliminatedId: null,
    winnerId: null,
    phase: holder ? "challenge" : "result",
  };
}

export interface BombAction {
  type: "answer";
  answer: string;
}

function isBombAction(action: unknown): action is BombAction {
  return typeof action === "object" && action !== null && (action as { type?: unknown }).type === "answer";
}

export const BombEngine: GameEngine<BombGameState> = {
  createGame(room) {
    return initialState(room, Math.random);
  },

  startGame(room) {
    return this.createGame(room);
  },

  handlePlayerAction(room, playerId, action) {
    const state = room.gameState;
    if (!state || state.phase !== "challenge") return state;
    if (!isBombAction(action)) return state;
    // Only the person holding the bomb may defuse it.
    if (playerId !== state.bombHolderId || !state.challenge) return state;

    if (action.answer !== state.challenge.correctAnswer) {
      // Wrong answer does not pass the bomb; the ticking clock is the penalty.
      return state;
    }

    const difficulty = room.settings?.difficulty ?? "easy";
    const alive = survivorIds(room, state.eliminatedPlayers);
    const others = alive.filter((id) => id !== playerId);
    const nextHolder = others.length > 0 ? others[Math.floor(Math.random() * others.length)] : playerId;

    return {
      ...state,
      bombHolderId: nextHolder,
      bombTimeLeft: room.settings?.timer ?? state.challenge.timeLimit,
      challenge: generateChallenge(nextHolder, difficulty),
      currentScores: { ...state.currentScores, [playerId]: (state.currentScores[playerId] ?? 0) + 10 },
      correctAnswers: { ...state.correctAnswers, [playerId]: (state.correctAnswers[playerId] ?? 0) + 1 },
    };
  },

  updateGameState(room) {
    const state = room.gameState;
    if (!state || state.phase !== "challenge") return state;

    const timeLeft = (state.bombTimeLeft ?? 0) - 1;
    if (timeLeft > 0) return { ...state, bombTimeLeft: timeLeft };

    // The bomb went off in someone's hands.
    const holder = state.bombHolderId;
    const eliminated = holder ? [...state.eliminatedPlayers, holder] : state.eliminatedPlayers;
    const alive = survivorIds(room, eliminated);

    if (alive.length <= 1) {
      const winnerId = alive[0] ?? holder;
      const scores = { ...state.currentScores };
      if (winnerId) scores[winnerId] = (scores[winnerId] ?? 0) + 50;
      return {
        ...state,
        phase: "result",
        bombTimeLeft: 0,
        eliminatedPlayers: eliminated,
        lastEliminatedId: holder,
        winnerId,
        currentScores: scores,
        challenge: null,
      };
    }

    const difficulty = room.settings?.difficulty ?? "easy";
    const nextHolder = alive[Math.floor(Math.random() * alive.length)];
    return {
      ...state,
      phase: "challenge",
      bombHolderId: nextHolder,
      bombTimeLeft: room.settings?.timer ?? 10,
      challenge: generateChallenge(nextHolder, difficulty),
      eliminatedPlayers: eliminated,
      lastEliminatedId: holder,
    };
  },

  endRound(room) {
    return initialState(room, Math.random);
  },

  endGame(room): GameSummary {
    const state = room.gameState;
    const scores = state?.currentScores ?? {};
    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const winnerId = state?.winnerId ?? entries[0]?.[0] ?? "";

    const achievements: Achievement[] = [];
    if (winnerId) {
      achievements.push({
        id: "survivor",
        name: "最後倖存者",
        icon: "🏆",
        description: "撐到最後一刻",
        playerId: winnerId,
      });
    }
    for (const [id, score] of entries) {
      if (score >= 30) {
        achievements.push({
          id: "sharp",
          name: "反應迅速",
          icon: "⚡",
          description: "得分 30 以上",
          playerId: id,
        });
      }
    }

    return { scores, achievements, winnerId };
  },

  calculateScores(room) {
    return room.gameState?.currentScores ?? {};
  },
};
