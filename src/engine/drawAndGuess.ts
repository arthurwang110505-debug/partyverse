import type { Achievement, GameEngine, GameSummary, Room } from "@/types";

export const DRAW_GAME_ID = "drawandguess";

export interface DrawPrompt {
  id: string;
  word: string;
  category: string;
}

export const DRAW_PROMPTS: DrawPrompt[] = [
  { id: "d1", word: "貓咪", category: "動物" },
  { id: "d2", word: "漢堡", category: "食物" },
  { id: "d3", word: "西瓜", category: "水果" },
  { id: "d4", word: "摩天輪", category: "遊樂設施" },
  { id: "d5", word: "恐龍", category: "動物" },
  { id: "d6", word: "外星人", category: "神秘生物" },
  { id: "d7", word: "珍珠奶茶", category: "飲食" },
  { id: "d8", word: "吉他", category: "樂器" },
  { id: "d9", word: "火箭", category: "太空" },
  { id: "d10", word: "企鵝", category: "動物" },
  { id: "d11", word: "富士山", category: "地標" },
  { id: "d12", word: "超人", category: "超級英雄" },
  { id: "d13", word: "比薩", category: "食物" },
  { id: "d14", word: "海綿寶寶", category: "卡通角色" },
  { id: "d15", word: "章魚", category: "海洋生物" },
  { id: "d16", word: "彩虹", category: "自然" },
  { id: "d17", word: "滑板", category: "運動" },
  { id: "d18", word: "爆米花", category: "食物" },
];

export type DrawPhase = "drawing" | "reveal" | "result";

export interface StrokeLine {
  color: string;
  width: number;
  points: number[]; // [x1, y1, x2, y2, ...]
}

export interface DrawGameState {
  phase: DrawPhase;
  currentRound: number;
  totalRounds: number;
  timeLeft: number;
  drawerPlayerId: string;
  prompt: DrawPrompt;
  strokes: StrokeLine[];
  /** playerId -> guessed text */
  guesses: Record<string, string>;
  /** playerIds who guessed correctly */
  correctPlayerIds: string[];
  winnerId: string | null;
  currentScores: Record<string, number>;
}

export interface AddStrokeAction {
  type: "addStroke";
  stroke: StrokeLine;
}

export interface GuessWordAction {
  type: "guessWord";
  word: string;
}

export interface ClearCanvasAction {
  type: "clearCanvas";
}

export interface UndoStrokeAction {
  type: "undoStroke";
}

export type DrawAction = AddStrokeAction | GuessWordAction | ClearCanvasAction | UndoStrokeAction;

function initialScores(players: Room["players"]): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const id of Object.keys(players)) {
    scores[id] = 0;
  }
  return scores;
}

export const DrawAndGuessEngine: GameEngine<DrawGameState> = {
  createGame(room) {
    const pIds = Object.keys(room.players).sort();
    const drawerId = pIds[0] ?? "";
    const prompt = DRAW_PROMPTS[0];

    return {
      phase: "drawing",
      currentRound: 1,
      totalRounds: Math.min(room.settings?.rounds ?? 3, pIds.length),
      timeLeft: Math.max(30, room.settings?.timer ?? 40),
      drawerPlayerId: drawerId,
      prompt,
      strokes: [],
      guesses: {},
      correctPlayerIds: [],
      winnerId: null,
      currentScores: initialScores(room.players),
    };
  },

  startGame(room) {
    return this.createGame(room);
  },

  handlePlayerAction(room, playerId, action) {
    const state = room.gameState;
    if (!state || state.phase !== "drawing") return state;

    const act = action as DrawAction;
    if (act?.type === "addStroke" && playerId === state.drawerPlayerId) {
      if (!act.stroke || !Array.isArray(act.stroke.points)) return state;
      // limit stroke count to avoid large payload
      const strokes = [...state.strokes.slice(-60), act.stroke];
      return { ...state, strokes };
    }

    if (act?.type === "clearCanvas" && playerId === state.drawerPlayerId) {
      return { ...state, strokes: [] };
    }

    if (act?.type === "undoStroke" && playerId === state.drawerPlayerId) {
      return { ...state, strokes: state.strokes.slice(0, -1) };
    }

    if (act?.type === "guessWord" && playerId !== state.drawerPlayerId) {
      if (typeof act.word !== "string" || !act.word.trim()) return state;
      const cleanGuess = act.word.trim();
      const isCorrect = cleanGuess === state.prompt.word;

      const guesses = { ...state.guesses, [playerId]: cleanGuess };
      let correctList = state.correctPlayerIds;
      const scores = { ...state.currentScores };

      if (isCorrect && !state.correctPlayerIds.includes(playerId)) {
        correctList = [...correctList, playerId];
        // Score bonus for guesser
        scores[playerId] = (scores[playerId] ?? 0) + 15;
        // Drawer gets bonus for communicating well
        scores[state.drawerPlayerId] = (scores[state.drawerPlayerId] ?? 0) + 5;
      }

      const otherPlayerIds = Object.keys(room.players).filter(
        (id) => id !== state.drawerPlayerId && room.players[id]?.isConnected !== false,
      );
      const allGuessed = otherPlayerIds.every((id) => correctList.includes(id));

      if (allGuessed) {
        return {
          ...state,
          guesses,
          correctPlayerIds: correctList,
          currentScores: scores,
          phase: "reveal",
          timeLeft: 5,
        };
      }

      return {
        ...state,
        guesses,
        correctPlayerIds: correctList,
        currentScores: scores,
      };
    }

    return state;
  },

  updateGameState(room) {
    const state = room.gameState;
    if (!state) return state;

    if (state.phase === "drawing") {
      const nextTime = state.timeLeft - 1;
      if (nextTime <= 0) {
        return {
          ...state,
          phase: "reveal",
          timeLeft: 5,
        };
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
            winnerId: entries[0]?.[0] ?? null,
            timeLeft: 0,
          };
        } else {
          const pIds = Object.keys(room.players).sort();
          const nextDrawer = pIds[state.currentRound % pIds.length] ?? pIds[0];
          const nextPrompt = DRAW_PROMPTS[state.currentRound % DRAW_PROMPTS.length];
          return {
            ...state,
            phase: "drawing",
            currentRound: state.currentRound + 1,
            timeLeft: Math.max(30, room.settings?.timer ?? 40),
            drawerPlayerId: nextDrawer,
            prompt: nextPrompt,
            strokes: [],
            guesses: {},
            correctPlayerIds: [],
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
        id: "picasso",
        name: "靈魂神筆畫家",
        icon: "🎨",
        description: "繪畫神韻精準，積分傲視群雄",
        playerId: winnerId,
      });
    }

    return { scores, achievements, winnerId };
  },

  calculateScores(room) {
    return room.gameState?.currentScores ?? {};
  },
};
