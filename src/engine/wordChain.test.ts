import { describe, expect, it } from "vitest";
import { WordChainEngine as engine, requiredLinkChar, type ChainGameState } from "./wordChain";
import { engineRoom } from "./participants";
import { databaseRoundTrip, startPlayingRoom, testRoom } from "@/test/fixtures";
import { advanceRoomGame, applyRoomAction } from "@/lib/gameSession";
import type { Room } from "@/types";

function roomWith(): Room<ChainGameState> {
  const room = engineRoom(testRoom("wordchain")) as unknown as Room<ChainGameState>;
  room.gameState = { ...engine.createGame(room), headWord: "開心", requiredChar: "心", chain: ["開心"] };
  return room;
}
function act(room: Room<ChainGameState>, id: string, value: unknown) {
  room.gameState = engine.handlePlayerAction(room, id, value);
  return room.gameState;
}

describe("word chain fairness and pacing", () => {
  it("links to the pending word, not the stale confirmed head", () => {
    const room = roomWith();
    act(room, "p1", { type: "submitWord", word: "心情" });
    expect(requiredLinkChar(room.gameState)).toBe("情");
    const original = room.gameState;
    expect(act(room, "p2", { type: "submitWord", word: "心中" })).toBe(original);
    act(room, "p2", { type: "submitWord", word: "情況" });
    expect(room.gameState.headWord).toBe("心情");
    expect(room.gameState.pending?.word).toBe("情況");
    expect(room.gameState.currentScores.p1).toBe(10);
    expect(requiredLinkChar(room.gameState)).toBe("況");
  });

  it("adding an objector preserves votes, the vote timer, and the saved round time", () => {
    const room = roomWith();
    act(room, "p1", { type: "submitWord", word: "心情" });
    act(room, "p2", { type: "object" });
    act(room, "p2", { type: "voteWord", valid: false });
    room.gameState = engine.updateGameState(room);
    act(room, "p3", { type: "object" });
    expect(room.gameState.votes).toEqual({ p2: false });
    expect(room.gameState.timeLeft).toBe(3);
    expect(room.gameState.roundTimeLeft).toBe(20);
    expect(room.gameState.objectors).toEqual(["p2", "p3"]);
  });

  it("rejects malformed and duplicate votes, resumes the saved clock, removes an invalid word", () => {
    const room = roomWith();
    room.gameState.timeLeft = 7;
    act(room, "p1", { type: "submitWord", word: "心情" });
    act(room, "p2", { type: "object" });
    act(room, "p2", { type: "voteWord", valid: "false" });
    expect(room.gameState.votes).toEqual({});
    act(room, "p2", { type: "voteWord", valid: false });
    act(room, "p2", { type: "voteWord", valid: true });
    expect(room.gameState.votes.p2).toBe(false);
    for (const id of ["p3", "p4"]) act(room, id, { type: "voteWord", valid: false });
    expect(room.gameState.phase).toBe("chaining");
    expect(room.gameState.timeLeft).toBe(7);
    expect(room.gameState.chain).toEqual(["開心"]);
    expect(room.gameState.requiredChar).toBe("心");
    expect(room.gameState.currentScores).toMatchObject({ p1: 0, p2: 5 });
    expect(room.gameState.feedback).toContain("無效");
  });

  it("does not wait for a disconnected voter and treats a tie as valid", () => {
    const room = roomWith();
    act(room, "p1", { type: "submitWord", word: "心情" });
    act(room, "p2", { type: "object" });
    act(room, "p2", { type: "voteWord", valid: true });
    act(room, "p3", { type: "voteWord", valid: false });
    room.players.p4.isConnected = false;
    room.gameState = engine.updateGameState(room);
    expect(room.gameState.phase).toBe("chaining");
    expect(room.gameState.headWord).toBe("心情");
    expect(room.gameState.currentScores.p1).toBe(10);
    expect(room.gameState.feedback).toContain("確認有效");
  });

  it("ends empty and already-confirmed rounds at their deadline", () => {
    for (const withWord of [false, true]) {
      const room = roomWith();
      if (withWord) {
        act(room, "p1", { type: "submitWord", word: "心情" });
        for (let i = 0; i < 5; i++) room.gameState = engine.updateGameState(room);
        expect(room.gameState.pending).toBeNull();
      }
      room.gameState.timeLeft = 1;
      room.gameState = engine.updateGameState(room);
      expect(room.gameState.phase).toBe("round_reveal");
      expect(room.gameState.currentScores.p1).toBe(withWord ? 10 : 0);
    }
  });

  it("finishes an entirely idle match through real deadline advancement", () => {
    const base = testRoom("wordchain");
    base.settings.rounds = 2;
    let room = startPlayingRoom(base, 100000);
    for (let now = 101000; now <= 150000 && room.status !== "RESULTS"; now += 1000) {
      room = advanceRoomGame(databaseRoundTrip(room), now);
    }
    expect(room.status).toBe("RESULTS");
    expect(room.gameState.winnerIds).toEqual([]);
  });

  it("duplicate host ticks and invalid actions do not consume objection time", () => {
    let room = startPlayingRoom(testRoom("wordchain"), 100000);
    room.gameState.headWord = "開心";
    room.gameState.requiredChar = "心";
    room.gameState.chain = ["開心"];
    const expected = () => ({
      gameId: room.gameId,
      phase: room.gameState.phase,
      round: room.gameState.currentRound,
      startedAt: room.startedAt,
    });
    room = applyRoomAction(room, "p1", { type: "submitWord", word: "心情" }, expected(), 100000);
    for (let i = 0; i < 20; i++) {
      room = advanceRoomGame(room, 100000);
      room = applyRoomAction(room, "p2", { type: "submitWord", word: "wrong" }, expected(), 100000);
    }
    expect(room.gameState.objectionWindow).toBe(5);
    expect(room.gameState.currentScores).toMatchObject({ p1: 0 });
    room = advanceRoomGame(room, 104000);
    expect(room.gameState.objectionWindow).toBe(1);
    room = advanceRoomGame(room, 105000);
    expect(room.gameState.currentScores).toMatchObject({ p1: 10 });
    room = advanceRoomGame(room, 105000);
    expect(room.gameState.currentScores).toMatchObject({ p1: 10 });
  });
});
