import { describe, expect, it, vi } from "vitest";
import type { Room } from "@/types";
import { testRoom } from "@/test/fixtures";
import { getGameEngine } from "./index";
import { mulberry32, seededShuffle, freshSeed } from "./rng";
import { cardValue, compareRank, handName, bestOf7, showdown, type PokerGameState } from "./pokerLite";
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

describe("pokerlite: evaluator", () => {
  it('parses ranks and suits (cards are "10♥"-style rank+suit strings)', () => {
    expect(cardValue("A♠")).toBe(14);
    expect(cardValue("K♦")).toBe(13);
    expect(cardValue("10♥")).toBe(10);
    expect(cardValue("2♣")).toBe(2);
  });

  it("picks the stronger straight when 7 cards contain two", () => {
    // Values 4-5-6-7-8-9 form both a 4-high and a 9-high straight.
    const hand = bestOf7(["4♠", "5♥", "6♦", "7♣", "8♠", "9♥", "K♦"]);
    expect(hand).toEqual([4, 9, 0, 0, 0, 0]);
  });

  it("ranks hands in the correct order", () => {
    const royal = bestOf7(["A♠", "K♠", "Q♠", "J♠", "10♠", "9♥", "2♦"]);
    const fourOfAKind = bestOf7(["A♠", "A♥", "A♦", "A♣", "K♠", "9♥", "2♦"]);
    const fullHouse = bestOf7(["A♠", "A♥", "A♦", "K♣", "K♦", "9♥", "2♦"]);
    const flush = bestOf7(["A♠", "J♠", "9♠", "7♠", "3♠", "2♥", "2♦"]);
    const straight = bestOf7(["5♠", "6♥", "7♦", "8♣", "9♠", "2♥", "K♦"]);
    const trips = bestOf7(["7♠", "7♥", "7♦", "K♣", "Q♦", "9♥", "2♦"]);

    expect(compareRank(royal, fourOfAKind)).toBeLessThan(0);
    expect(compareRank(fourOfAKind, fullHouse)).toBeLessThan(0);
    expect(compareRank(fullHouse, flush)).toBeLessThan(0);
    expect(compareRank(flush, straight)).toBeLessThan(0);
    expect(compareRank(straight, trips)).toBeLessThan(0);

    expect(handName(royal)).toContain("同花順");
    expect(handName(fourOfAKind)).toContain("四條");
    expect(handName(fullHouse)).toContain("葫蘆");
    expect(handName(flush)).toContain("同花");
    expect(handName(straight)).toContain("順子");
    expect(handName(trips)).toContain("三條");
  });

  it("wheel straight: A-2-3-4-5 plays as an ace-low straight", () => {
    const wheel = bestOf7(["A♠", "2♥", "3♦", "4♣", "5♠", "9♥", "K♦"]);
    expect(handName(wheel)).toContain("順子");
    // The wheel loses to any other straight.
    const higher = bestOf7(["2♠", "3♥", "4♦", "5♣", "6♠", "9♥", "K♦"]);
    expect(compareRank(higher, wheel)).toBeLessThan(0);
  });

  it("kickers and pair structure decide ties", () => {
    const aaKQJ = bestOf7(["A♠", "A♥", "K♠", "Q♥", "J♦", "9♣", "8♦"]);
    const aaKQ9 = bestOf7(["A♠", "A♥", "K♠", "Q♥", "9♦", "8♣", "7♦"]);
    const kk = bestOf7(["K♠", "K♥", "A♠", "Q♥", "J♦", "9♣", "8♦"]);
    expect(compareRank(aaKQJ, aaKQ9)).toBeLessThan(0);
    expect(compareRank(aaKQ9, kk)).toBeLessThan(0);

    const twoPairTop = bestOf7(["A♠", "A♥", "9♠", "9♥", "K♦", "5♣", "8♦"]);
    const twoPairSecond = bestOf7(["A♠", "A♥", "8♠", "8♥", "K♦", "5♣", "9♦"]);
    expect(compareRank(twoPairTop, twoPairSecond)).toBeLessThan(0);
  });

  it("splits the exact pot with proper side pots", () => {
    // The board is mixed (no straight, no flush on its own): p1's J-10
    // makes an ace-high straight and wins the 40-chip main pot even though
    // p1 only committed 10. p3 and p4 committed 40, so their 60-chip side
    // pot is settled between them: p3's three kings beat p4's three queens.
    // p2's three aces cannot reach the side pot (only committed 10).
    const state: PokerGameState = {
      phase: "betting",
      street: "river",
      timeLeft: 0,
      handNumber: 1,
      totalHands: 1,
      seats: ["p1", "p2", "p3", "p4"],
      deck: [],
      holeCards: {
        p1: ["J♥", "10♥"],
        p2: ["A♦", "A♣"],
        p3: ["K♦", "K♣"],
        p4: ["Q♠", "Q♥"],
      },
      board: ["A♠", "K♥", "Q♦", "7♣", "2♠"],
      chips: { p1: 0, p2: 0, p3: 0, p4: 0 },
      committed: { p1: 10, p2: 10, p3: 40, p4: 40 },
      streetCommitted: {},
      toCall: {},
      currentBet: 0,
      pot: 100,
      activePlayers: ["p1", "p2", "p3", "p4"],
      foldedIds: [],
      allInIds: ["p1", "p2", "p3", "p4"],
      toAct: null,
      lastRaiserId: null,
      streetActed: {},
      dealerSeat: "p1",
      showdownHands: {},
      handWinnerIds: [],
      potSplit: {},
      currentScores: { p1: 0, p2: 0, p3: 0, p4: 0 },
      winnerId: null,
      winnerIds: [],
    };
    const out = showdown(state, testRoom("pokerlite") as unknown as Room<PokerGameState>);
    expect(out.pot).toBe(0);
    expect(out.potSplit).toEqual({ p1: 40, p3: 60 });
    expect(out.chips).toEqual({ p1: 40, p2: 0, p3: 60, p4: 0 });
    expect(out.handWinnerIds).toEqual(["p1", "p3"]);
    expect(out.currentScores["p3"]).toBe(60);
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

  it("correct taps score, a wrong tap eliminates for the round", () => {
    const { room, state } = playing<SimonGameState>("simonsays");
    // Burn through the learning phase for the starting level (3 seconds).
    const learning = tick<SimonGameState>("simonsays", room, state.level ?? 3);
    expect(learning.phase).toBe("repeat");
    const seq = simonSequence(learning.seqSeed, learning.level);

    const ok1 = getGameEngine("simonsays")!.handlePlayerAction(room, "p1", { type: "tap", quadrant: seq[0] });
    room.gameState = ok1;
    const ok2 = getGameEngine("simonsays")!.handlePlayerAction(room, "p1", {
      type: "tap",
      quadrant: seq[1],
    });
    room.gameState = ok2;

    expect(ok2.playerProgress["p1"]).toBe(2);
    expect(ok2.outThisRound).not.toContain("p1");

    const wrong = getGameEngine("simonsays")!.handlePlayerAction(room, "p1", {
      type: "tap",
      quadrant: (seq[2] + 1) % SIMON_QUADRANTS,
    });
    room.gameState = wrong;
    expect(wrong.outThisRound).toContain("p1");
    // An eliminated player cannot keep tapping.
    const after = getGameEngine("simonsays")!.handlePlayerAction(room, "p1", { type: "tap", quadrant: 0 });
    expect(after.playerProgress["p1"]).toBe(2);
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
        expect(s.hitBy).toEqual([]);
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
      let next = tick<MolesGameState>("whackmoles", room, 2);
      expect(next.phase).toBe("hunting");
      // Advance the (frozen) wall clock 1.2s in: the first spawn window
      // (t0+0.8s .. t0+1.75s) is live now.
      vi.advanceTimersByTime(1200);
      const now = Date.now();
      const active = next.spawns.find((s) => now >= s.startAt && now < s.endAt);
      expect(active).toBeDefined();
      next = engine.handlePlayerAction(room, "p1", { type: "whack", cell: active!.cell });
      room.gameState = next;
      expect(next.hits["p1"]).toBe(1);
      expect(next.totalHits["p1"]).toBe(1);
      const hit = next.spawns.find((s) => s.cell === active!.cell)!;
      expect(hit.hitBy).toEqual(["p1"]);
      // A second whack on the same mole is a no-op.
      next = engine.handlePlayerAction(room, "p2", { type: "whack", cell: active!.cell });
      room.gameState = next;
      expect(next.hits["p1"]).toBe(1);
      // Empty whack (a cell with no live mole at this instant).
      const emptyCell = [0, 1, 2, 3, 4, 5, 6, 7, 8].find(
        (c) => !next.spawns.some((s) => s.cell === c && now >= s.startAt && now < s.endAt && s.hitBy.length === 0),
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
