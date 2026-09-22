import type { Achievement, GameEngine, GameSummary, Room } from "@/types";

export const MYSTERY_GAME_ID = "mysteryroom";

export interface ClueItem {
  id: string;
  title: string;
  content: string;
}

export interface MysteryCase {
  id: string;
  title: string;
  background: string;
  correctCode: string;
  clues: ClueItem[];
}

/**
 * Every case is a constraint puzzle: no single clue states a code digit
 * outright, so the table must talk each clue into the open before the lock
 * can be opened. Each code has exactly one solution.
 */
export const MYSTERY_CASES: MysteryCase[] = [
  {
    id: "castle",
    title: "古堡密室的失落王冠",
    background:
      "伯爵的純金王冠在暴風雨之夜失蹤，密室大門被四位數密碼鎖封閉。四段線索散落在全場玩家手上，任何一人單獨都解不開！",
    correctCode: "7657",
    clues: [
      { id: "c1", title: "管家的日記殘頁", content: "密碼第一位是管家的幸運數字——恰好等於古堡大門的拱門數量。" },
      { id: "c2", title: "石門楣刻痕", content: "古堡大門一共有 7 道拱門。另外，密碼第二、第三位數字相加等於 11。" },
      { id: "c3", title: "座鐘齒輪刻痕", content: "密碼第二位數字比第一位小 1，且是偶數。" },
      { id: "c4", title: "壁爐灰燼碎片", content: "密碼第四位是最大的個位質數。" },
    ],
  },
  {
    id: "base",
    title: "特務基地緊急解碼",
    background:
      "基地自毀倒數啟動！雷射防護網擋住唯一出口，指揮官把解碼片段分給四名特工——口頭拼湊才能活命！",
    correctCode: "5896",
    clues: [
      { id: "c1", title: "戰術終端記錄", content: "密碼第一位是最新一代機密裝備的代號數字（第五代）。" },
      { id: "c2", title: "雷達頻譜", content: "密碼第二位比第一位多 3。" },
      { id: "c3", title: "通訊截聽", content: "密碼第三位是最大個位奇數。" },
      { id: "c4", title: "撤離門閘代碼", content: "密碼第四位是一顆標準骰子單一面的最大點數。" },
    ],
  },
  {
    id: "submarine",
    title: "深海潛水艇緊急氣閘",
    background:
      "水壓急遽攀升，艙門被安全系統鎖死！四名船員各自握有一枚儀表板數據，必須互相報數才能逃生！",
    correctCode: "3962",
    clues: [
      { id: "c1", title: "深度計校準", content: "密碼第一位是控制台上三聯探針的指針數。" },
      { id: "c2", title: "氧氣閥壓力表", content: "密碼第二位是第一位的平方；壓力表只有個位顯示窗，所以取個位數。" },
      { id: "c3", title: "推進器電壓", content: "密碼第三位比第二位小 3。" },
      { id: "c4", title: "逃生艙門鑰匙孔", content: "密碼第四位是雙人潛艇的標準乘員配額。" },
    ],
  },
  {
    id: "space",
    title: "太空站供氧系統失靈",
    background:
      "「北辰」太空站供氧泵故障，氣密艙門需要重啟代號才能復位！四名值班人員的個人終端各存有一段參數。",
    correctCode: "4846",
    clues: [
      { id: "c1", title: "艙段值班記錄", content: "密碼第一位是太空站目前的值班人員總數。" },
      { id: "c2", title: "壓力監控螢幕", content: "密碼第二位是第一位的兩倍。" },
      { id: "c3", title: "推力室遙測", content: "密碼第三位是第二位的一半。" },
      { id: "c4", title: "緊急頻道頻率", content: "密碼第四位是不含 0 的個位數裡，唯一同時為偶數且能被 3 整除的數字。" },
    ],
  },
  {
    id: "cruiser",
    title: "銀河遊輪的故障艙門",
    background:
      "銀河遊輪「星塵號」在蟲洞外緣拋錨，C 區艙門卡死。船長把維修代號拆成四段交給輪班組員——誰都別想一個人偷偷先跑！",
    correctCode: "6434",
    clues: [
      { id: "c1", title: "船員名冊", content: "密碼第一位是「星塵號」本航次的輪班組員總人數。" },
      { id: "c2", title: "星塵航行圖", content: "密碼第二位比第一位少 2。" },
      { id: "c3", title: "貨艙盤點單", content: "密碼第三位是航線圖上標示的貨艙總數量。" },
      { id: "c4", title: "緊急應變信標", content: "密碼第四位比第三位多 1，而且是最小的能被 4 整除的正整數。" },
    ],
  },
];

export const MAX_HINTS = 3;
export const HINT_TIME_PENALTY = 10;
export const WRONG_CODE_PENALTY = 3;

export type MysteryPhase = "investigation" | "result";

export interface MysteryGameState {
  phase: MysteryPhase;
  currentRound: number;
  timeLeft: number;
  caseId: string;
  caseTitle: string;
  caseBackground: string;
  correctCode: string;
  /** playerId -> assigned clue */
  playerClues: Record<string, ClueItem>;
  submittedCode: string;
  isUnlocked: boolean;
  unlockedByPlayerId: string | null;
  /** How many digits of the code the hint system has already revealed. */
  hintRevealed: number;
  hintsUsed: number;
  wrongAttempts: number;
  /** Last wrong attempt, so phones can shake and buzz. */
  wrongFlash: { code: string; at: number } | null;
  winnerId: string | null;
  currentScores: Record<string, number>;
}

export interface SubmitCodeAction {
  type: "submitCode";
  code: string;
}

export interface RequestHintAction {
  type: "requestHint";
}

export type MysteryAction = SubmitCodeAction | RequestHintAction;

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

export function maskCode(code: string, revealed: number): string {
  const digits = Array.from(code);
  return digits
    .map((digit, index) => (index < revealed ? digit : "•"))
    .join("");
}

export const MysteryRoomEngine: GameEngine<MysteryGameState> = {
  createGame(room) {
    const caseData = MYSTERY_CASES[Math.floor(Math.random() * MYSTERY_CASES.length)] ?? MYSTERY_CASES[0];
    const clueMap = distributeClues(room.players, caseData);
    return {
      phase: "investigation",
      currentRound: 1,
      timeLeft: Math.max(45, room.settings?.timer ?? 60),
      caseId: caseData.id,
      caseTitle: caseData.title,
      caseBackground: caseData.background,
      correctCode: caseData.correctCode,
      playerClues: clueMap,
      submittedCode: "",
      isUnlocked: false,
      unlockedByPlayerId: null,
      hintRevealed: 0,
      hintsUsed: 0,
      wrongAttempts: 0,
      wrongFlash: null,
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

    const act = action as MysteryAction;
    if (act?.type === "requestHint") {
      if (state.hintsUsed >= MAX_HINTS || state.hintRevealed >= state.correctCode.length) return state;
      return {
        ...state,
        hintRevealed: state.hintRevealed + 1,
        hintsUsed: state.hintsUsed + 1,
        timeLeft: Math.max(5, state.timeLeft - HINT_TIME_PENALTY),
      };
    }

    if (act?.type !== "submitCode" || typeof act.code !== "string") return state;

    const clean = act.code.trim();
    if (!/^\d{4}$/.test(clean)) return state;

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
        wrongFlash: null,
      };
    }

    // Wrong code: short penalty so the table keeps pressure, plus a flash
    // so the submitter's phone can shake and buzz.
    return {
      ...state,
      submittedCode: clean,
      wrongAttempts: state.wrongAttempts + 1,
      timeLeft: Math.max(3, state.timeLeft - WRONG_CODE_PENALTY),
      wrongFlash: { code: clean, at: Date.now() },
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
      if ((state.hintsUsed ?? 0) === 0) {
        achievements.push({
          id: "pure_deduction",
          name: "純推理大師",
          icon: "🧠",
          description: "完全不靠提示，靠團隊推理開鎖",
          playerId: state.unlockedByPlayerId ?? winnerId,
        });
      }
    }

    return { scores, achievements, winnerId };
  },

  calculateScores(room) {
    return room.gameState?.currentScores ?? {};
  },
};
