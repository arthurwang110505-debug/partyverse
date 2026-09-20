import type { Achievement, GameEngine, GameSummary, Room } from "@/types";

export const MYSTERY_GAME_ID = "mysteryroom";

export interface ClueItem {
  id: string;
  title: string;
  content: string;
}

export interface MysteryCase {
  title: string;
  background: string;
  correctCode: string;
  clues: ClueItem[];
}

export const MYSTERY_CASES: MysteryCase[] = [
  {
    title: "古堡密室的失落王冠",
    background: "伯爵的純金王冠在暴風雨之夜神秘失蹤，大門被密碼鎖封閉。四張零碎線索散落在不同成員手上！",
    correctCode: "7429",
    clues: [
      { id: "c1", title: "日記殘頁", content: "第一位數字是幸運數字『7』，代表古堡的七道拱門。" },
      { id: "c2", title: "管家的備忘錄", content: "第二位數字比第一位小 3，且密碼第二位是偶數。" },
      { id: "c3", title: "座鐘齒輪刻痕", content: "第三位數字是最小的質數『2』。" },
      { id: "c4", title: "壁爐灰燼碎片", content: "第四位數字是最後的單數最大個位數『9』。" },
    ],
  },
  {
    title: "特務基地緊急解碼",
    background: "基地自毀倒數啟動！雷射防護網擋住了唯一出口。指揮官拆解了四段備用代碼分給特工們！",
    correctCode: "5816",
    clues: [
      { id: "c1", title: "戰術終端記錄", content: "第一位數字是『5』，代表第五代機密代號。" },
      { id: "c2", title: "雷達頻譜", content: "第二位數字是第一位加上 3，恰好是『8』。" },
      { id: "c3", title: "通訊截聽", content: "第三位數字是一切之始的奇數『1』。" },
      { id: "c4", title: "撤離門閘代碼", content: "第四位數字是骰子最大點數『6』。" },
    ],
  },
  {
    title: "深海潛水艇緊急氣閘",
    background: "水壓急遽攀升，深海探測艇艙門被安全系統鎖死！四名船員各自握有一枚儀表板數據！",
    correctCode: "3962",
    clues: [
      { id: "c1", title: "深度計校準", content: "第一位數字是三聯探針的指針數『3』。" },
      { id: "c2", title: "氧氣閥壓力表", content: "第二位數字是第一位的平方，即 3 × 3 = 『9』。" },
      { id: "c3", title: "推進器電壓", content: "第三位數字是第二位減去 3，得到『6』。" },
      { id: "c4", title: "逃生艙門鑰匙孔", content: "最後一位數字是雙人艇標準配額『2』。" },
    ],
  },
];

export const CASE_DATA = MYSTERY_CASES[0];

export type MysteryPhase = "investigation" | "result";

export interface MysteryGameState {
  phase: MysteryPhase;
  currentRound: number;
  timeLeft: number;
  caseTitle: string;
  caseBackground: string;
  correctCode: string;
  /** playerId -> assigned clue */
  playerClues: Record<string, ClueItem>;
  submittedCode: string;
  isUnlocked: boolean;
  unlockedByPlayerId: string | null;
  winnerId: string | null;
  currentScores: Record<string, number>;
}

export interface SubmitCodeAction {
  type: "submitCode";
  code: string;
}

export type MysteryAction = SubmitCodeAction;

function initialScores(players: Room["players"]): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const id of Object.keys(players)) {
    scores[id] = 0;
  }
  return scores;
}

function distributeClues(players: Room["players"], caseData: MysteryCase): Record<string, ClueItem> {
  const pIds = Object.keys(players);
  const result: Record<string, ClueItem> = {};
  pIds.forEach((id, index) => {
    result[id] = caseData.clues[index % caseData.clues.length];
  });
  return result;
}

export const MysteryRoomEngine: GameEngine<MysteryGameState> = {
  createGame(room) {
    const caseData = MYSTERY_CASES[0];
    const clueMap = distributeClues(room.players, caseData);
    return {
      phase: "investigation",
      currentRound: 1,
      timeLeft: Math.max(45, room.settings?.timer ?? 60),
      caseTitle: caseData.title,
      caseBackground: caseData.background,
      correctCode: caseData.correctCode,
      playerClues: clueMap,
      submittedCode: "",
      isUnlocked: false,
      unlockedByPlayerId: null,
      winnerId: null,
      currentScores: initialScores(room.players),
    };
  },

  startGame(room) {
    return this.createGame(room);
  },

  handlePlayerAction(room, playerId, action) {
    const state = room.gameState;
    if (!state || state.phase !== "investigation") return state;

    const act = action as SubmitCodeAction;
    if (act?.type !== "submitCode" || typeof act.code !== "string") return state;

    const clean = act.code.trim();
    if (clean === state.correctCode) {
      // Correct code!
      const scores = { ...state.currentScores };
      // All players get base cooperative score
      for (const id of Object.keys(room.players)) {
        scores[id] = (scores[id] ?? 0) + 20;
      }
      // Finder gets extra bonus
      scores[playerId] = (scores[playerId] ?? 0) + 15;

      return {
        ...state,
        phase: "result",
        submittedCode: clean,
        isUnlocked: true,
        unlockedByPlayerId: playerId,
        winnerId: playerId,
        currentScores: scores,
        timeLeft: 0,
      };
    }

    return {
      ...state,
      submittedCode: clean,
    };
  },

  updateGameState(room) {
    const state = room.gameState;
    if (!state) return state;

    if (state.phase === "investigation") {
      const nextTime = state.timeLeft - 1;
      if (nextTime <= 0) {
        return {
          ...state,
          phase: "result",
          isUnlocked: false,
          timeLeft: 0,
        };
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
    if (state?.isUnlocked) {
      achievements.push({
        id: "escape_genius",
        name: "密室破壁者",
        icon: "🔍",
        description: "在時限內解開密碼，帶領全體成功逃脫",
        playerId: state.unlockedByPlayerId ?? winnerId,
      });
    }

    return { scores, achievements, winnerId };
  },

  calculateScores(room) {
    return room.gameState?.currentScores ?? {};
  },
};
