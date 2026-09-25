import { describe, expect, it, vi } from "vitest";
import type { Room } from "@/types";
import { testRoom } from "@/test/fixtures";
import { getGameEngine } from "./index";
import { mulberry32, seededShuffle, freshSeed } from "./rng";
import { SIMON_QUADRANTS, simonSequence, type SimonGameState } from "./simonSays";
import { isValidLink, normalizeWord, type ChainGameState } from "./wordChain";
import { SIT_SECONDS, type ChairsGameState } from "./musicalChairs";
import { generateSpawns, type MolesGameState } from "./whackMoles";

function playing<T>(id: string, count = 4): { room: Room<T>; state: T } {
  const engine = getGameEngine(id)!;
  const room = testRoom(id, count) as unknown as Room<T>;
  // Explicit host start: mechanics tests exercise the registered engine after onboarding.
  room.gameState = engine.createGame(room) as T;
  room.gameState = engine.handlePlayerAction(room, "tv", { type: "skipRules" }) as T;
  return { room, state: room.gameState };
}

function tick<T>(id: string, room: Room<T>, times: number): T {
  const engine = getGameEngine(id)!;
  let state = room.gameState as T;
  for (let i = 0; i < times; i++) {
    state = engine.updateGameState(room) as T;
    room.gameState = state;
  }
  return state;
}

describe("rng", () => {
  it("mulberry32 is deterministic and within [0,1)", () => {
    const a = mulberry32(1234);
    const b = mulberry32(1234);
    for (let i = 0; i < 50; i++) {
      const x = a();
      const y = b();
      expect(x).toBe(y);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it("seededShuffle is a permutation that respects the seed (in place)", () => {
    const items = [1, 2, 3, 4, 5, 6, 7];
    const shuffled = seededShuffle([...items], mulberry32(9));
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
    expect(seededShuffle([...items], mulberry32(9))).toEqual(shuffled);
    expect(seededShuffle([...items], mulberry32(10))).not.toEqual(shuffled);
  });

  it("freshSeed gives distinct integers", () => {
    const seeds = new Set(Array.from({ length: 20 }, () => freshSeed()));
    expect(seeds.size).toBe(20);
  });
});

describe("simonsays: sequence and taps", () => {
  it("simonSequence is deterministic, in range and prefix-stable", () => {
    const a = simonSequence(42, 5);
    const b = simonSequence(42, 8);
    expect(a).toEqual(b.slice(0, 5));
    for (const q of b) {
      expect(q).toBeGreaterThanOrEqual(0);
      expect(q).toBeLessThan(SIMON_QUADRANTS);
    }
    expect(simonSequence(7, 6)).not.toEqual(simonSequence(8, 6));
  });

  it("shows every element (including the last) before repeat", () => {
    const { room, state } = playing<SimonGameState>("simonsays");
    const lit: number[] = [];
    let s2 = state;
    while (s2.phase === "learning") {
      s2 = tick<SimonGameState>("simonsays", room, 1);
      if (s2.phase === "learning") lit.push(s2.learnIndex);
    }
    expect(lit).toEqual([1, 2, 3]);
  });

  it("a correct full sequence scores; a wrong one eliminates; others advance the level", () => {
    const { room, state } = playing<SimonGameState>("simonsays");
    const engine = getGameEngine("simonsays")!;
    const learning = tick<SimonGameState>("simonsays", room, (state.level ?? 3) + 1);
    expect(learning.phase).toBe("repeat");
    const seq = simonSequence(learning.seqSeed, learning.level);

    room.gameState = engine.handlePlayerAction(room, "p1", { type: "submitSequence", taps: seq });
    expect(room.gameState.playerProgress["p1"]).toBe(3);
    expect(room.gameState.currentScores["p1"]).toBe(3);
    // Duplicate submit is ignored (no double points, no elimination).
    room.gameState = engine.handlePlayerAction(room, "p1", { type: "submitSequence", taps: [0, 0, 0] });
    expect(room.gameState.outThisRound).not.toContain("p1");
    expect(room.gameState.currentScores["p1"]).toBe(3);

    const wrong = [...seq];
    wrong[2] = (wrong[2] + 1) % SIMON_QUADRANTS;
    room.gameState = engine.handlePlayerAction(room, "p2", { type: "submitSequence", taps: wrong });
    expect(room.gameState.outThisRound).toContain("p2");

    room.gameState = engine.handlePlayerAction(room, "p3", { type: "submitSequence", taps: seq });
    room.gameState = engine.handlePlayerAction(room, "p4", { type: "submitSequence", taps: seq });
    expect(room.gameState.phase).toBe("learning");
    expect(room.gameState.level).toBe(4);
  });
});

describe("wordchain: linking, objections and votes", () => {
  it("normalizes and validates links", () => {
    expect(normalizeWord("　你好 ")).toBe("你好");
    expect(isValidLink("愛你", "愛", [])).toBe(true);
    expect(isValidLink("我愛", "愛", [])).toBe(false); // wrong first character
    expect(isValidLink("愛", "愛", [])).toBe(false); // one character
    expect(isValidLink("愛你哦嗎呀", "愛", [])).toBe(false); // five characters
    expect(isValidLink("love", "l", [])).toBe(false); // not CJK
    expect(isValidLink("愛你", "愛", ["愛你"])).toBe(false); // repeated
  });

  it("a successful objection is voted down by the table, word stays", () => {
    const { room, state } = playing<ChainGameState>("wordchain");
    const engine = getGameEngine("wordchain")!;
    const link = state.requiredChar + "你";
    let next = engine.handlePlayerAction(room, "p1", { type: "submitWord", word: link });
    room.gameState = next;
    expect(next.pending?.word).toBe(link);
    expect(next.objectionWindow).toBeGreaterThan(0);

    // An invalid link is rejected without disturbing the pending word.
    next = engine.handlePlayerAction(room, "p2", { type: "submitWord", word: "錯" + state.requiredChar });
    room.gameState = next;
    expect(next.pending?.word).toBe(link);

    next = engine.handlePlayerAction(room, "p2", { type: "object" });
    room.gameState = next;
    expect(next.phase).toBe("voting");
    expect(next.objectors).toEqual(["p2"]);

    // The submitter cannot vote on their own word.
    next = engine.handlePlayerAction(room, "p1", { type: "voteWord", valid: false });
    expect(next.votes["p1"]).toBeUndefined();
    // The rest of the table votes valid -> the word stands; p1 keeps the +10.
    for (const id of ["p2", "p3", "p4"]) {
      next = engine.handlePlayerAction(room, id, { type: "voteWord", valid: true });
      room.gameState = next;
    }
    expect(next.phase).toBe("chaining");
    expect(next.headWord).toBe(link);
    expect(next.currentScores["p1"]).toBe(10);
  });

  it("an upheld objection punishes the submitter and rewards objectors", () => {
    const { room, state } = playing<ChainGameState>("wordchain");
    const engine = getGameEngine("wordchain")!;
    const link = state.requiredChar + "好";
    let next = engine.handlePlayerAction(room, "p1", { type: "submitWord", word: link });
    room.gameState = next;
    next = engine.handlePlayerAction(room, "p2", { type: "object" });
    room.gameState = next;
    expect(next.phase).toBe("voting");
    // Others can pile onto the objection while the vote is open.
    next = engine.handlePlayerAction(room, "p3", { type: "object" });
    room.gameState = next;
    expect(next.objectors).toEqual(["p2", "p3"]);

    // p2/p3/p4 (no self-vote; p1 is the submitter) vote invalid.
    next = engine.handlePlayerAction(room, "p2", { type: "voteWord", valid: false });
    room.gameState = next;
    next = engine.handlePlayerAction(room, "p3", { type: "voteWord", valid: false });
    room.gameState = next;
    next = engine.handlePlayerAction(room, "p4", { type: "voteWord", valid: false });
    room.gameState = next;
    expect(next.phase).toBe("chaining");
    expect(next.headWord).not.toBe(link); // the head word did not change
    expect(next.currentScores["p1"]).toBe(0); // penalty floors at zero
    expect(next.currentScores["p2"]).toBe(5);
    expect(next.currentScores["p3"]).toBe(5);
  });
});

describe("musicalchairs: seating and elimination", () => {
  it("the slowest sitter falls; scores accumulate to the final", () => {
    const { room, state } = playing<ChairsGameState>("musicalchairs", 4);
    const engine = getGameEngine("musicalchairs")!;
    expect(state.phase).toBe("briefing");
    expect(state.survivors).toEqual(["p1", "p2", "p3", "p4"]);

    // Briefing (3s) then the music runs a random 4-10s: tick until "sit".
    let next = tick<ChairsGameState>("musicalchairs", room, 3);
    let guard = 0;
    while (next.phase !== "sit" && guard++ < 15) {
      next = tick<ChairsGameState>("musicalchairs", room, 1);
    }
    expect(next.phase).toBe("sit");

    for (const id of ["p1", "p2", "p3", "p4"]) {
      next = engine.handlePlayerAction(room, id, { type: "sit" });
      room.gameState = next;
    }
    expect(next.phase).toBe("sit"); // resolved after the window closes
    next = tick<ChairsGameState>("musicalchairs", room, SIT_SECONDS);
    expect(next.phase).toBe("round_reveal");
    expect(next.roundEliminatedId).toBe("p4");
    expect(next.survivors).toEqual(["p1", "p2", "p3"]);
    expect(next.currentScores["p1"]).toBe(10);

    // Run the remaining two rounds with the same "everyone sits in seat
    // order" pattern so p1 reaches the final chair.
    for (const [expectedOut, nextPhase] of [
      ["p3", "round_reveal"],
      ["p2", "result"],
    ] as const) {
      let guard2 = 0;
      let s = tick<ChairsGameState>("musicalchairs", room, 3);
      while (s.phase !== "sit" && guard2++ < 15) s = tick<ChairsGameState>("musicalchairs", room, 1);
      for (const id of s.survivors) {
        s = engine.handlePlayerAction(room, id, { type: "sit" });
        room.gameState = s;
      }
      s = tick<ChairsGameState>("musicalchairs", room, SIT_SECONDS);
      room.gameState = s;
      expect(s.phase).toBe(nextPhase);
      expect(s.roundEliminatedId).toBe(expectedOut);
      if (nextPhase === "result") {
        expect(s.lastStandId).toBe("p1");
        expect(s.currentScores["p1"]).toBe(70); // +10, +10, +50
      }
    }
  });
});

describe("whackmoles: spawn schedule and whacks", () => {
  it("generateSpawns covers the round with valid, hittable windows", () => {
    vi.useFakeTimers().setSystemTime(1_000_000_000_000);
    try {
      const spawns = generateSpawns(1_000_000_000_000, 1, 20);
      expect(spawns.length).toBeGreaterThan(8);
      for (const s of spawns) {
        expect(s.cell).toBeGreaterThanOrEqual(0);
        expect(s.cell).toBeLessThan(9);
        expect(s.startAt).toBeGreaterThanOrEqual(1_000_000_000_000);
        expect(s.endAt - s.startAt).toBeGreaterThan(300);
        expect(s.endAt).toBeLessThan(1_000_000_000_000 + 20_000);
        expect(s.hitBy).toBeUndefined();
      }
      // Windows never overlap so a tap always means exactly one mole.
      const sorted = [...spawns].sort((a, b) => a.startAt - b.startAt);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].startAt).toBeGreaterThanOrEqual(sorted[i - 1].endAt);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("whacking an active mole scores; empty whacks are missed", () => {
    vi.useFakeTimers().setSystemTime(2_000_000_000_000);
    try {
      const { room } = playing<MolesGameState>("whackmoles", 4);
      const engine = getGameEngine("whackmoles")!;
      // intro (2s) -> hunting, with the spawn schedule stamped at t0.
      let next = tick<MolesGameState>("whackmoles", room, 3);
      expect(next.phase).toBe("hunting");
      // Advance the (frozen) wall clock 1.2s in: the first spawn window
      // (t0+0.8s .. t0+1.75s) is live now.
      vi.advanceTimersByTime(2200);
      const now = Date.now();
      const active = next.spawns.find((s) => now >= s.startAt && now < s.endAt);
      expect(active).toBeDefined();
      next = engine.handlePlayerAction(room, "p1", { type: "whack", cell: active!.cell });
      room.gameState = next;
      expect(next.hits["p1"]).toBe(1);
      expect(next.totalHits["p1"]).toBe(1);
      const hit = next.spawns.find((s) => s.cell === active!.cell)!;
      expect(hit.hitBy).toBe("p1");
      // A second whack on the same mole is a no-op.
      next = engine.handlePlayerAction(room, "p2", { type: "whack", cell: active!.cell });
      room.gameState = next;
      expect(next.hits["p1"]).toBe(1);
      // Empty whack (a cell with no live mole at this instant).
      const emptyCell = [0, 1, 2, 3, 4, 5, 6, 7, 8].find(
        (c) => !next.spawns.some((s) => s.cell === c && now >= s.startAt - 500 && now < s.endAt + 500),
      )!;
      next = engine.handlePlayerAction(room, "p3", { type: "whack", cell: emptyCell });
      room.gameState = next;
      expect(next.misses["p3"]).toBe(1);
      expect(next.streaks["p3"]).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
