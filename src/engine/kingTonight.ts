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
  { type: "tap_mash", title: "瘋狂狂點！", instruction: "5 秒內狂按螢幕，點最多下的人登基為王！", targetCount: 30 },
  { type: "tap_mash", title: "光速指壓！", instruction: "連打頻率最高者奪得王座！手指不要停！", targetCount: 30 },
  { type: "tap_mash", title: "雙手齊發！", instruction: "可以用兩隻手指輪流點，5 秒後比次數！", targetCount: 30 },
  { type: "tap_mash", title: "最後衝刺！", instruction: "國王命令：全力連打，誰先手軟誰就輸！", targetCount: 30 },
  { type: "reaction_tap", title: "拔刀反應！", instruction: "等畫面變綠並出現「斬」時立刻點！太早按不算。", triggerDelayMs: 2200 },
  { type: "reaction_tap", title: "紅綠燈！", instruction: "紅燈停、綠燈行！看到綠燈立刻按！", triggerDelayMs: 2800 },
  { type: "reaction_tap", title: "西部決鬥！", instruction: "決鬥信號一響，第一個拔槍的人勝！", triggerDelayMs: 1800 },
  { type: "reaction_tap", title: "忍者反射！", instruction: "屏住呼吸……綠光一閃就出手！", triggerDelayMs: 3200 },
  { type: "emoji_math", title: "搶答 #1", instruction: "最快答對的人登基！", question: "🍎 + 🍌 = 5，🍎 = 2，🍌 = ？", options: ["2", "3", "4"], correctAnswer: "3" },
  { type: "emoji_math", title: "搶答 #2", instruction: "最快答對的人登基！", question: "🍕 + 🍕 = 8，🍕 × 🍔 = 20，🍔 = ？", options: ["4", "5", "6"], correctAnswer: "5" },
  { type: "emoji_math", title: "搶答 #3", instruction: "最快答對的人登基！", question: "🐱 × 3 = 12，🐶 = 🐱 + 1，🐶 = ？", options: ["4", "5", "6"], correctAnswer: "5" },
  { type: "emoji_math", title: "搶答 #4", instruction: "最快答對的人登基！", question: "⭐ + ⭐ + ⭐ = 15，⭐ - 2 = ？", options: ["3", "5", "13"], correctAnswer: "3" },
  { type: "emoji_math", title: "搶答 #5", instruction: "最快答對的人登基！", question: "🍩 ÷ 2 = 7，🍩 = ？", options: ["9", "12", "14"], correctAnswer: "14" },
  { type: "emoji_math", title: "搶答 #6", instruction: "最快答對的人登基！", question: "🚗 = 4 個輪子，🚲 = 2 個輪子，🚗 + 🚲 × 2 = ？", options: ["8", "10", "12"], correctAnswer: "8" },
  { type: "emoji_math", title: "搶答 #7", instruction: "最快答對的人登基！", question: "1、1、2、3、5、8、？", options: ["11", "12", "13"], correctAnswer: "13" },
  { type: "emoji_math", title: "搶答 #8", instruction: "最快答對的人登基！", question: "2、4、8、16、？", options: ["24", "32", "20"], correctAnswer: "32" },
  { type: "emoji_math", title: "搶答 #9", instruction: "最快答對的人登基！", question: "🕷️ 有幾隻腳？", options: ["6", "8", "10"], correctAnswer: "8" },
  { type: "emoji_math", title: "搶答 #10", instruction: "最快答對的人登基！", question: "一年有幾個月有 28 天？", options: ["1", "6", "12"], correctAnswer: "12" },
  { type: "emoji_math", title: "搶答 #11", instruction: "最快答對的人登基！", question: "🦆 + 🦆 + 🦆 = 3 隻鴨，共有幾隻腳？", options: ["3", "6", "9"], correctAnswer: "6" },
  { type: "emoji_math", title: "搶答 #12", instruction: "最快答對的人登基！", question: "🎲 骰子對面兩數相加永遠是？", options: ["6", "7", "8"], correctAnswer: "7" },
  { type: "emoji_math", title: "搶答 #13", instruction: "最快答對的人登基！", question: "🧊 冰融化後會變成？", options: ["水", "蒸氣", "霜"], correctAnswer: "水" },
  { type: "emoji_math", title: "搶答 #14", instruction: "最快答對的人登基！", question: "🌈 彩虹通常有幾種顏色？", options: ["5", "7", "9"], correctAnswer: "7" },
  { type: "emoji_math", title: "搶答 #15", instruction: "最快答對的人登基！", question: "✋ 兩隻手加兩隻腳共幾根指頭（含腳趾）？", options: ["10", "15", "20"], correctAnswer: "20" },
  { type: "emoji_math", title: "搶答 #16", instruction: "最快答對的人登基！", question: "🕐 時鐘 3 點整，時針和分針夾角？", options: ["45°", "90°", "180°"], correctAnswer: "90°" },
  { type: "emoji_math", title: "搶答 #17", instruction: "最快答對的人登基！", question: "💯 100 - 1 × 0 = ？", options: ["0", "99", "100"], correctAnswer: "100" },
  { type: "emoji_math", title: "搶答 #18", instruction: "最快答對的人登基！", question: "🐙 章魚有幾隻觸手？", options: ["6", "8", "10"], correctAnswer: "8" },
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
  /** Quiz rounds: first player (in time) to pick the right answer. */
  firstCorrectId?: string | null;
  challengeOrder?: number[];
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

/** Shuffle so each match mixes challenge types and never repeats the same order. */
export function challengeOrder(rand: () => number = Math.random): number[] {
  const ids = MINI_CHALLENGES.map((_, i) => i);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

function getChallenge(order: number[] | undefined, round: number): KingChallenge {
  const list = order && order.length ? order : MINI_CHALLENGES.map((_, i) => i);
  const base = MINI_CHALLENGES[list[(round - 1) % list.length]] ?? MINI_CHALLENGES[0];
  if (!base.options) return base;
  const options = [...base.options];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { ...base, options };
}

export const KingTonightEngine: GameEngine<KingGameState> = {
  createGame(room) {
    const pIds = Object.keys(room.players);
    const initialKing = pIds[0] ?? null;

    const order = challengeOrder();
    return {
      phase: "briefing",
      challengeOrder: order,
      firstCorrectId: null,
      currentRound: 1,
      totalRounds: Math.min(room.settings?.rounds ?? 6, MINI_CHALLENGES.length),
      timeLeft: 4, // 4s briefing
      currentKingId: initialKing,
      challenge: getChallenge(order, 1),
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
        const right = act.answer === state.challenge.correctAnswer;
        const next = {
          ...state,
          playerInputs: { ...state.playerInputs, [playerId]: act.answer },
          firstCorrectId: state.firstCorrectId ?? (right ? playerId : null),
        };
        // Everyone answered → no need to wait out the clock.
        const ids = Object.keys(room.players).filter((id) => room.players[id]?.isConnected !== false);
        if (ids.every((id) => next.playerInputs[id] !== undefined)) return resolveRound(next, room);
        return next;
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
            challenge: getChallenge(state.challengeOrder, nextR),
            playerInputs: {},
            firstCorrectId: null,
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
    bestPlayerId = state.firstCorrectId ?? null;
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
