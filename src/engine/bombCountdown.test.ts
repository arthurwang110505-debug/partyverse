import { describe, expect, it } from "vitest";
import {
  BombEngine,
  generateChallenge,
  survivorIds,
  type BombGameState,
} from "./bombCountdown";
import type { Room } from "@/types";

function mockRoom(playersCount = 3): Room<BombGameState> {
  const players: Room["players"] = {};
  for (let i = 1; i <= playersCount; i++) {
    players[`p${i}`] = {
      id: `p${i}`,
      nickname: `Player ${i}`,
      avatar: "🦊",
      isHost: i === 1,
      isConnected: true,
      score: 0,
    };
  }

  return {
    id: "TEST1",
    gameId: "bombcountdown",
    hostPlayerId: "p1",
    status: "PLAYING",
    createdAt: Date.now(),
    settings: {
      timer: 10,
      difficulty: "easy",
      rounds: 3,
      soundEnabled: true,
      ageMode: "family",
    },
    players,
    gameState: {} as BombGameState,
  };
}

describe("BombCountdown Engine", () => {
  it("initializes a valid game state with a chosen bomb holder", () => {
    const room = mockRoom(3);
    const state = BombEngine.createGame(room);

    expect(state.phase).toBe("challenge");
    expect(["p1", "p2", "p3"]).toContain(state.bombHolderId);
    expect(state.bombTimeLeft).toBe(10);
    expect(state.challenge).not.toBeNull();
    expect(state.challenge?.targetPlayerId).toBe(state.bombHolderId);
    expect(state.eliminatedPlayers).toEqual([]);
    expect(state.currentScores).toEqual({ p1: 0, p2: 0, p3: 0 });
  });

  it("ignores answers from players who are not holding the bomb", () => {
    const room = mockRoom(3);
    const initial = BombEngine.createGame(room);
    room.gameState = initial;

    const nonHolder = ["p1", "p2", "p3"].find((id) => id !== initial.bombHolderId)!;
    const next = BombEngine.handlePlayerAction(room, nonHolder, {
      type: "answer",
      answer: initial.challenge!.correctAnswer,
    });

    expect(next).toBe(initial);
  });

  it("does not pass bomb on wrong answer", () => {
    const room = mockRoom(3);
    const initial = BombEngine.createGame(room);
    room.gameState = initial;

    const holder = initial.bombHolderId;
    const wrongAnswer = "definitely-wrong-answer";
    const next = BombEngine.handlePlayerAction(room, holder, {
      type: "answer",
      answer: wrongAnswer,
    });

    expect(next.bombHolderId).toBe(holder);
    expect(next.currentScores[holder]).toBe(0);
  });

  it("passes bomb and adds points on correct answer", () => {
    const room = mockRoom(3);
    const initial = BombEngine.createGame(room);
    room.gameState = initial;

    const holder = initial.bombHolderId;
    const next = BombEngine.handlePlayerAction(room, holder, {
      type: "answer",
      answer: initial.challenge!.correctAnswer,
    });

    expect(next.currentScores[holder]).toBe(10);
    expect(next.correctAnswers[holder]).toBe(1);
    expect(["p1", "p2", "p3"]).toContain(next.bombHolderId);
    expect(next.challenge?.targetPlayerId).toBe(next.bombHolderId);
  });

  it("decrements time on normal tick", () => {
    const room = mockRoom(3);
    const initial = BombEngine.createGame(room);
    initial.bombTimeLeft = 8;
    room.gameState = initial;

    const next = BombEngine.updateGameState(room);
    expect(next.bombTimeLeft).toBe(7);
    expect(next.phase).toBe("challenge");
  });

  it("eliminates bomb holder when timer hits 0", () => {
    const room = mockRoom(3);
    const initial = BombEngine.createGame(room);
    initial.bombTimeLeft = 1;
    const currentHolder = initial.bombHolderId;
    room.gameState = initial;

    const next = BombEngine.updateGameState(room);
    expect(next.eliminatedPlayers).toContain(currentHolder);
    expect(next.lastEliminatedId).toBe(currentHolder);
    // 2 survivors remain, so still playing
    expect(next.phase).toBe("challenge");
    expect(next.bombHolderId).not.toBe(currentHolder);
  });

  it("ends the game when only one player survives", () => {
    const room = mockRoom(2);
    const initial = BombEngine.createGame(room);
    initial.bombTimeLeft = 1;
    const currentHolder = initial.bombHolderId;
    const otherPlayer = currentHolder === "p1" ? "p2" : "p1";
    room.gameState = initial;

    const next = BombEngine.updateGameState(room);
    expect(next.phase).toBe("result");
    expect(next.winnerId).toBe(otherPlayer);
    expect(next.currentScores[otherPlayer]).toBe(50);
  });

  it("generates valid challenges with all required fields", () => {
    const challenge = generateChallenge("p1", "easy");
    expect(challenge.targetPlayerId).toBe("p1");
    expect(challenge.options).toContain(challenge.correctAnswer);
    expect(challenge.options.length).toBeGreaterThanOrEqual(1);
    expect(challenge.timeLimit).toBeGreaterThan(0);
  });

  it("correctly identifies survivors", () => {
    const room = mockRoom(3);
    expect(survivorIds(room, ["p1"])).toEqual(["p2", "p3"]);
    expect(survivorIds(room, ["p1", "p2"])).toEqual(["p3"]);
  });

  it("produces valid summary and achievements on endGame", () => {
    const room = mockRoom(2);
    const state = BombEngine.createGame(room);
    state.currentScores = { p1: 50, p2: 10 };
    state.winnerId = "p1";
    room.gameState = state;

    const summary = BombEngine.endGame(room);
    expect(summary.winnerId).toBe("p1");
    expect(summary.scores).toEqual({ p1: 50, p2: 10 });
    expect(summary.achievements.some((a) => a.id === "survivor")).toBe(true);
  });
});
