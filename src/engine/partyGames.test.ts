import { describe, expect, it } from "vitest";
import type { Room } from "@/types";
import { testRoom } from "@/test/fixtures";
import { getGameEngine } from "./index";
import type { UndercoverGameState } from "./whoIsUndercover";
import {
  MAX_HINTS,
  MYSTERY_CASES,
  maskCode,
  MysteryRoomEngine,
  WRONG_CODE_PENALTY,
  HINT_TIME_PENALTY,
  type MysteryGameState,
} from "./mysteryRoom";
import {
  SONG_LIST,
  Song3SecondsEngine,
  initialLyricRevealed,
  lyricMask,
  type SongGameState,
} from "./song3Seconds";
import { KingTonightEngine, MAX_TAP_BATCH, type KingGameState } from "./kingTonight";
import { BATTLE_GAME_ID, RealBattleEngine, type BattleGameState } from "./realBattle";
import { FireworkMasterEngine, sanitizeDesign, type FireworkDesign } from "./fireworkMaster";

describe("whoisundercoveragent: tie and offline rules", () => {
  // The guarded registry engine is what production uses: it strips the
  // display-only seat so "everyone voted" never waits on the TV.
  const engine = getGameEngine("whoisundercoveragent")!;

  it("a tied vote eliminates nobody instead of picking an arbitrary victim", () => {
    const room = testRoom("whoisundercoveragent", 4) as unknown as Room<UndercoverGameState>;
    const state = engine.createGame(room);
    room.gameState = { ...state, phase: "voting", votes: {} };

    // p2 and p3 each collect two votes -> stalemate
    let next = engine.handlePlayerAction(room, "p1", { type: "vote", targetPlayerId: "p2" });
    room.gameState = next;
    next = engine.handlePlayerAction(room, "p2", { type: "vote", targetPlayerId: "p3" });
    room.gameState = next;
    next = engine.handlePlayerAction(room, "p3", { type: "vote", targetPlayerId: "p2" });
    room.gameState = next;
    next = engine.handlePlayerAction(room, "p4", { type: "vote", targetPlayerId: "p3" });

    expect(next.phase).toBe("eliminated");
    expect(next.lastVotedOutId).toBeNull();
    expect(next.eliminatedPlayerIds).toEqual([]);
  });

  it("forces an end when the only connected seat left is the spy", () => {
    const room = testRoom("whoisundercoveragent", 6) as unknown as Room<UndercoverGameState>;
    const state = engine.createGame(room);
    // The spy is p6; p1 and p2 are out; p3-p5 dropped the call.
    room.players.p3.isConnected = false;
    room.players.p4.isConnected = false;
    room.players.p5.isConnected = false;
    room.gameState = {
      ...state,
      phase: "voting",
      votes: {},
      eliminatedPlayerIds: ["p1", "p2"],
      undercoverPlayerId: "p6",
    };

    const next = engine.handlePlayerAction(room, "p6", { type: "vote", targetPlayerId: "p3" });
    expect(next.phase).toBe("result");
    expect(next.winnerTeam).toBe("undercover");
    expect(next.currentScores["p6"]).toBe(50);
  });

  it("gives the table the win when only a civilian is still connected", () => {
    const room = testRoom("whoisundercoveragent", 6) as unknown as Room<UndercoverGameState>;
    const state = engine.createGame(room);
    // Spy p6 disconnected; p1/p2 out; p4/p5 gone; only civilian p3 remains.
    room.players.p4.isConnected = false;
    room.players.p5.isConnected = false;
    room.players.p6.isConnected = false;
    room.gameState = {
      ...state,
      phase: "voting",
      votes: {},
      eliminatedPlayerIds: ["p1", "p2"],
      undercoverPlayerId: "p6",
    };

    const next = engine.handlePlayerAction(room, "p3", { type: "vote", targetPlayerId: "p4" });
    expect(next.phase).toBe("result");
    expect(next.winnerTeam).toBe("civilians");
    expect(next.currentScores["p3"]).toBe(20);
    expect(next.currentScores["p6"]).toBe(0);
  });
});

describe("mysteryroom: cases, hints and wrong codes", () => {
  it("ships five solvable cases and picks one at random", () => {
    expect(MYSTERY_CASES).toHaveLength(5);
    const ids = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const room = testRoom("mysteryroom", 4) as unknown as Room<MysteryGameState>;
      const state = MysteryRoomEngine.createGame(room);
      ids.add(state.caseId);
      expect(MYSTERY_CASES).toContainEqual(MYSTERY_CASES.find((c) => c.id === state.caseId));
      expect(state.correctCode).toMatch(/^\d{4}$/);
      // Every participant holds a clue.
      for (const id of Object.keys(room.players)) {
        if (id !== "tv") expect(state.playerClues[id]).toBeDefined();
      }
    }
    // With 5 cases and 40 runs, effectively always more than one case shows up.
    expect(ids.size).toBeGreaterThan(1);
  });

  it("penalizes a wrong code with time and records the attempt", () => {
    const room = testRoom("mysteryroom", 4) as unknown as Room<MysteryGameState>;
    const state = MysteryRoomEngine.createGame(room);
    room.gameState = state;

    const wrong = state.correctCode.slice(0, 3) + ((Number(state.correctCode[3]) + 1) % 10);
    const next = MysteryRoomEngine.handlePlayerAction(room, "p1", { type: "submitCode", code: wrong });

    expect(next.phase).toBe("investigation");
    expect(next.isUnlocked).toBe(false);
    expect(next.wrongAttempts).toBe(1);
    expect(next.timeLeft).toBe(state.timeLeft - WRONG_CODE_PENALTY);
    expect(next.wrongFlash?.code).toBe(wrong);

    // Malformed codes are ignored entirely.
    room.gameState = next;
    expect(MysteryRoomEngine.handlePlayerAction(room, "p1", { type: "submitCode", code: "12" })).toBe(next);
    expect(MysteryRoomEngine.handlePlayerAction(room, "p1", { type: "submitCode", code: "abcd" })).toBe(next);
  });

  it("hints reveal one digit, cost time, and stop at the cap", () => {
    const room = testRoom("mysteryroom", 4) as unknown as Room<MysteryGameState>;
    const state = MysteryRoomEngine.createGame(room);
    room.gameState = { ...state, timeLeft: 120 };

    let next = MysteryRoomEngine.handlePlayerAction(room, "p1", { type: "requestHint" });
    expect(next.hintRevealed).toBe(1);
    expect(next.hintsUsed).toBe(1);
    expect(next.timeLeft).toBe(120 - HINT_TIME_PENALTY);
    expect(maskCode(next.correctCode, next.hintRevealed)).toBe(next.correctCode[0] + "•••");

    for (let i = 0; i < MAX_HINTS - 1; i++) {
      room.gameState = next;
      next = MysteryRoomEngine.handlePlayerAction(room, "p1", { type: "requestHint" });
    }
    expect(next.hintsUsed).toBe(MAX_HINTS);
    expect(next.timeLeft).toBe(120 - HINT_TIME_PENALTY * MAX_HINTS);

    room.gameState = next;
    expect(MysteryRoomEngine.handlePlayerAction(room, "p1", { type: "requestHint" })).toBe(next);
  });

  it("maskCode pads, caps and clamps safely", () => {
    expect(maskCode("1234", 0)).toBe("••••");
    expect(maskCode("1234", 4)).toBe("1234");
    expect(maskCode("1234", 99)).toBe("1234");
    expect(maskCode("1234", -2)).toBe("••••");
  });
});

describe("song3seconds: masked-lyric flash", () => {
  it("keeps the answer option honest and masks by difficulty", () => {
    for (const song of SONG_LIST) {
      expect(song.options).toContain(song.title);
      expect(new Set(song.options).size).toBe(song.options.length);
      expect(song.lyric.length).toBeGreaterThan(3);
    }
    const song = SONG_LIST[0];
    const letters = Array.from(song.lyric).length;
    expect(initialLyricRevealed(song, "easy")).toBeGreaterThan(initialLyricRevealed(song, "hard"));
    expect(initialLyricRevealed(song, "easy")).toBe(Math.max(1, Math.floor(letters * 0.4)));
    expect(initialLyricRevealed(song, "hard")).toBe(Math.max(1, Math.floor(letters * 0.15)));

    const mask = lyricMask(song, 2);
    expect(mask).toHaveLength(letters);
    expect(mask.slice(0, 2).every((m) => m.shown)).toBe(true);
    expect(mask.slice(2).every((m) => !m.shown)).toBe(true);
  });

  it("un-masks one lyric character every two seconds while answering", () => {
    const room = testRoom("song3seconds", 4) as unknown as Room<SongGameState>;
    const state = Song3SecondsEngine.createGame(room);
    room.gameState = { ...state, phase: "answering", timeLeft: 10, roundStartTime: Date.now() };
    const revealed0 = state.lyricRevealed;

    // 10 -> 9 (odd, no reveal) -> 8 (even, reveal)
    let next = Song3SecondsEngine.updateGameState(room);
    expect(next.timeLeft).toBe(9);
    expect(next.lyricRevealed).toBe(revealed0);
    room.gameState = next;
    next = Song3SecondsEngine.updateGameState(room);
    expect(next.timeLeft).toBe(8);
    expect(next.lyricRevealed).toBe(revealed0 + 1);

    // Reveals never overshoot the lyric length.
    const full = Array.from(state.currentSong.lyric).length;
    room.gameState = { ...next, lyricRevealed: full, timeLeft: 6 };
    next = Song3SecondsEngine.updateGameState(room);
    room.gameState = next;
    next = Song3SecondsEngine.updateGameState(room);
    expect(next.lyricRevealed).toBe(full);
  });

  it("plays the configured number of rounds", () => {
    const room = testRoom("song3seconds", 4) as unknown as Room<SongGameState>;
    room.settings.rounds = 2;
    const state = Song3SecondsEngine.createGame(room);
    expect(state.totalRounds).toBe(2);
    expect(state.totalRounds).toBeLessThanOrEqual(SONG_LIST.length);
  });
});

describe("kingtonight: batched tap-mash", () => {
  it("adds a batch of taps in one action", () => {
    const room = testRoom("kingtonight", 4) as unknown as Room<KingGameState>;
    const state = KingTonightEngine.createGame(room);
    room.gameState = { ...state, phase: "action" };

    const next = KingTonightEngine.handlePlayerAction(room, "p1", { type: "taps", count: 7 });
    expect(next.playerInputs["p1"]).toBe(7);

    room.gameState = next;
    const again = KingTonightEngine.handlePlayerAction(room, "p1", { type: "taps", count: 3 });
    expect(again.playerInputs["p1"]).toBe(10);
  });

  it("caps a batch and ignores garbage", () => {
    const room = testRoom("kingtonight", 4) as unknown as Room<KingGameState>;
    const state = KingTonightEngine.createGame(room);
    room.gameState = { ...state, phase: "action" };

    const next = KingTonightEngine.handlePlayerAction(room, "p1", { type: "taps", count: 999 });
    expect(next.playerInputs["p1"]).toBe(MAX_TAP_BATCH);

    room.gameState = next;
    expect(KingTonightEngine.handlePlayerAction(room, "p1", { type: "taps", count: -5 })).toBe(next);
    expect(KingTonightEngine.handlePlayerAction(room, "p1", { type: "taps", count: 1.5 })).toBe(next);
  });
});

describe("realbattle: body checks and the mega star", () => {
  function battleRoom(count = 4): Room<BattleGameState> {
    const room = testRoom(BATTLE_GAME_ID, count) as unknown as Room<BattleGameState>;
    room.gameState = RealBattleEngine.createGame(room);
    for (let i = 0; i < 3; i++) room.gameState = RealBattleEngine.updateGameState(room);
    return room;
  }

  it("knocks an opponent back on a body check without scoring", () => {
    const room = battleRoom();
    const state = room.gameState;
    // Park p2 8% ahead of p1 on the same row: p1's 6% step closes to 2%
    // (inside the bump radius) and rams p2 forward.
    const p1 = state.positions["p1"];
    state.positions["p2"] = { ...p1, x: p1.x + 8, y: p1.y, score: 0 };
    state.items = [];
    room.gameState = state;

    const next = RealBattleEngine.handlePlayerAction(room, "p1", { type: "move", dx: 1, dy: 0 });
    const p2 = next.positions["p2"];
    // p2 must end up shoved further right than its starting spot.
    expect(p2.x).toBeGreaterThan(p1.x + 8 + 1);
    expect(next.currentScores["p1"]).toBe(0);
    expect(next.currentScores["p2"]).toBe(0);
  });

  it("drops a 10-point mega star every 8 seconds and it can be collected", () => {
    const room = battleRoom();
    // Force the next tick to land on a mega-spawn second (timeLeft 9 -> 8).
    room.gameState = { ...room.gameState, timeLeft: 9, items: [] };
    const next = RealBattleEngine.updateGameState(room);
    expect(next.items).toHaveLength(1);
    const mega = next.items[0];
    expect(mega.type).toBe("mega");
    expect(mega.points).toBe(10);

    // Walk p1 straight onto it until the mega star itself is gone. (Other
    // items may respawn along the way; only p1 moves, so only p1 can take it.)
    room.gameState = next;
    let moved = next;
    for (let i = 0; i < 40 && moved.items.some((it) => it.id === mega.id); i++) {
      const pos = moved.positions["p1"];
      const dx = Math.sign(mega.x - pos.x) * (Math.abs(mega.x - pos.x) > 3 ? 1 : 0);
      const dy = Math.sign(mega.y - pos.y) * (Math.abs(mega.y - pos.y) > 3 ? 1 : 0);
      // Inside 3% on both axes means inside the 8% pickup radius: the
      // (0,0) move still runs the collision check and collects the star.
      moved = RealBattleEngine.handlePlayerAction(room, "p1", { type: "move", dx, dy });
      room.gameState = moved;
    }
    expect(moved.items.some((it) => it.id === mega.id)).toBe(false);
    expect(moved.currentScores["p1"]).toBeGreaterThanOrEqual(10);
  });
});

describe("fireworkmaster: design sanitizing", () => {
  it("clamps density and falls back for bad shapes/colors", () => {
    const good = sanitizeDesign({ color: "#123abc", shape: "heart", trailEffect: "smoke", density: 25 });
    expect(good).toEqual({ color: "#123abc", shape: "heart", trailEffect: "smoke", density: 25 });

    const clamped = sanitizeDesign({ color: "#123abc", shape: "star", trailEffect: "glitter", density: 999 });
    expect(clamped.density).toBe(80);

    // Deliberately invalid payload: the engine must fall back, not crash.
    const fallback = sanitizeDesign({ color: "notacolor", shape: "diamond", trailEffect: "laser", density: "loud" } as unknown as FireworkDesign);
    expect(fallback.shape).toBe("circle");
    expect(fallback.color).toBe("#ff007f");
    expect(fallback.trailEffect).toBe("sparkle");
    expect(fallback.density).toBe(30);

    const clampedLow = sanitizeDesign({ color: "#123abc", shape: "star", trailEffect: "glitter", density: -4 });
    expect(clampedLow.density).toBe(5);

    expect(sanitizeDesign(null).shape).toBe("circle");
  });

  it("stores sanitized designs on submit", () => {
    const room = testRoom("fireworkmaster", 4) as unknown as Room<
      Awaited<ReturnType<typeof FireworkMasterEngine.createGame>>
    >;
    room.gameState = FireworkMasterEngine.createGame(room);
    const next = FireworkMasterEngine.handlePlayerAction(room, "p1", {
      type: "submitDesign",
      design: { color: "banana", shape: "nope", trailEffect: "nope", density: 1000 },
    });
    expect(next.designs["p1"]).toEqual({ color: "#ff007f", shape: "circle", trailEffect: "sparkle", density: 80 });
  });
});
