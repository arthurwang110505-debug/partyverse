import { describe, expect, it } from "vitest";
import type { PlayModeId } from "@/types";
import { GAMES } from "@/constants/games";
import { BATTLE_GAME_COUNT, PLAY_MODES, playModeById, playModeOrDefault } from "@/constants/playModes";
import { playableGameIds } from "@/engine";
import { normalizeSettings } from "@/constants/gameSettings";
import { testRoom } from "@/test/fixtures";
import {
  buildPlaylist,
  durationRange,
  estimatedMinutes,
  parseDurationRange,
  sessionProgress,
  settingsSummary,
  suggestedSettings,
  toSessionPlan,
} from "./playlist";
import { advanceRoomSession, leaveRoomSession, startRoomSession } from "./gameSession";
import { parseRoom } from "./roomData";
import { databaseRoundTrip } from "@/test/fixtures";

const ids = (list: { gameId: string }[]) => list.map((entry) => entry.gameId);

describe("duration estimates", () => {
  it("reads the published duration ranges", () => {
    expect(parseDurationRange("3-8 分鐘")).toEqual({ lo: 3, hi: 8 });
    expect(parseDurationRange("10-20 分鐘")).toEqual({ lo: 10, hi: 20 });
    expect(parseDurationRange("10 分鐘")).toEqual({ lo: 10, hi: 10 });
    expect(parseDurationRange(undefined)).toEqual({ lo: 5, hi: 10 });
  });
  it("knows every shipped game's range", () => {
    for (const gameId of playableGameIds()) {
      const range = durationRange(gameId);
      expect(range.lo).toBeGreaterThan(0);
      expect(range.hi).toBeGreaterThanOrEqual(range.lo);
    }
  });
  it("never claims a shortened game is longer than its fast end", () => {
    for (const game of GAMES.filter((g) => playableGameIds().includes(g.id))) {
      const range = durationRange(game.id);
      const quick = estimatedMinutes(game.id, suggestedSettings(game.id, 3));
      expect(quick).toBeLessThanOrEqual(range.hi);
      expect(quick).toBeGreaterThanOrEqual(1);
    }
  });
  it("suggests settings that keep the longest games out of the shortest mode", () => {
    expect(estimatedMinutes("mysteryroom", suggestedSettings("mysteryroom", 3))).toBeGreaterThan(3);
    expect(estimatedMinutes("mysteryroom", suggestedSettings("mysteryroom", 10))).toBeLessThanOrEqual(10);
  });
  it("summarises the suggestion with the game's own labels", () => {
    const settings = normalizeSettings("brainteaser", { timer: 15, rounds: 5 });
    expect(settingsSummary("brainteaser", settings)).toBe("作答秒數 15 秒 · 題數 5");
    expect(settingsSummary("musicalchairs", normalizeSettings("musicalchairs"))).toBe("預設節奏");
  });
});

describe("play modes", () => {
  it("ships three time boxes and the 8-game battle mode", () => {
    expect(PLAY_MODES.map((mode) => mode.label)).toEqual([
      "3分鐘快閃",
      "5分鐘正常",
      "10分鐘最久",
      "決戰模式",
    ]);
    expect(PLAY_MODES.map((mode) => mode.budgetMinutes)).toEqual([3, 5, 10, null]);
    expect(playModeById("standard")?.budgetMinutes).toBe(5);
    expect(playModeById("battle")?.gameCount).toBe(8);
    expect(playModeOrDefault("nope").id).toBe("standard");
  });
});

describe("playlist drawing", () => {
  const draw = (mode: PlayModeId, options: Parameters<typeof buildPlaylist>[0] = { mode }) =>
    buildPlaylist({ ...options, mode, random: options.random ?? (() => 0) });

  it.each(["flash", "standard", "marathon"] as const)("%s stays inside its budget on every seed", (mode) => {
    for (let seed = 0; seed < 60; seed++) {
      // Deterministic seeds: walk the RNG so each draw is a different shuffle.
      let step = seed;
      const playlist = buildPlaylist({ mode, random: () => ((step = (step * 1103515245 + 12345) % 2147483648) / 2147483648) });
      const budget = playModeById(mode)!.budgetMinutes!;
      expect(playlist.entries.length).toBeGreaterThan(0);
      expect(playlist.totalMinutes).toBeLessThanOrEqual(budget);
      expect(new Set(ids(playlist.entries)).size).toBe(playlist.entries.length);
      for (const entry of playlist.entries) {
        expect(playableGameIds()).toContain(entry.gameId);
        expect(entry.minutes).toBeGreaterThan(0);
        expect(entry.settings.rounds).toBeGreaterThan(0);
      }
    }
  });

  it("draws eight distinct, seat-compatible games for battle mode", () => {
    const battle = buildPlaylist({ mode: "battle", playerCount: 4, random: () => 0.37 });
    expect(battle.mode).toBe("battle");
    expect(battle.budgetMinutes).toBeNull();
    expect(battle.targetGames).toBe(8);
    expect(battle.entries).toHaveLength(8);
    expect(new Set(ids(battle.entries)).size).toBe(8);
    for (const entry of battle.entries) {
      const game = GAMES.find((candidate) => candidate.id === entry.gameId)!;
      expect(game.minPlayers).toBeLessThanOrEqual(4);
      expect(game.maxPlayers).toBeGreaterThanOrEqual(4);
    }
  });

  it("does not fill battle mode with games that the group cannot play", () => {
    const battle = buildPlaylist({ mode: "battle", playerCount: 3, random: () => 0 });
    expect(battle.entries).toHaveLength(7);
    expect(battle.targetGames).toBe(8);
    for (const entry of battle.entries) {
      expect(GAMES.find((game) => game.id === entry.gameId)!.minPlayers).toBeLessThanOrEqual(3);
    }
  });

  it("prefers unplayed games and brings back older games before recent repeats in battle mode", () => {
    const candidates = GAMES.filter(
      (game) => playableGameIds().includes(game.id) && game.minPlayers <= 4 && game.maxPlayers >= 4,
    )
      .slice(0, 8)
      .map((game) => game.id);
    const freshFirst = buildPlaylist({ mode: "battle", playerCount: 4, gameIds: candidates, history: candidates.slice(0, 7), random: () => 0 });
    expect(freshFirst.entries[0].gameId).toBe(candidates[7]);

    const oldestFirst = buildPlaylist({ mode: "battle", playerCount: 4, gameIds: candidates, history: candidates, random: () => 0 });
    expect(oldestFirst.entries[0].gameId).toBe(candidates[0]);
    expect(oldestFirst.entries.every((entry) => entry.repeated)).toBe(true);
  });

  it("fits several games into the longest mode and keeps the fastest mode short", () => {
    const flash = draw("flash");
    expect(flash.totalMinutes).toBeLessThanOrEqual(3);
    const marathon = draw("marathon");
    expect(marathon.entries.length).toBeGreaterThanOrEqual(2);
    expect(marathon.totalMinutes).toBeGreaterThanOrEqual(5);
  });

  it("avoids games already played, and reports the ones it skipped", () => {
    const first = draw("marathon");
    const history = ids(first.entries);
    const second = buildPlaylist({ mode: "marathon", history });
    for (const entry of second.entries) expect(history).not.toContain(entry.gameId);
    expect(second.avoided.length).toBeGreaterThan(0);
    for (const gameId of second.avoided) expect(history).toContain(gameId);
  });

  it("repeats the oldest games rather than drawing nothing once everything is played", () => {
    const everything = playableGameIds();
    const playlist = buildPlaylist({ mode: "marathon", history: everything });
    expect(playlist.entries.length).toBeGreaterThan(0);
    // Nothing is fresh any more: every draw is a repeat, flagged for the lobby.
    expect(playlist.entries.every((entry) => entry.repeated)).toBe(true);
    // …and the oldest game in the history is the one that comes back first.
    expect(playlist.entries[0].gameId).toBe(everything[0]);
  });

  it("ignores games that cannot seat the group", () => {
    const playlist = buildPlaylist({ mode: "marathon", playerCount: 2 });
    for (const entry of playlist.entries) {
      const game = GAMES.find((g) => g.id === entry.gameId)!;
      expect(game.minPlayers).toBeLessThanOrEqual(2);
    }
  });

  it("still returns one game when the mode is tighter than anything playable", () => {
    const playlist = buildPlaylist({ mode: { ...PLAY_MODES[0], budgetMinutes: 0 }, gameIds: ["kingtonight"] });
    expect(playlist.entries).toHaveLength(1);
    expect(playlist.entries[0].gameId).toBe("kingtonight");
  });

  it("is deterministic for a fixed RNG", () => {
    const fixed = () => 0.42;
    expect(ids(buildPlaylist({ mode: "standard", random: fixed }).entries)).toEqual(
      ids(buildPlaylist({ mode: "standard", random: fixed }).entries),
    );
  });
});

describe("session progress", () => {
  it("counts the current game and the queue behind it", () => {
    const plan = toSessionPlan(buildPlaylist({ mode: "marathon" }), 500);
    const progress = sessionProgress(plan)!;
    expect(progress.index).toBe(1);
    expect(progress.total).toBe(plan.entries.length);
    expect(progress.remainingMinutes).toBe(
      plan.entries.slice(1).reduce((sum, entry) => sum + entry.minutes, 0),
    );
    expect(progress.finished).toBe(false);
    expect(sessionProgress(null)).toBeNull();
  });
});

describe("room session transitions", () => {
  const plan = toSessionPlan(buildPlaylist({ mode: "marathon", gameIds: ["followme", "whackmoles", "musicalchairs"] }), 500);
  const battlePlan = toSessionPlan(buildPlaylist({ mode: "battle", playerCount: 4, random: () => 0.31 }), 600);

  it("loads the first entry with its suggested settings", () => {
    const room = startRoomSession(testRoom("bombcountdown"), plan, 700);
    expect(room.gameId).toBe(plan.entries[0].gameId);
    expect(room.status).toBe("LOBBY");
    expect(room.settings).toEqual(plan.entries[0].settings);
    expect(room.sessionPlan?.startedAt).toBe(500);
  });

  it("requires eight unique entries to start a battle session", () => {
    const shortPlan = toSessionPlan(buildPlaylist({ mode: "battle", playerCount: 3 }), 600);
    expect(shortPlan.entries).toHaveLength(7);
    expect(() => startRoomSession(testRoom("brainteaser"), shortPlan, 700)).toThrow(/8 款不同/);

    const valid = startRoomSession(testRoom(battlePlan.entries[0].gameId), battlePlan, 700);
    expect(valid.sessionPlan?.mode).toBe("battle");
    expect(valid.sessionPlan?.entries).toHaveLength(8);
    expect(valid.sessionPlan?.totalScores).toBeUndefined();
  });

  it("accumulates game scores and completes a battle only after all eight results", () => {
    let room = startRoomSession(testRoom(battlePlan.entries[0].gameId), battlePlan, 700);
    let firstAdvance: ReturnType<typeof advanceRoomSession> = null;

    battlePlan.entries.forEach((entry, index) => {
      const result = {
        ...room,
        status: "RESULTS" as const,
        participantIds: ["p1", "p2"],
        gameState: { currentScores: { p1: 10 + index, p2: 5 } },
      };
      firstAdvance = advanceRoomSession(result, 900 + index);
      expect(firstAdvance?.sessionPlan?.played).toHaveLength(index + 1);
      if (index < BATTLE_GAME_COUNT - 1) {
        expect(firstAdvance?.status).toBe("LOBBY");
        expect(firstAdvance?.sessionPlan?.entries[0].gameId).toBe(battlePlan.entries[index + 1].gameId);
        expect(() => advanceRoomSession(firstAdvance!, 950 + index)).toThrow(/不能跳過/);
      } else {
        expect(firstAdvance?.status).toBe("RESULTS");
        expect(firstAdvance?.sessionPlan?.entries).toEqual([]);
        expect(firstAdvance?.sessionPlan?.completedAt).toBe(900 + index);
        expect(firstAdvance?.sessionPlan?.totalScores).toEqual({ p1: 108, p2: 40 });
      }
      room = firstAdvance ?? room;
    });
  });

  it("preserves cumulative battle scores across the database round trip", () => {
    let room = startRoomSession(testRoom(battlePlan.entries[0].gameId), battlePlan, 700);
    room = advanceRoomSession(
      { ...room, status: "RESULTS", participantIds: ["p1", "p2"], gameState: { currentScores: { p1: 12, p2: 4 } } },
      900,
    )!;
    const parsed = parseRoom(databaseRoundTrip(room) as unknown as Record<string, unknown>, room.id)!;
    expect(parsed.sessionPlan?.budgetMinutes).toBeNull();
    expect(parsed.sessionPlan?.totalScores).toEqual({ p1: 12, p2: 4 });
    expect(parsed.sessionPlan?.played).toEqual([battlePlan.entries[0].gameId]);
  });

  it("promotes the next entry and records the one that finished", () => {
    const room = startRoomSession({ ...testRoom(plan.entries[0].gameId), status: "RESULTS" }, plan);
    const next = advanceRoomSession(room, 900)!;
    expect(next.sessionPlan?.entries[0].gameId).toBe(plan.entries[1].gameId);
    expect(next.sessionPlan?.played).toEqual([plan.entries[0].gameId]);
    expect(next.gameId).toBe(plan.entries[1].gameId);
    expect(next.status).toBe("LOBBY");
    expect(next.players.p1.score).toBe(0);
  });

  it("completes the session after the last game instead of switching away", () => {
    let room = startRoomSession(testRoom(plan.entries[0].gameId), plan);
    for (const _entry of plan.entries) {
      room = { ...(advanceRoomSession({ ...room, status: "RESULTS" }, 900) ?? room) };
    }
    expect(room.sessionPlan?.entries).toEqual([]);
    expect(room.sessionPlan?.completedAt).toBe(900);
    expect(room.sessionPlan?.played).toEqual(ids(plan.entries));
    // Finished: there is nothing to advance to, and the stored plan says so.
    expect(advanceRoomSession(room, 901)).toBeNull();
    expect(sessionProgress(room.sessionPlan)?.finished).toBe(true);
    expect(advanceRoomSession({ ...room, sessionPlan: undefined }, 901)).toBeNull();
  });

  it("drops the session when the host picks a different game by hand", () => {
    const room = startRoomSession(testRoom("bombcountdown"), plan);
    expect(leaveRoomSession(room, room.gameId).sessionPlan).toBeDefined();
    expect(leaveRoomSession(room, "brainteaser").sessionPlan).toBeUndefined();
  });

  it("survives the database round trip", () => {
    const room = databaseRoundTrip(startRoomSession(testRoom("bombcountdown"), plan, 500));
    const parsed = parseRoom(room as unknown as Record<string, unknown>, room.id)!;
    expect(parsed.sessionPlan?.mode).toBe("marathon");
    expect(parsed.sessionPlan?.entries.map((entry) => entry.gameId)).toEqual(ids(plan.entries));
    expect(parsed.sessionPlan?.entries[0].settings).toEqual(plan.entries[0].settings);
    expect(parsed.sessionPlan?.startedAt).toBe(500);
  });

  it("ignores a garbage plan instead of crashing the lobby", () => {
    const parsed = parseRoom({ id: "TESTA", sessionPlan: { mode: "nope", entries: "x" } }, "TESTA");
    expect(parsed?.sessionPlan).toBeUndefined();
  });
});
