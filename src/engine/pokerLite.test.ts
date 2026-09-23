import { describe, expect, it } from "vitest";
import { PokerLiteEngine as engine, canRaise, showdown, type PokerGameState } from "./pokerLite";
import { engineRoom } from "./participants";
import { testRoom, startPlayingRoom } from "@/test/fixtures";
import { actionContextKey, advanceRoomGame, applyRoomAction } from "@/lib/gameSession";
import type { Room } from "@/types";

function roomWith(count = 4): Room<PokerGameState> {
  const room = engineRoom(testRoom("pokerlite", count)) as unknown as Room<PokerGameState>;
  room.gameState = engine.createGame(room);
  room.gameState.phase = "betting";
  return room;
}
function action(room: Room<PokerGameState>, id: string, value: unknown) {
  room.gameState = engine.handlePlayerAction(room, id, value);
  return room.gameState;
}
function total(s: PokerGameState) {
  return Object.values(s.chips).reduce((a, b) => a + b, 0) + s.pot;
}
function river(): Room<PokerGameState> {
  const room = roomWith();
  Object.assign(room.gameState, {
    street: "river",
    board: ["A♠", "K♥", "Q♦", "7♣", "2♠"],
    holeCards: { p1: ["J♥", "10♥"], p2: ["A♦", "A♣"], p3: ["K♦", "K♣"], p4: ["Q♠", "Q♥"] },
    chips: { p1: 90, p2: 80, p3: 60, p4: 60 },
    committed: { p1: 10, p2: 20, p3: 40, p4: 40 },
    pot: 110,
    activePlayers: ["p1", "p3", "p4"],
    foldedIds: ["p2"],
  });
  return room;
}

describe("poker fairness", () => {
  it("posts blinds as the opening bet and forbids checking when chips are owed", () => {
    const room = roomWith();
    expect(room.gameState.toAct).toBe("p4");
    expect(room.gameState.currentBet).toBe(2);
    expect(room.gameState.toCall).toEqual({ p1: 2, p2: 1, p3: 0, p4: 2 });
    const original = room.gameState;
    expect(action(room, "p4", { type: "check" })).toBe(original);
    expect(total(original)).toBe(400);
  });

  it("uses small-blind dealer heads-up and big blind first after the flop", () => {
    const room = roomWith(2);
    expect(room.gameState.committed).toEqual({ p1: 1, p2: 2 });
    expect(room.gameState.toAct).toBe("p1");
    action(room, "p1", { type: "call" });
    action(room, "p2", { type: "check" });
    expect(room.gameState.street).toBe("flop");
    expect(room.gameState.toAct).toBe("p2");
    expect(total(room.gameState)).toBe(200);
  });

  it("continues clockwise from a folded seat rather than restarting at seat zero", () => {
    const room = roomWith();
    action(room, "p4", { type: "call" });
    action(room, "p1", { type: "call" });
    action(room, "p2", { type: "fold" });
    expect(room.gameState.toAct).toBe("p3");
    action(room, "p3", { type: "check" });
    expect(room.gameState.street).toBe("flop");
    expect(room.gameState.toAct).toBe("p3");
  });

  it("counts folded contributions in every side-pot layer", () => {
    const room = river();
    const before = total(room.gameState);
    const out = showdown(room.gameState, room);
    expect(out.potSplit).toEqual({ p1: 40, p3: 70 });
    expect(total(out)).toBe(before);
    expect(out.chips.p2).toBe(80);
    expect(out.handWinnerIds).not.toContain("p2");
    expect(showdown(out, room).chips).toEqual(out.chips); // cannot pay twice
  });

  it("returns unmatched excess instead of giving it to a shorter stack", () => {
    const room = river();
    room.gameState.committed = { p1: 10, p2: 20, p3: 40, p4: 80 };
    room.gameState.chips.p4 = 20;
    room.gameState.pot = 150;
    const out = showdown(room.gameState, room);
    expect(out.potSplit).toEqual({ p1: 40, p3: 70, p4: 40 });
    expect(total(out)).toBe(400);
  });

  it("splits tied pots without losing odd chips", () => {
    const room = river();
    room.gameState.board = ["A♠", "K♠", "Q♠", "J♠", "10♠"];
    room.gameState.committed = { p1: 5, p2: 5, p3: 5, p4: 0 };
    room.gameState.chips = { p1: 95, p2: 95, p3: 95, p4: 100 };
    room.gameState.pot = 15;
    room.gameState.activePlayers = ["p1", "p3"];
    const out = showdown(room.gameState, room);
    expect(Object.values(out.potSplit).sort()).toEqual([7, 8]);
    expect(total(out)).toBe(400);
  });

  it("caps a short all-in at the actual stack and still asks opponents to call", () => {
    const room = roomWith();
    room.gameState.chips.p4 = 3;
    const before = total(room.gameState);
    action(room, "p4", { type: "raise", to: 999 });
    expect(room.gameState.currentBet).toBe(3);
    expect(room.gameState.chips.p4).toBe(0);
    expect(room.gameState.committed.p4).toBe(3);
    expect(room.gameState.toCall.p1).toBe(3);
    expect(total(room.gameState)).toBe(before);
  });

  it("treats a short all-in below the bet as a call, without lowering the bet", () => {
    const room = roomWith();
    room.gameState.chips.p4 = 1;
    const before = total(room.gameState);
    action(room, "p4", { type: "raise", to: 100 });
    expect(room.gameState.currentBet).toBe(2);
    expect(room.gameState.committed.p4).toBe(1);
    expect(total(room.gameState)).toBe(before);
  });

  it("does not reopen raising after a short all-in for someone who already acted", () => {
    const room = roomWith();
    action(room, "p4", { type: "call" });
    room.gameState.chips.p1 = 3;
    action(room, "p1", { type: "raise", to: 3 });
    action(room, "p2", { type: "call" });
    action(room, "p3", { type: "call" });
    expect(room.gameState.toAct).toBe("p4");
    expect(room.gameState.toCall.p4).toBe(1);
    expect(canRaise(room.gameState, "p4")).toBe(false);
    const original = room.gameState;
    expect(action(room, "p4", { type: "raise", to: 8 })).toBe(original);
    action(room, "p4", { type: "call" });
    expect(room.gameState.street).toBe("flop");
  });

  it("uses the last full raise size and rejects malformed or undersized raises", () => {
    const room = roomWith();
    action(room, "p4", { type: "raise", to: 10 });
    expect(room.gameState.lastFullRaise).toBe(8);
    const original = room.gameState;
    for (const to of [NaN, Infinity, -1, 12, "18"]) {
      expect(action(room, "p1", { type: "raise", to })).toBe(original);
    }
    action(room, "p1", { type: "raise", to: 18 });
    expect(room.gameState.currentBet).toBe(18);
    expect(total(room.gameState)).toBe(400);
  });

  it("checks or folds on timeout instead of spending chips", () => {
    const room = roomWith();
    room.gameState.timeLeft = 0;
    const before = room.gameState.chips.p4;
    room.gameState = engine.updateGameState(room);
    expect(room.gameState.foldedIds).toContain("p4");
    expect(room.gameState.chips.p4).toBe(before);
  });

  it("runs out the board when everyone is all-in", () => {
    const room = roomWith(3);
    for (const id of ["p1", "p2", "p3"]) action(room, id, { type: "raise", to: 100 });
    expect(room.gameState.phase).toBe("showdown");
    expect(room.gameState.board).toHaveLength(5);
    expect(total(room.gameState)).toBe(300);
  });

  it("resets the next decision deadline and rejects delayed actions from an old decision", () => {
    let room = startPlayingRoom(testRoom("pokerlite"), 100000);
    room = advanceRoomGame(room, 104000);
    const expected = {
      gameId: room.gameId,
      phase: room.gameState.phase,
      round: room.gameState.currentRound,
      startedAt: room.startedAt,
      contextKey: actionContextKey(room.gameState),
    };
    room = applyRoomAction(room, "p4", { type: "call" }, expected, 114000);
    expect(room.gameState.toAct).toBe("p1");
    expect(room.gameState.phaseEndsAt).toBe(129000);
    const stale = applyRoomAction(room, "p1", { type: "call" }, expected, 114000);
    expect(stale.gameState.toAct).toBe("p1");
    expect(stale.gameState.pot).toBe(room.gameState.pot);
  });

  it("conserves chips throughout generated legal hands", () => {
    for (let run = 0; run < 25; run++) {
      const room = roomWith(4);
      for (let decision = 0; decision < 100 && room.gameState.phase === "betting"; decision++) {
        const state = room.gameState;
        const id = state.toAct!;
        const value =
          decision % 7 === 0 && canRaise(state, id)
            ? { type: "raise", to: state.currentBet + (state.lastFullRaise ?? 2) }
            : (state.toCall[id] ?? 0) > 0
              ? { type: "call" }
              : { type: "check" };
        action(room, id, value);
        expect(total(room.gameState)).toBe(400);
        expect(Object.values(room.gameState.chips).every((n) => Number.isInteger(n) && n >= 0)).toBe(true);
      }
      expect(room.gameState.phase).toBe("showdown");
    }
  });
});
