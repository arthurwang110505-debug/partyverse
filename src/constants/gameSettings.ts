import { DEFAULT_ROOM_SETTINGS } from "./room";
import type { RoomSettings } from "@/types";

export interface GameSettingsProfile {
  timerLabel: string;
  timerHint: string;
  timerMin: number;
  timerMax: number;
  defaultTimer: number;
  roundsLabel: string;
  defaultRounds: number;
  maxRounds: number;
  hasDifficulty: boolean;
  hasTimer: boolean;
}

const BASE: GameSettingsProfile = {
  timerLabel: "作答秒數",
  timerHint: "全員完成後會提早揭曉，不必等到時間結束。",
  timerMin: 8,
  timerMax: 60,
  defaultTimer: 15,
  roundsLabel: "回合數",
  defaultRounds: 3,
  maxRounds: 10,
  hasDifficulty: false,
  hasTimer: true,
};
const PROFILES: Record<string, Partial<GameSettingsProfile>> = {
  bombcountdown: {
    timerLabel: "炸彈引信秒數",
    timerHint: "答對傳給下一人，引信不重置；難度越高、淘汰越多人，引信越短。",
    timerMin: 8,
    defaultTimer: 20,
    maxRounds: 5,
    hasDifficulty: true,
  },
  drawandguess: {
    timerLabel: "每人作畫秒數",
    timerHint: "每人輪流作畫；全員猜中會提早揭曉。",
    timerMin: 30,
    timerMax: 120,
    defaultTimer: 60,
    roundsLabel: "每人作畫次數",
    defaultRounds: 1,
    maxRounds: 3,
    hasDifficulty: true,
  },
  aibullshit: { timerLabel: "編寫答案秒數", timerMin: 20, defaultTimer: 30, maxRounds: 16 },
  whoisundercoveragent: {
    timerLabel: "討論秒數",
    timerHint: "討論後有 20 秒投票。",
    timerMin: 30,
    timerMax: 120,
    defaultTimer: 60,
    maxRounds: 1,
    defaultRounds: 1,
  },
  song3seconds: { timerMin: 6, defaultTimer: 10, maxRounds: 6 },
  kingtonight: { hasTimer: false, maxRounds: 5 },
  fireworkmaster: {
    timerLabel: "設計秒數",
    timerHint: "設計完成後會一起施放，再投票。",
    timerMin: 25,
    timerMax: 90,
    defaultTimer: 45,
    maxRounds: 1,
    defaultRounds: 1,
  },
  realbattle: {
    timerLabel: "戰鬥秒數",
    timerHint: "倒數結束後，全員同時搶奪金幣。",
    timerMin: 20,
    timerMax: 180,
    defaultTimer: 45,
    maxRounds: 1,
    defaultRounds: 1,
  },
  mysteryroom: {
    timerLabel: "解謎秒數",
    timerHint: "分享各自的線索，在時間內一起解出密碼。",
    timerMin: 45,
    timerMax: 600,
    defaultTimer: 180,
    maxRounds: 1,
    defaultRounds: 1,
  },
};
export function gameSettingsProfile(gameId: string): GameSettingsProfile {
  return { ...BASE, ...PROFILES[gameId] };
}
function integer(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback;
}
export function normalizeSettings(gameId: string, input: Partial<RoomSettings> = {}): RoomSettings {
  const profile = gameSettingsProfile(gameId);
  return {
    ...DEFAULT_ROOM_SETTINGS,
    timer: integer(input.timer, profile.defaultTimer, profile.timerMin, profile.timerMax),
    rounds: integer(input.rounds, profile.defaultRounds, 1, profile.maxRounds),
    difficulty: ["easy", "medium", "hard"].includes(input.difficulty ?? "") ? input.difficulty! : "easy",
    soundEnabled: input.soundEnabled !== false,
    ageMode: input.ageMode === "adults" ? "adults" : "family",
  };
}
