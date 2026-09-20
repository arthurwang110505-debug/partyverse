import type { Achievement, GameEngine, GameSummary, Room } from "@/types";
import { connectedParticipantIds } from "./participants";
import { topScorers } from "./scoring";

export const BOMB_GAME_ID = "bombcountdown";
export type ChallengeType = "reaction" | "quiz" | "math" | "speed";
export interface BombChallenge {
  id: string;
  type: ChallengeType;
  question: string;
  options: string[];
  correctAnswer: string;
  timeLimit: number;
  targetPlayerId: string;
}
export interface BombGameState {
  phase: "briefing" | "challenge" | "exploded" | "round_reveal" | "result";
  currentRound: number;
  totalRounds: number;
  bombHolderId: string;
  /** Time for the current phase; during a challenge this is the shared fuse. */
  bombTimeLeft: number;
  fuseDuration: number;
  passes: number;
  challenge: BombChallenge | null;
  eliminatedPlayers: string[];
  currentScores: Record<string, number>;
  correctAnswers: Record<string, number>;
  roundWins: Record<string, number>;
  lastEliminatedId: string | null;
  roundWinnerId: string | null;
  winnerId: string | null;
  winnerIds: string[];
  lastAnswer: { playerId: string; correct: boolean; challengeId: string; at: number } | null;
}
type Rng = () => number;
const CHALLENGES: Record<ChallengeType, Array<Omit<BombChallenge, "id" | "type" | "timeLimit" | "targetPlayerId">>> = {
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

const TYPES_BY_DIFFICULTY: Record<string, ChallengeType[]> = {
  easy: ["reaction", "quiz"],
  medium: ["reaction", "quiz", "math"],
  hard: ["reaction", "math", "math"],
};
function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
export function generateChallenge(
  targetId: string,
  difficulty: string,
  rng: Rng = Math.random,
  previousQuestion?: string,
): BombChallenge {
  const pool = TYPES_BY_DIFFICULTY[difficulty] ?? TYPES_BY_DIFFICULTY.easy;
  const type = pool[Math.floor(rng() * pool.length)];
  const variants = CHALLENGES[type].filter((item) => item.question !== previousQuestion);
  let variant = variants[Math.floor(rng() * variants.length)] ?? CHALLENGES[type][0];
  if (type === "math") {
    const a = 2 + Math.floor(rng() * (difficulty === "hard" ? 11 : 7));
    const b = 2 + Math.floor(rng() * 9);
    const multiply = difficulty === "hard";
    const answer = multiply ? a * b : a + b;
    variant = {
      question: `${a} ${multiply ? "×" : "+"} ${b} = ?`,
      options: [String(answer - 2), String(answer), String(answer + 3)],
      correctAnswer: String(answer),
    };
  }
  return {
    ...variant,
    id: `${targetId}-${rng().toString(36).slice(2, 12)}`,
    type,
    options: shuffle(variant.options, rng),
    timeLimit: 10,
    targetPlayerId: targetId,
  };
}
export function survivorIds(room: Room<BombGameState>, eliminated: string[] = []): string[] {
  return connectedParticipantIds(room)
    .filter((id) => !eliminated.includes(id))
    .sort();
}
function fuseDuration(room: Room<BombGameState>, eliminated = 0): number {
  const factor = { easy: 1, medium: 0.85, hard: 0.7 }[room.settings.difficulty] ?? 1;
  return Math.max(6, Math.round((room.settings.timer ?? 20) * factor) - eliminated * 2);
}
function challengeDifficulty(room: Room<BombGameState>, state: BombGameState): string {
  const levels = ["easy", "medium", "hard"];
  return levels[Math.min(2, Math.max(0, levels.indexOf(room.settings.difficulty)) + Math.floor(state.passes / 4))];
}
function revealRound(room: Room<BombGameState>, state: BombGameState): BombGameState {
  const winner = survivorIds(room, state.eliminatedPlayers)[0] ?? null;
  return {
    ...state,
    phase: "round_reveal",
    bombTimeLeft: 5,
    challenge: null,
    roundWinnerId: winner,
    currentScores: winner
      ? { ...state.currentScores, [winner]: (state.currentScores[winner] ?? 0) + 50 }
      : state.currentScores,
    roundWins: winner ? { ...state.roundWins, [winner]: (state.roundWins[winner] ?? 0) + 1 } : state.roundWins,
  };
}
function lightFuse(room: Room<BombGameState>, state: BombGameState): BombGameState {
  const ids = survivorIds(room, state.eliminatedPlayers);
  if (ids.length <= 1) return revealRound(room, state);
  const holder = ids[Math.floor(Math.random() * ids.length)];
  const duration = fuseDuration(room, state.eliminatedPlayers.length);
  return {
    ...state,
    phase: "challenge",
    bombHolderId: holder,
    bombTimeLeft: duration,
    fuseDuration: duration,
    challenge: generateChallenge(holder, challengeDifficulty(room, state)),
    lastAnswer: null,
  };
}
function explode(state: BombGameState): BombGameState {
  return {
    ...state,
    phase: "exploded",
    bombTimeLeft: 3,
    challenge: null,
    lastEliminatedId: state.bombHolderId,
    eliminatedPlayers: [...new Set([...state.eliminatedPlayers, state.bombHolderId])],
  };
}
export interface BombAction {
  type: "answer";
  answer: string;
  challengeId: string;
}

export const BombEngine: GameEngine<BombGameState> = {
  createGame(room) {
    const ids = survivorIds(room);
    return {
      phase: ids.length ? "briefing" : "result",
      currentRound: 1,
      totalRounds: Math.min(5, Math.max(1, room.settings.rounds ?? 3)),
      bombHolderId: "",
      bombTimeLeft: 3,
      fuseDuration: fuseDuration(room),
      passes: 0,
      challenge: null,
      eliminatedPlayers: [],
      currentScores: Object.fromEntries(ids.map((id) => [id, 0])),
      correctAnswers: {},
      roundWins: {},
      lastEliminatedId: null,
      roundWinnerId: null,
      winnerId: null,
      winnerIds: [],
      lastAnswer: null,
    };
  },
  startGame(room) {
    return this.createGame(room);
  },
  handlePlayerAction(room, playerId, action) {
    const state = room.gameState;
    const act = action as Partial<BombAction> | null;
    if (!state || state.phase !== "challenge" || !state.challenge || !room.players[playerId]?.isConnected) return state;
    if (
      playerId !== state.bombHolderId ||
      act?.type !== "answer" ||
      typeof act.answer !== "string" ||
      act.challengeId !== state.challenge.id
    )
      return state;
    if (!state.challenge.options.includes(act.answer)) return state;
    const now = Date.now();
    if (state.lastAnswer?.playerId === playerId && !state.lastAnswer.correct && now - state.lastAnswer.at < 500)
      return state;
    const correct = act.answer === state.challenge.correctAnswer;
    const lastAnswer = { playerId, correct, challengeId: state.challenge.id, at: now };
    if (!correct) return { ...state, bombTimeLeft: Math.max(1, state.bombTimeLeft - 1), lastAnswer };
    const others = survivorIds(room, state.eliminatedPlayers).filter((id) => id !== playerId);
    if (!others.length) return revealRound(room, state);
    const nextHolder = others[Math.floor(Math.random() * others.length)];
    const next = {
      ...state,
      bombHolderId: nextHolder,
      passes: state.passes + 1,
      lastAnswer,
      currentScores: { ...state.currentScores, [playerId]: (state.currentScores[playerId] ?? 0) + 10 },
      correctAnswers: { ...state.correctAnswers, [playerId]: (state.correctAnswers[playerId] ?? 0) + 1 },
    };
    // Passing never resets the fuse. A new challenge id rejects late/repeated taps.
    return {
      ...next,
      challenge: generateChallenge(nextHolder, challengeDifficulty(room, next), Math.random, state.challenge.question),
    };
  },
  updateGameState(room) {
    const state = room.gameState;
    if (!state || state.phase === "result") return state;
    const time = Math.max(0, state.bombTimeLeft - 1);
    if (state.phase === "challenge") {
      if (!survivorIds(room, state.eliminatedPlayers).includes(state.bombHolderId) || time === 0) return explode(state);
      return { ...state, bombTimeLeft: time };
    }
    if (time > 0) return { ...state, bombTimeLeft: time };
    if (state.phase === "briefing" || state.phase === "exploded") return lightFuse(room, state);
    if (state.currentRound >= state.totalRounds) {
      const winners = topScorers(state.currentScores);
      return { ...state, phase: "result", bombTimeLeft: 0, winnerId: winners[0] ?? null, winnerIds: winners };
    }
    return {
      ...state,
      phase: "briefing",
      currentRound: state.currentRound + 1,
      bombTimeLeft: 3,
      eliminatedPlayers: [],
      roundWinnerId: null,
      lastEliminatedId: null,
      lastAnswer: null,
      passes: 0,
      fuseDuration: fuseDuration(room),
      bombHolderId: "",
      challenge: null,
    };
  },
  endRound(room) {
    return this.createGame(room);
  },
  endGame(room): GameSummary {
    const state = room.gameState;
    const scores = state?.currentScores ?? {};
    const winnerIds = topScorers(scores);
    const achievements: Achievement[] = winnerIds.map((playerId) => ({
      id: `survivor_${playerId}`,
      name: "拆彈冠軍",
      icon: "🏆",
      description: "傳遞炸彈與存活積分最高",
      playerId,
    }));
    for (const [id, count] of Object.entries(state?.correctAnswers ?? {})) {
      if (count >= 3)
        achievements.push({
          id: `sharp_${id}`,
          name: "反應迅速",
          icon: "⚡",
          description: `成功傳出 ${count} 次炸彈`,
          playerId: id,
        });
    }
    return { scores, achievements, winnerId: winnerIds[0] ?? "", winnerIds };
  },
  calculateScores(room) {
    return room.gameState?.currentScores ?? {};
  },
};
