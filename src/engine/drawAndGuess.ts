import type { Achievement, GameEngine, GameSummary, Room } from "@/types";
import { connectedParticipantIds } from "./participants";
import { topScorers } from "./scoring";

export const DRAW_GAME_ID = "drawandguess";
export interface DrawPrompt {
  id: string;
  word: string;
  category: string;
  aliases?: string[];
}
export const DRAW_PROMPTS: DrawPrompt[] = [
  { id: "d1", word: "貓咪", category: "動物", aliases: ["貓", "小貓", "cat"] },
  { id: "d2", word: "漢堡", category: "食物", aliases: ["漢堡包", "burger"] },
  { id: "d3", word: "西瓜", category: "水果" },
  { id: "d4", word: "摩天輪", category: "遊樂設施" },
  { id: "d5", word: "恐龍", category: "動物" },
  { id: "d6", word: "外星人", category: "神秘生物" },
  { id: "d7", word: "珍珠奶茶", category: "飲食", aliases: ["珍奶", "波霸奶茶"] },
  { id: "d8", word: "吉他", category: "樂器" },
  { id: "d9", word: "火箭", category: "太空" },
  { id: "d10", word: "企鵝", category: "動物" },
  { id: "d11", word: "富士山", category: "地標" },
  { id: "d12", word: "超人", category: "超級英雄" },
  { id: "d13", word: "比薩", category: "食物", aliases: ["披薩", "pizza"] },
  { id: "d14", word: "海綿寶寶", category: "卡通角色" },
  { id: "d15", word: "章魚", category: "海洋生物" },
  { id: "d16", word: "彩虹", category: "自然" },
  { id: "d17", word: "滑板", category: "運動" },
  { id: "d18", word: "爆米花", category: "食物" },
];

export type DrawPhase = "briefing" | "drawing" | "reveal" | "result";
export interface StrokeLine {
  id: string;
  revision: number;
  color: string;
  width: number;
  points: number[];
}
export const MAX_STROKES = 200;
export const MAX_STROKE_POINTS = 1024;
export const DRAW_COLORS = ["#ffffff", "#ef4444", "#3b82f6", "#10b981", "#eab308", "#ec4899", "#8b5cf6", "#f97316"];
export interface DrawGameState {
  phase: DrawPhase;
  currentRound: number;
  totalRounds: number;
  timeLeft: number;
  drawDuration: number;
  drawerPlayerId: string;
  drawerOrder: string[];
  prompt: DrawPrompt;
  usedPromptIds: string[];
  strokes: StrokeLine[];
  canvasVersion: number;
  guesses: Record<string, string>;
  correctPlayerIds: string[];
  currentScores: Record<string, number>;
  roundScores: Record<string, number>;
  roundReason: "time" | "solved" | "disconnected" | null;
  winnerId: string | null;
}
export interface AddStrokeAction {
  type: "addStroke";
  stroke: StrokeLine;
  canvasVersion: number;
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

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
function choosePrompt(history: string[], difficulty: string): { prompt: DrawPrompt; used: string[] } {
  const pool = DRAW_PROMPTS.filter((p) => difficulty !== "hard" || Array.from(p.word).length >= 3);
  let used = history.filter((id) => pool.some((p) => p.id === id));
  let available = pool.filter((p) => !used.includes(p.id));
  if (!available.length) {
    available = pool.filter((p) => p.id !== used[used.length - 1]);
    used = [];
  }
  const prompt = available[Math.floor(Math.random() * available.length)] ?? pool[0];
  return { prompt, used: [...used, prompt.id] };
}
export function normalizeGuess(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{Cf}]/gu, "");
}
export function drawHint(state: DrawGameState, difficulty = "easy"): string {
  const letters = Array.from(state.prompt.word);
  const hintAt = difficulty === "easy" ? state.drawDuration / 2 : state.drawDuration / 4;
  const revealFirst = difficulty !== "hard" && state.timeLeft <= hintAt && letters.length > 1;
  return letters.map((letter, i) => (i === 0 && revealFirst ? letter : "●")).join(" ");
}
export function strokePath(points: number[]): string {
  if (points.length < 2) return "";
  if (points.length === 2) return `M ${points[0]} ${points[1]} l 0.01 0`;
  return (
    `M ${points[0]} ${points[1]}` +
    Array.from(
      { length: points.length / 2 - 1 },
      (_, i) => ` L ${points[(i + 1) * 2]} ${points[(i + 1) * 2 + 1]}`,
    ).join("")
  );
}
function endDrawing(state: DrawGameState, reason: DrawGameState["roundReason"]): DrawGameState {
  return { ...state, phase: "reveal", timeLeft: 5, roundReason: reason };
}
function nextTurn(room: Room<DrawGameState>, state: DrawGameState): DrawGameState {
  const online = connectedParticipantIds(room);
  if (online.length >= 2) {
    for (let index = state.currentRound; index < state.totalRounds; index++) {
      const drawer = state.drawerOrder[index % state.drawerOrder.length];
      if (!online.includes(drawer)) continue;
      const { prompt, used } = choosePrompt(state.usedPromptIds, room.settings.difficulty);
      return {
        ...state,
        phase: "briefing",
        currentRound: index + 1,
        timeLeft: 3,
        drawerPlayerId: drawer,
        prompt,
        usedPromptIds: used,
        strokes: [],
        guesses: {},
        correctPlayerIds: [],
        roundScores: {},
        roundReason: null,
        canvasVersion: state.canvasVersion + 1,
      };
    }
  }
  return { ...state, phase: "result", timeLeft: 0, winnerId: topScorers(state.currentScores)[0] ?? null };
}

export const DrawAndGuessEngine: GameEngine<DrawGameState> = {
  createGame(room) {
    const ids = shuffle(connectedParticipantIds(room));
    const { prompt, used } = choosePrompt(room.contentHistory?.[DRAW_GAME_ID] ?? [], room.settings.difficulty);
    return {
      phase: ids.length >= 2 ? "briefing" : "result",
      currentRound: 1,
      // One rotation per configured round: nobody loses their drawing turn.
      totalRounds: ids.length * Math.min(3, Math.max(1, room.settings.rounds ?? 1)),
      timeLeft: 3,
      drawDuration: Math.max(30, room.settings.timer ?? 60),
      drawerPlayerId: ids[0] ?? "",
      drawerOrder: ids,
      prompt,
      usedPromptIds: used,
      strokes: [],
      canvasVersion: 0,
      guesses: {},
      correctPlayerIds: [],
      roundScores: {},
      roundReason: null,
      winnerId: null,
      currentScores: Object.fromEntries(ids.map((id) => [id, 0])),
    };
  },
  startGame(room) {
    return this.createGame(room);
  },
  handlePlayerAction(room, playerId, action) {
    const state = room.gameState;
    if (!state || state.phase !== "drawing" || !connectedParticipantIds(room).includes(playerId)) return state;
    const act = action as DrawAction | null;
    if (playerId === state.drawerPlayerId) {
      if (act?.type === "clearCanvas") return { ...state, strokes: [], canvasVersion: state.canvasVersion + 1 };
      if (act?.type === "undoStroke")
        return { ...state, strokes: state.strokes.slice(0, -1), canvasVersion: state.canvasVersion + 1 };
      if (act?.type !== "addStroke" || act.canvasVersion !== state.canvasVersion) return state;
      const line = act.stroke;
      if (
        !line ||
        typeof line.id !== "string" ||
        !line.id ||
        line.id.length > 80 ||
        !Number.isInteger(line.revision) ||
        line.revision < 1 ||
        line.revision > 100000
      )
        return state;
      if (!DRAW_COLORS.includes(line.color) || ![3, 6, 12].includes(line.width)) return state;
      if (
        !Array.isArray(line.points) ||
        line.points.length < 2 ||
        line.points.length > MAX_STROKE_POINTS ||
        line.points.length % 2 !== 0 ||
        line.points.some((n) => typeof n !== "number" || !Number.isFinite(n))
      )
        return state;
      const index = state.strokes.findIndex((s) => s.id === line.id);
      if (index < 0 && state.strokes.length >= MAX_STROKES) return state;
      if (index >= 0 && state.strokes[index].revision >= line.revision) return state;
      const safe: StrokeLine = {
        id: line.id,
        revision: line.revision,
        color: line.color,
        width: line.width,
        points: line.points.map((n) => Math.round(Math.min(400, Math.max(0, n)))),
      };
      const strokes = [...state.strokes];
      if (index < 0) strokes.push(safe);
      else strokes[index] = safe;
      return { ...state, strokes };
    }
    if (act?.type !== "guessWord" || typeof act.word !== "string" || state.correctPlayerIds.includes(playerId))
      return state;
    const guess = act.word.trim().slice(0, 40);
    if (!normalizeGuess(guess)) return state;
    const correct = [state.prompt.word, ...(state.prompt.aliases ?? [])].some(
      (word) => normalizeGuess(word) === normalizeGuess(guess),
    );
    // Never broadcast the winning guess as a public ticker item.
    const guesses = { ...state.guesses, [playerId]: correct ? "答對了！" : guess };
    if (!correct) return { ...state, guesses };
    const points = 10 + Math.min(15, Math.floor((15 * state.timeLeft) / state.drawDuration));
    const next = {
      ...state,
      guesses,
      correctPlayerIds: [...state.correctPlayerIds, playerId],
      currentScores: {
        ...state.currentScores,
        [playerId]: (state.currentScores[playerId] ?? 0) + points,
        [state.drawerPlayerId]: (state.currentScores[state.drawerPlayerId] ?? 0) + 5,
      },
      roundScores: {
        ...state.roundScores,
        [playerId]: points,
        [state.drawerPlayerId]: (state.roundScores[state.drawerPlayerId] ?? 0) + 5,
      },
    };
    const guessers = connectedParticipantIds(room).filter((id) => id !== state.drawerPlayerId);
    return guessers.length > 0 && guessers.every((id) => next.correctPlayerIds.includes(id))
      ? endDrawing(next, "solved")
      : next;
  },
  updateGameState(room) {
    const state = room.gameState;
    if (!state || state.phase === "result") return state;
    if (
      (state.phase === "drawing" || state.phase === "briefing") &&
      !connectedParticipantIds(room).includes(state.drawerPlayerId)
    )
      return endDrawing(state, "disconnected");
    if (state.phase === "drawing") {
      const guessers = connectedParticipantIds(room).filter((id) => id !== state.drawerPlayerId);
      if (!guessers.length) return endDrawing(state, "disconnected");
      if (guessers.every((id) => state.correctPlayerIds.includes(id))) return endDrawing(state, "solved");
    }
    const time = state.timeLeft - 1;
    if (time > 0) return { ...state, timeLeft: time };
    if (state.phase === "briefing") return { ...state, phase: "drawing", timeLeft: state.drawDuration };
    if (state.phase === "drawing") return endDrawing(state, "time");
    return nextTurn(room, state);
  },
  endRound(room) {
    return this.createGame(room);
  },
  endGame(room): GameSummary {
    const scores = room.gameState?.currentScores ?? {};
    const winnerIds = topScorers(scores);
    const achievements: Achievement[] = winnerIds.map((playerId) => ({
      id: `picasso_${playerId}`,
      name: "畫猜搭檔王",
      icon: "🎨",
      description: "作畫與猜題積分最高",
      playerId,
    }));
    return { scores, achievements, winnerId: winnerIds[0] ?? "", winnerIds };
  },
  calculateScores(room) {
    return room.gameState?.currentScores ?? {};
  },
};
