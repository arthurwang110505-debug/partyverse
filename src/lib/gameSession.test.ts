import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playableGameIds, getGameEngine } from "@/engine";
import { participantIds } from "@/engine/participants";
import { normalizeSettings } from "@/constants/gameSettings";
import { databaseRoundTrip, testRoom, startPlayingRoom } from "@/test/fixtures";
import { parseRoom } from "./roomData";
import { advanceRoomGame, applyRoomAction, endRoomGame, returnRoomToLobby, type ActionPhase } from "./gameSession";
import type { Room } from "@/types";

const NOW = 100000;
const phase = (room: Room): ActionPhase => ({
  gameId: room.gameId,
  phase: room.gameState.phase,
  round: room.gameState.currentRound,
  startedAt: room.startedAt,
});
beforeEach(() => vi.useFakeTimers().setSystemTime(NOW));
afterEach(() => vi.useRealTimers());

describe("shared match lifecycle", () => {
  it.each(playableGameIds())("%s survives RTDB's omitted empty collections on read, action, tick and end", (id) => {
    const started = startPlayingRoom(testRoom(id), NOW);
    const stored = databaseRoundTrip(started);
    const parsed = parseRoom(stored as unknown as Record<string, unknown>, stored.id)!;
    expect(Object.keys(parsed.gameState.currentScores as object).sort()).toEqual(["p1", "p2", "p3", "p4"]);
    expect(() => getGameEngine(id)!.handlePlayerAction(stored, "p1", null)).not.toThrow();
    expect(() => advanceRoomGame(stored, NOW + 1000)).not.toThrow();
    expect(endRoomGame(stored, NOW + 2000).status).toBe("RESULTS");
    expect(parsed.gameState.achievements).toEqual([]);
  });
  it("does not count the TV or offline people toward the minimum", () => {
    const room = testRoom("drawandguess", 3);
    expect(() => startPlayingRoom(room)).toThrow("4 位手機玩家");
    const full = testRoom("drawandguess");
    full.players.p4.isConnected = false;
    expect(() => startPlayingRoom(full)).toThrow("4 位手機玩家");
  });
  it("freezes the participating roster, letting late joiners spectate until rematch", () => {
    const room = startPlayingRoom(testRoom("everybodyknows"));
    room.players.late = { ...room.players.p1, id: "late" };
    expect(participantIds(room)).not.toContain("late");
    expect(applyRoomAction(room, "late", { type: "vote", targetPlayerId: "p1" }, phase(room))).toBe(room);
    const next = startPlayingRoom(returnRoomToLobby(room), NOW + 1000);
    expect(next.participantIds).toContain("late");
    expect(next.participantIds).not.toContain("tv");
  });
  it("uses elapsed wall time and does not double-tick for duplicate host tabs", () => {
    const room = startPlayingRoom(testRoom("everybodyknows"), NOW);
    const next = advanceRoomGame(room, NOW + 5000, true);
    expect(next.gameState.timeLeft).toBe(room.settings.timer - 5);
    const duplicate = advanceRoomGame(next, NOW + 5000, true);
    expect(duplicate.gameState.timeLeft).toBe(next.gameState.timeLeft);
    expect(duplicate.gameState.phaseEndsAt).toBe(room.gameState.phaseEndsAt);
  });
  it("gives the reveal a full readable duration after a long background interval", () => {
    const room = startPlayingRoom(testRoom("everybodyknows"), NOW);
    const next = advanceRoomGame(room, NOW + 90000, true);
    expect(next.gameState.phase).toBe("reveal");
    expect(next.gameState.timeLeft).toBe(7);
    expect(next.gameState.phaseEndsAt).toBe(NOW + 97000);
  });
  it("rejects a late answer at the deadline even if no host tick arrived", () => {
    const room = startPlayingRoom(testRoom("everybodyknows"), NOW);
    const next = applyRoomAction(
      room,
      "p1",
      { type: "vote", targetPlayerId: "p2" },
      phase(room),
      room.gameState.phaseEndsAt as number,
    );
    expect(next.gameState.phase).toBe("reveal");
    expect(next.gameState.votes).toEqual({});
  });
  it("starts a new reveal deadline on the final submission", () => {
    let room = startPlayingRoom(testRoom("everybodyknows"), NOW);
    for (const id of room.participantIds!)
      room = applyRoomAction(room, id, { type: "vote", targetPlayerId: "p2" }, phase(room), NOW + 1000);
    expect(room.gameState.phase).toBe("reveal");
    expect(room.gameState.phaseEndsAt).toBe(NOW + 8000);
    expect(Object.values(room.gameState.currentScores as object)).toEqual([10, 10, 10, 10]);
  });
  it("preserves a bomb fuse across passes and applies wrong-answer penalties to the deadline", () => {
    let room = startPlayingRoom(testRoom(), NOW);
    room = advanceRoomGame(room, NOW + 3000);
    let originalDeadline = room.gameState.phaseEndsAt as number;
    // The "speed" challenge is a single GO button with no wrong option; if it
    // opens the round, pass it first so the penalty assertions have a choice.
    let guard = 0;
    while (guard++ < 10) {
      const c = room.gameState.challenge as { id: string; correctAnswer: string; options: string[] } | null;
      if (c && c.options.some((o) => o !== c.correctAnswer)) break;
      room = applyRoomAction(
        room,
        room.gameState.bombHolderId as string,
        { type: "answer", challengeId: c!.id, answer: c!.correctAnswer },
        phase(room),
        NOW + 3000,
      );
      originalDeadline = room.gameState.phaseEndsAt as number;
    }
    const challenge = room.gameState.challenge as { id: string; correctAnswer: string; options: string[] };
    const holder = room.gameState.bombHolderId as string;
    room = applyRoomAction(
      room,
      holder,
      {
        type: "answer",
        challengeId: challenge.id,
        answer: challenge.options.find((o) => o !== challenge.correctAnswer)!,
      },
      phase(room),
      NOW + 3500,
    );
    expect(room.gameState.phaseEndsAt).toBe(originalDeadline - 1000);
    vi.advanceTimersByTime(600);
    room = applyRoomAction(
      room,
      holder,
      { type: "answer", challengeId: challenge.id, answer: challenge.correctAnswer },
      phase(room),
      NOW + 4100,
    );
    expect(room.gameState.phaseEndsAt).toBe(originalDeadline - 1000);
    expect(room.gameState.bombHolderId).not.toBe(holder);
  });
  it("returns a finished room to the lobby, resets readiness, and starts again with the same code", () => {
    const room = endRoomGame(startPlayingRoom(testRoom("drawandguess"), NOW), NOW + 1000);
    const lobby = returnRoomToLobby(databaseRoundTrip(room));
    expect(lobby.status).toBe("LOBBY");
    expect(lobby.gameState).toEqual({});
    expect(lobby.startedAt).toBeUndefined();
    expect(lobby.players.p1.isReady).toBe(false);
    expect(lobby.contentHistory?.drawandguess).toHaveLength(1);
    const restarted = startPlayingRoom(lobby, NOW + 2000);
    expect(restarted.id).toBe(room.id);
    expect(restarted.startedAt).toBe(NOW + 2000);
    expect(restarted.gameState.prompt).not.toEqual(room.gameState.prompt);
  });
  it("rejects actions from the previous match even when round and phase match", () => {
    const room = startPlayingRoom(testRoom("everybodyknows"), NOW);
    const next = startPlayingRoom(returnRoomToLobby(room), NOW + 1000);
    expect(applyRoomAction(next, "p1", { type: "vote", targetPlayerId: "p2" }, phase(room), NOW + 1500)).toBe(next);
  });
  it("keeps the same deadline when host ownership changes", () => {
    const room = startPlayingRoom(testRoom("everybodyknows"), NOW);
    const takenOver = { ...room, hostPlayerId: "p1", lastTickAt: NOW + 5000 };
    expect(advanceRoomGame(takenOver, NOW + 6000).gameState.timeLeft).toBe(room.settings.timer - 6);
  });
  it("reports shared winners and no winner for zero-point/failed games", () => {
    const room = startPlayingRoom(testRoom("everybodyknows"));
    room.gameState.currentScores = { p1: 10, p2: 10, p3: 0, p4: 0 };
    expect(endRoomGame(room).gameState.winnerIds).toEqual(["p1", "p2"]);
    const mystery = startPlayingRoom(testRoom("mysteryroom"));
    expect(endRoomGame(mystery).gameState.winnerIds).toEqual([]);
    mystery.gameState.isUnlocked = true;
    expect(endRoomGame(mystery).gameState.winnerIds).toEqual(["p1", "p2", "p3", "p4"]);
  });
  it("normalizes game-specific defaults, limits and switching settings", () => {
    expect(normalizeSettings("drawandguess").rounds).toBe(1);
    expect(normalizeSettings("drawandguess", { timer: -1, rounds: 100 })).toMatchObject({ timer: 30, rounds: 3 });
    const switched = returnRoomToLobby(startPlayingRoom(testRoom()), "mysteryroom");
    expect(switched.settings.timer).toBe(180);
    expect(switched.settings.rounds).toBe(1);
  });
});

describe("host recovery compare-and-swap", () => {
  it("allows recovery from a stale connected host without resetting a deadline", async () => {
    const { claimRoomHost } = await import("./gameSession");
    const room = startPlayingRoom(testRoom("everybodyknows"), NOW);
    const claimed = claimRoomHost(room, "p1", "tv", NOW + 21000)!;
    expect(claimed.hostPlayerId).toBe("p1");
    expect(claimed.gameState.phaseEndsAt).toBe(room.gameState.phaseEndsAt);
    expect(claimed.players.tv.isHost).toBe(false);
    expect(claimed.players.p1.isHost).toBe(true);
    expect(claimRoomHost(claimed, "p2", "tv", NOW + 21000)).toBeNull();
  });
  it("rejects takeover from a healthy host but allows an explicitly disconnected host", async () => {
    const { claimRoomHost } = await import("./gameSession");
    const room = startPlayingRoom(testRoom(), NOW);
    expect(claimRoomHost(room, "p1", "tv", NOW + 1000)).toBeNull();
    room.players.tv.isConnected = false;
    expect(claimRoomHost(room, "p1", "tv", NOW + 1000)?.hostPlayerId).toBe("p1");
  });
});
