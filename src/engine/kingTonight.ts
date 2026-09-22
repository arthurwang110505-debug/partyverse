import type { Achievement, GameEngine, GameSummary, Room } from "@/types";

export const KING_GAME_ID = "kingtonight";

export type KingMiniType = "tap_mash" | "reaction_tap" | "emoji_math";

export interface KingChallenge {
  type: KingMiniType;
  title: string;
  instruction: string;
  targetCount?: number;
  triggerDelayMs?: number;
  question?: string;
  options?: string[];
  correctAnswer?: string;
}

export const MINI_CHALLENGES: KingChallenge[] = [
  {
    type: "tap_mash",
    title: "瘋狂狂點！",
    instruction: "在 5 秒內狂按螢幕，點擊最多次數的玩家登基為王！",
    targetCount: 30,
  },
  {
    type: "reaction_tap",
    title: "拔刀反應！",
    instruction: "專注凝視！等畫面信號亮綠並出現「斬」時立刻拔刀搶先點擊！",
    triggerDelayMs: 2200,
  },
  {
    type: "emoji_math",
    title: "Emoji 搶答！",
    instruction: "🍎 + 🍌 = 5，🍎 = 2，那 🍌 是多少？快速搶答！",
    question: "🍎 + 🍌 = 5，🍎 = 2，🍌 = ？",
    options: ["2", "3", "4"],
    correctAnswer: "3",
  },
  {
    type: "tap_mash",
    title: "光速指壓！",
    instruction: "第二輪點擊大亂鬥！連打頻率最高者奪得王座！",
    targetCount: 35,
  },
  {
    type: "emoji_math",
    title: "算術急轉彎！",
    instruction: "🍕 + 🍕 = 8，🍕 × 🍔 = 20，🍔 是多少？",
    question: "🍕 + 🍕 = 8，🍕 × 🍔 = 20，🍔 = ？",
    options: ["4", "5", "6"],
    correctAnswer: "5",
  },
];

export type KingPhase = "briefing" | "action" | "reveal" | "result";

export interface KingGameState {
  phase: KingPhase;
  currentRound: number;
  totalRounds: number;
  timeLeft: number;
  currentKingId: string | null;
  challenge: KingChallenge;
  /** playerId -> taps or timestamp or answer */
  playerInputs: Record<string, number | string>;
  roundWinnerId: string | null;
  currentScores: Record<string, number>;
  winnerId: string | null;
}

export interface TapAction {
  type: "tap";
}

/**
 * Batched taps: the phone counts locally and flushes every few hundred ms,
 * so a mashing player costs ~2-3 room transactions/sec instead of one per tap.
 */
export interface TapsAction {
  type: "taps";
  count: number;
}

export interface ReactAction {
  type: "react";
  reactionTimeMs: number;
}

export interface ChoiceAction {
  type: "choice";
  answer: string;
}

export type KingAction = TapAction | TapsAction | ReactAction | ChoiceAction;

/** Per-action tap cap: a human phone cannot honestly flush more than this. */
export const MAX_TAP_BATCH = 40;

function initialScores(players: Room["players"]): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const id of Object.keys(players)) {
    scores[id] = 0;
  }
  return scores;
}

function getChallenge(round: number): KingChallenge {
  return MINI_CHALLENGES[(round - 1) % MINI_CHALLENGES.length];
}

export const KingTonightEngine: GameEngine<KingGameState> = {
  createGame(room) {
    const pIds = Object.keys(room.players);
    const initialKing = pIds[0] ?? null;

    return {
      phase: "briefing",
      currentRound: 1,
      totalRounds: Math.min(room.settings?.rounds ?? 3, MINI_CHALLENGES.length),
      timeLeft: 4, // 4s briefing
      currentKingId: initialKing,
      challenge: getChallenge(1),
      playerInputs: {},
      roundWinnerId: null,
      currentScores: initialScores(room.players),
      winnerId: null,
    };
  },

  startGame(room) {
    return this.createGame(room);
  },

  handlePlayerAction(room, playerId, action) {
    const state = room.gameState;
    if (!state || state.phase !== "action") return state;

    const act = action as KingAction;
    if (state.challenge.type === "tap_mash") {
      if (act?.type === "tap") {
        const cur = typeof state.playerInputs[playerId] === "number" ? (state.playerInputs[playerId] as number) : 0;
        return {
          ...state,
          playerInputs: { ...state.playerInputs, [playerId]: cur + 1 },
        };
      }
      if (act?.type === "taps" && typeof act.count === "number" && Number.isInteger(act.count)) {
        const add = Math.max(0, Math.min(MAX_TAP_BATCH, act.count));
        if (add === 0) return state;
        const cur = typeof state.playerInputs[playerId] === "number" ? (state.playerInputs[playerId] as number) : 0;
        return {
          ...state,
          playerInputs: { ...state.playerInputs, [playerId]: cur + add },
        };
      }
    } else if (state.challenge.type === "reaction_tap") {
      const ms =
        act?.type === "react" && typeof act.reactionTimeMs === "number"
          ? act.reactionTimeMs
          : act?.type === "tap"
            ? 350
            : null;
      if (ms !== null) {
        if (state.playerInputs[playerId] !== undefined) return state; // Only first tap
        return {
          ...state,
          playerInputs: { ...state.playerInputs, [playerId]: ms },
        };
      }
    } else if (state.challenge.type === "emoji_math") {
      if (act?.type === "choice" && typeof act.answer === "string") {
        if (state.playerInputs[playerId] !== undefined) return state;
        return {
          ...state,
          playerInputs: { ...state.playerInputs, [playerId]: act.answer },
        };
      }
    }

    return state;
  },

  updateGameState(room) {
    const state = room.gameState;
    if (!state) return state;

    if (state.phase === "briefing") {
      const nextTime = state.timeLeft - 1;
      if (nextTime <= 0) {
        return {
          ...state,
          phase: "action",
          timeLeft: state.challenge.type === "tap_mash" ? 5 : 8,
          playerInputs: {},
        };
      }
      return { ...state, timeLeft: nextTime };
    }

    if (state.phase === "action") {
      const nextTime = state.timeLeft - 1;
      if (nextTime <= 0) {
        return resolveRound(state, room);
      }
      return { ...state, timeLeft: nextTime };
    }

    if (state.phase === "reveal") {
      const nextTime = state.timeLeft - 1;
      if (nextTime <= 0) {
        if (state.currentRound >= state.totalRounds) {
          const scores = state.currentScores;
          const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
          return {
            ...state,
            phase: "result",
            winnerId: entries[0]?.[0] ?? state.currentKingId ?? null,
            timeLeft: 0,
          };
        } else {
          const nextR = state.currentRound + 1;
          return {
            ...state,
            phase: "briefing",
            currentRound: nextR,
            timeLeft: 4,
            challenge: getChallenge(nextR),
            playerInputs: {},
            roundWinnerId: null,
          };
        }
      }
      return { ...state, timeLeft: nextTime };
    }

    return state;
  },

  endRound(room) {
    return this.createGame(room);
  },

  endGame(room): GameSummary {
    const state = room.gameState;
    const scores = state?.currentScores ?? {};
    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const winnerId = state?.winnerId ?? entries[0]?.[0] ?? "";

    const achievements: Achievement[] = [];
    if (winnerId) {
      achievements.push({
        id: "crowned_king",
        name: "今晚唯一真王",
        icon: "👑",
        description: "在挑戰中橫掃千軍登基稱王",
        playerId: winnerId,
      });
    }

    return { scores, achievements, winnerId };
  },

  calculateScores(room) {
    return room.gameState?.currentScores ?? {};
  },
};

function resolveRound(state: KingGameState, _room: Room<KingGameState>): KingGameState {
  const scores = { ...state.currentScores };
  let bestPlayerId: string | null = null;

  if (state.challenge.type === "tap_mash") {
    let maxTaps = -1;
    for (const [id, count] of Object.entries(state.playerInputs)) {
      if (typeof count === "number" && count > maxTaps) {
        maxTaps = count;
        bestPlayerId = id;
      }
    }
  } else if (state.challenge.type === "reaction_tap") {
    let fastestMs = 999999;
    for (const [id, ms] of Object.entries(state.playerInputs)) {
      if (typeof ms === "number" && ms < fastestMs && ms > 50) {
        fastestMs = ms;
        bestPlayerId = id;
      }
    }
  } else if (state.challenge.type === "emoji_math") {
    const target = state.challenge.correctAnswer ?? "3";
    for (const [id, ans] of Object.entries(state.playerInputs)) {
      if (ans === target) {
        bestPlayerId = id;
        break;
      }
    }
  }

  if (bestPlayerId) {
    scores[bestPlayerId] = (scores[bestPlayerId] ?? 0) + 25;
  }

  return {
    ...state,
    phase: "reveal",
    timeLeft: 5,
    roundWinnerId: bestPlayerId,
    currentKingId: bestPlayerId ?? state.currentKingId,
    currentScores: scores,
  };
}
