import type { GameDefinition, GameEngine, Room, Achievement } from "@/types";
import { generatePlayerId } from "@/lib/utils";

export const BombCountdownGame: GameDefinition = {
  id: "bombcountdown",
  name: "炸彈倒數",
  nameEn: "Bomb Countdown",
  description: "超快節奏派對，炸彈誰來接？",
  longDescription: "炸彈在玩家間快速傳遞！輪到你時要完成小挑戰（回答問題、速算、反應點擊）才能把炸彈傳給下一位。炸彈隨機爆炸，輸家出局，最後的倖存者勝出！",
  minPlayers: 3,
  maxPlayers: 15,
  estimatedDuration: "3-8 分鐘",
  category: "PARTY",
  icon: "💣",
  color: "#ef4444",
  gradient: "linear-gradient(135deg, #ef4444, #f97316, #ffe600)",
  tags: ["節奏", "反應", "派對"],
  difficulty: "簡單",
};

// Challenge types for the bomb game
export type ChallengeType = "reaction" | "quiz" | "math" | "speed";

export interface BombChallenge {
  type: ChallengeType;
  question?: string;
  options?: string[];
  correctAnswer?: string;
  timeLimit: number;
  targetPlayerId?: string;
}

export interface BombGameState {
  currentRound: number;
  totalRounds: number;
  bombHolderId: string;
  bombTimeLeft: number;
  isPassing: boolean;
  challenge: BombChallenge | null;
  eliminatedPlayers: string[];
  currentScores: Record<string, number>;
  phase: "waiting" | "challenge" | "passing" | "exploded" | "result";
}

export interface BombGameResult {
  scores: Record<string, number>;
  winnerId: string;
  achievements: Achievement[];
}

export const BombEngine: GameEngine = {
  createGame(room: Room): Record<string, unknown> {
    const playerIds = Object.keys(room.players);
    const activePlayers = playerIds.filter((id) => room.players[id]?.isConnected);

    return {
      currentRound: 1,
      totalRounds: room.settings?.rounds || 3,
      bombHolderId: activePlayers[Math.floor(Math.random() * activePlayers.length)],
      bombTimeLeft: room.settings?.timer || 10,
      isPassing: false,
      challenge: null,
      eliminatedPlayers: [],
      currentScores: Object.fromEntries(activePlayers.map((id) => [id, 0])),
      phase: "waiting" as const,
    };
  },

  startGame(room: Room): Record<string, unknown> {
    return this.createGame(room);
  },

  handlePlayerAction(room: Room, playerId: string, action: unknown): Record<string, unknown> {
    const state = room.gameState as BombGameState;
    if (!state || state.phase !== "challenge") return state;

    const { challenge } = state;
    if (!challenge || challenge.type !== "quiz") return state;

    if (playerId !== state.bombHolderId) return state;

    const answer = (action as { answer: string }).answer;
    const isCorrect = answer === challenge.correctAnswer;

    const newScores = { ...state.currentScores };
    if (isCorrect) {
      newScores[playerId] = (newScores[playerId] || 0) + 10;
    }

    // Pass bomb to next player
    const activePlayers = Object.keys(room.players).filter((id) => !state.eliminatedPlayers.includes(id));
    const currentIndex = activePlayers.indexOf(state.bombHolderId);
    const nextIndex = (currentIndex + 1) % activePlayers.length;
    const nextPlayerId = activePlayers[nextIndex];

    const newChallenge = generateChallenge(nextPlayerId, room.settings?.difficulty || "easy");

    return {
      ...state,
      bombHolderId: nextPlayerId,
      bombTimeLeft: room.settings?.timer || 10,
      challenge: newChallenge,
      currentScores: newScores,
    };
  },

  updateGameState(room: Room): Record<string, unknown> {
    const state = room.gameState as BombGameState;
    if (!state || state.phase !== "passing") return state;

    const timeLeft = (state.bombTimeLeft || 0) - 1;

    if (timeLeft <= 0) {
      // Bomb explodes!
      const eliminated = [...state.eliminatedPlayers, state.bombHolderId];
      const activePlayers = Object.keys(room.players).filter((id) => !eliminated.includes(id));

      if (activePlayers.length <= 1) {
        // Game over
        return {
          ...state,
          phase: "result" as const,
          eliminatedPlayers: eliminated,
          bombTimeLeft: 0,
        };
      }

      const nextPlayerId = activePlayers[Math.floor(Math.random() * activePlayers.length)];
      const newChallenge = generateChallenge(nextPlayerId, room.settings?.difficulty || "easy");

      return {
        ...state,
        bombHolderId: nextPlayerId,
        bombTimeLeft: room.settings?.timer || 10,
        challenge: newChallenge,
        eliminatedPlayers: eliminated,
        phase: "challenge" as const,
      };
    }

    return { ...state, bombTimeLeft: timeLeft };
  },

  endRound(room: Room): Record<string, unknown> {
    return this.createGame(room);
  },

  endGame(room: Room): { scores: Record<string, number>; achievements: Achievement[] } {
    const state = room.gameState as BombGameState;
    const scores = state?.currentScores || {};
    const winnerId = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

    const achievements: Achievement[] = [];
    Object.entries(scores).forEach(([id, score]) => {
      if (id === winnerId) {
        achievements.push({ id: "winner", name: "Survivor", icon: "🏆", description: "Last one standing!", playerId: id });
      }
      if (score >= 30) {
        achievements.push({ id: "sharp", name: "Quick Thinker", icon: "⚡", description: "Scored 30+ points", playerId: id });
      }
    });

    return { scores, achievements };
  },

  calculateScores(room: Room): Record<string, number> {
    const state = room.gameState as BombGameState;
    return state?.currentScores || {};
  },
};

function generateChallenge(targetId: string, difficulty: string): BombChallenge {
  const level = difficulty === "hard" ? 3 : difficulty === "medium" ? 2 : 1;

  const challenges: Record<ChallengeType, Array<Omit<BombChallenge, "type" | "timeLimit">>> = {
    reaction: [
      { question: "Tap RED!", options: ["🔴", "🔵", "🟢"], correctAnswer: "🔴" },
      { question: "Tap BLUE!", options: ["🔴", "🔵", "🟢"], correctAnswer: "🔵" },
      { question: "Tap GREEN!", options: ["🔴", "🔵", "🟢"], correctAnswer: "🟢" },
    ],
    quiz: [
      { question: "What is 2+2?", options: ["3", "4", "5"], correctAnswer: "4" },
      { question: "Capital of Japan?", options: ["Tokyo", "Osaka", "Kyoto"], correctAnswer: "Tokyo" },
      { question: "How many continents?", options: ["5", "6", "7"], correctAnswer: "7" },
      { question: "H2O is?", options: ["Water", "Salt", "Sugar"], correctAnswer: "Water" },
      { question: "Biggest ocean?", options: ["Atlantic", "Pacific", "Indian"], correctAnswer: "Pacific" },
    ],
    math: [
      { question: "5 × 3 = ?", options: ["10", "15", "20"], correctAnswer: "15" },
      { question: "12 + 8 = ?", options: ["18", "20", "22"], correctAnswer: "20" },
      { question: "100 ÷ 4 = ?", options: ["20", "25", "30"], correctAnswer: "25" },
      { question: "7 × 8 = ?", options: ["54", "56", "58"], correctAnswer: "56" },
      { question: "15 + 27 = ?", options: ["42", "40", "44"], correctAnswer: "42" },
    ],
    speed: [
      { question: "Tap as fast as you can!", options: ["GO!"], correctAnswer: "GO!" },
    ],
  };

  const types: ChallengeType[] = ["reaction", "quiz", "math", "speed"];
  const type = types[Math.floor(Math.random() * Math.min(level + 1, types.length))];
  const pool = challenges[type];
  const challenge = pool[Math.floor(Math.random() * pool.length)];

  return {
    type,
    ...challenge,
    timeLimit: Math.max(3, 10 - level * 2),
    targetPlayerId: targetId,
  };
}
