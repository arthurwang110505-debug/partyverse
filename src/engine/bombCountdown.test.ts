import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BombEngine, generateChallenge, survivorIds, type BombGameState } from "./bombCountdown";
import { testRoom } from "@/test/fixtures";
import type { Room } from "@/types";

function activeRoom(count = 4): Room<BombGameState> {
  const room = testRoom("bombcountdown", count) as unknown as Room<BombGameState>;
  room.settings.timer = 10;
  room.gameState = BombEngine.createGame(room);
  for (let i = 0; i < 3; i++) room.gameState = BombEngine.updateGameState(room);
  return room;
}
function tick(room: Room<BombGameState>, count = 1) {
  for (let i = 0; i < count; i++) room.gameState = BombEngine.updateGameState(room);
  return room.gameState;
}
function answer(room: Room<BombGameState>, correct = true) {
  const state = room.gameState;
  const challenge = state.challenge!;
  return BombEngine.handlePlayerAction(room, state.bombHolderId, {
    type: "answer",
    challengeId: challenge.id,
    answer: correct ? challenge.correctAnswer : challenge.options.find((option) => option !== challenge.correctAnswer)!,
  });
}

beforeEach(() => vi.useFakeTimers().setSystemTime(100000));
afterEach(() => vi.useRealTimers());

describe("Bomb Countdown match rules", () => {
  it("briefs players before starting and never gives the display a turn", () => {
    const room = testRoom() as unknown as Room<BombGameState>;
    const state = BombEngine.createGame(room);
    expect(state.phase).toBe("briefing");
    expect(state.challenge).toBeNull();
    expect(state.currentScores).not.toHaveProperty("tv");
    const active = activeRoom().gameState;
    expect(active.phase).toBe("challenge");
    expect(active.bombHolderId).not.toBe("tv");
    expect(active.challenge?.targetPlayerId).toBe(active.bombHolderId);
  });
  it("only accepts a valid answer from the current holder for the current challenge", () => {
    const room = activeRoom();
    const initial = room.gameState;
    const act = { type: "answer", answer: initial.challenge!.correctAnswer, challengeId: initial.challenge!.id };
    const other = survivorIds(room).find((id) => id !== initial.bombHolderId)!;
    expect(BombEngine.handlePlayerAction(room, other, act)).toBe(initial);
    expect(BombEngine.handlePlayerAction(room, "tv", act)).toBe(initial);
    expect(BombEngine.handlePlayerAction(room, initial.bombHolderId, { ...act, challengeId: "old" })).toBe(initial);
    expect(BombEngine.handlePlayerAction(room, initial.bombHolderId, { ...act, answer: {} })).toBe(initial);
  });
  it("keeps the shared fuse running when passing and awards 10 points once", () => {
    const room = activeRoom();
    room.gameState.bombTimeLeft = 7;
    const holder = room.gameState.bombHolderId;
    const before = structuredClone(room.gameState);
    const next = answer(room);
    expect(next.bombTimeLeft).toBe(7);
    expect(next.bombHolderId).not.toBe(holder);
    expect(next.currentScores[holder]).toBe(10);
    expect(next.correctAnswers[holder]).toBe(1);
    expect(next.passes).toBe(1);
    expect(room.gameState).toEqual(before);
    room.gameState = next;
    expect(
      BombEngine.handlePlayerAction(room, holder, {
        type: "answer",
        answer: before.challenge!.correctAnswer,
        challengeId: before.challenge!.id,
      }),
    ).toBe(next);
  });
  it("penalizes a wrong answer and enforces a short retry cooldown", () => {
    const room = activeRoom();
    const holder = room.gameState.bombHolderId;
    room.gameState = answer(room, false);
    expect(room.gameState.bombTimeLeft).toBe(9);
    expect(room.gameState.bombHolderId).toBe(holder);
    expect(room.gameState.lastAnswer?.correct).toBe(false);
    expect(answer(room, false)).toBe(room.gameState);
    vi.advanceTimersByTime(500);
    expect(answer(room, false).bombTimeLeft).toBe(8);
  });
  it("ignores disconnected and eliminated recipients", () => {
    const room = activeRoom();
    const holder = room.gameState.bombHolderId;
    const others = survivorIds(room).filter((id) => id !== holder);
    room.players[others[0]].isConnected = false;
    room.gameState.eliminatedPlayers = [others[1]];
    expect(survivorIds(room, room.gameState.eliminatedPlayers).sort()).toEqual([holder, others[2]].sort());
    expect(answer(room).bombHolderId).toBe(others[2]);
  });
  it("ticks normally, then gives an explosion a visible pause", () => {
    const room = activeRoom();
    const holder = room.gameState.bombHolderId;
    expect(tick(room).bombTimeLeft).toBe(9);
    room.gameState.bombTimeLeft = 1;
    expect(tick(room).phase).toBe("exploded");
    expect(room.gameState.lastEliminatedId).toBe(holder);
    expect(room.gameState.eliminatedPlayers).toContain(holder);
    expect(room.gameState.bombTimeLeft).toBe(3);
    tick(room, 3);
    expect(room.gameState.phase).toBe("challenge");
    expect(room.gameState.bombHolderId).not.toBe(holder);
    expect(room.gameState.fuseDuration).toBeLessThan(10);
  });
  it("advances when the holder disconnects instead of waiting on a dead turn", () => {
    const room = activeRoom();
    room.players[room.gameState.bombHolderId].isConnected = false;
    expect(tick(room).phase).toBe("exploded");
  });
  it("awards the survivor once and restores everyone for the next configured round", () => {
    const room = activeRoom(2);
    const holder = room.gameState.bombHolderId;
    const survivor = survivorIds(room).find((id) => id !== holder)!;
    room.gameState.bombTimeLeft = 1;
    tick(room, 4);
    expect(room.gameState.phase).toBe("round_reveal");
    expect(room.gameState.currentScores[survivor]).toBe(50);
    expect(room.gameState.roundWins[survivor]).toBe(1);
    tick(room, 5);
    expect(room.gameState.phase).toBe("briefing");
    expect(room.gameState.currentRound).toBe(2);
    expect(room.gameState.eliminatedPlayers).toEqual([]);
    expect(room.gameState.currentScores[survivor]).toBe(50);
  });
  it("finishes only after the configured round count", () => {
    const room = activeRoom(2);
    room.gameState.totalRounds = 1;
    room.gameState.bombTimeLeft = 1;
    tick(room, 9);
    expect(room.gameState.phase).toBe("result");
    expect(room.gameState.winnerIds).toHaveLength(1);
    expect(BombEngine.endGame(room).winnerId).toBe(room.gameState.winnerId);
  });
  it("reports tied champions instead of breaking ties by player id", () => {
    const room = activeRoom();
    room.gameState.currentScores = { p1: 50, p2: 50, p3: 10, p4: 0 };
    expect(BombEngine.endGame(room).winnerIds).toEqual(["p1", "p2"]);
  });
  it("does not invent a survivor if everyone disconnected", () => {
    const room = activeRoom(2);
    Object.values(room.players).forEach((p) => {
      p.isConnected = false;
    });
    tick(room, 4);
    expect(room.gameState.roundWinnerId).toBeNull();
    expect(Object.values(room.gameState.currentScores)).toEqual([0, 0]);
  });
  it("difficulty changes the fuse and generates valid shuffled challenges", () => {
    const room = activeRoom();
    room.settings.difficulty = "hard";
    room.gameState = BombEngine.createGame(room);
    tick(room, 3);
    expect(room.gameState.fuseDuration).toBe(7);
    for (const difficulty of ["easy", "medium", "hard"]) {
      const challenge = generateChallenge("p1", difficulty, () => 0.7);
      expect(challenge.options).toContain(challenge.correctAnswer);
      expect(new Set(challenge.options).size).toBe(challenge.options.length);
      expect(challenge.targetPlayerId).toBe("p1");
    }
  });
});
