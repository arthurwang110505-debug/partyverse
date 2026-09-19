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

export const CASE_DATA: MysteryCase = {
  title: "古堡密室的失落王冠",
  background: "伯爵的純金王冠在暴風雨之夜神秘失蹤，大門被密碼鎖封閉。四張零碎線索散落在不同成員手上！",
  correctCode: "7429",
  clues: [
    { id: "c1", title: "日記殘頁", content: "第一位數字是幸運數字『7』，代表古堡的七道拱門。" },
    { id: "c2", title: "管家的備忘錄", content: "第二位數字比第一位小 3，且密碼第二位是偶數。" },
    { id: "c3", title: "座鐘齒輪刻痕", content: "第三位數字是最小的質數『2』。" },
    { id: "c4", title: "壁爐灰燼碎片", content: "第四位數字是最後的單數最大個位數『9』。" },
  ],
};

export type MysteryPhase = "investigation" | "result";

export interface MysteryGameState {
  phase: MysteryPhase;
  currentRound: number;
  timeLeft: number;
  caseTitle: string;
  caseBackground: string;
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
    const clueMap = distributeClues(room.players, CASE_DATA);
    return {
      phase: "investigation",
      currentRound: 1,
      timeLeft: Math.max(45, room.settings?.timer ?? 60),
      caseTitle: CASE_DATA.title,
      caseBackground: CASE_DATA.background,
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
    if (clean === CASE_DATA.correctCode) {
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
