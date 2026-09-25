import { afterEach, describe, expect, it, vi } from "vitest";
import { getGameEngine, playableGameIds } from "./index";
import { GAME_GUIDES } from "@/constants/gameGuides";
import { databaseRoundTrip, testRoom } from "@/test/fixtures";
import { advanceRoomGame, applyRoomAction, claimRoomHost, restartRoomGame, startRoomGame } from "@/lib/gameSession";
import type { Room } from "@/types";

const NOW = 100000;
function act(room: Room, id: string, type: string, now = NOW) {
  return applyRoomAction(
    room,
    id,
    { type },
    {
      gameId: room.gameId,
      phase: room.gameState.phase,
      round: room.gameState.currentRound,
      startedAt: room.startedAt,
    },
    now,
  );
}
afterEach(() => vi.useRealTimers());

describe("shared readiness briefing", () => {
  it.each(playableGameIds())("%s has a guide, waits for everyone, then gives play a fresh clock", (id) => {
    expect(GAME_GUIDES[id].goal).toBeTruthy();
    expect(GAME_GUIDES[id].controls).toBeTruthy();
    expect(GAME_GUIDES[id].scoring).toBeTruthy();
    let room = startRoomGame(testRoom(id), NOW);
    expect(room.gameState.phase).toBe("rules");
    room = advanceRoomGame(room, NOW + 60000);
    expect(room.gameState.phase).toBe("rules");
    room = act(room, "p1", "skipRules", NOW + 60000);
    expect(room.gameState.phase).toBe("rules");
    room = act(room, "p1", "readyRules", NOW + 60000);
    room = act(room, "p1", "readyRules", NOW + 60000);
    expect(room.gameState.rulesReady).toEqual({ p1: true });
    room = databaseRoundTrip(room);
    for (const player of ["p2", "p3", "p4"]) room = act(room, player, "readyRules", NOW + 60000);
    expect(room.gameState.phase).not.toBe("rules");
    expect(room.gameState.phaseEndsAt).toBeGreaterThan(NOW + 60000);
    expect(room.participantIds).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("freezes gameplay and excludes spectators, display seats, and offline readiness", () => {
    let room = startRoomGame(testRoom("everybodyknows"), NOW);
    room.players.late = { ...room.players.p1, id: "late" };
    for (const id of ["late", "tv"]) room = act(room, id, "readyRules");
    room = act(room, "p1", "vote");
    expect(room.gameState.votes).toEqual({});
    expect(room.gameState.rulesReady).toEqual({});
    room.players.p4.isConnected = false;
    room = act(room, "p4", "readyRules");
    expect(room.gameState.rulesReady).toEqual({});
    for (const id of ["p1", "p2", "p3"]) room = act(room, id, "readyRules");
    expect(room.gameState.phase).toBe("voting");
  });

  it("starts after the only unready player disconnects, but not with zero connected players", () => {
    let room = startRoomGame(testRoom("everybodyknows"), NOW);
    for (const id of ["p1", "p2", "p3"]) room = act(room, id, "readyRules");
    room.players.p4.isConnected = false;
    expect(advanceRoomGame(room, NOW + 1000).gameState.phase).toBe("voting");
    for (const id of room.participantIds!) room.players[id].isConnected = false;
    expect(advanceRoomGame(room, NOW + 1000).gameState.phase).toBe("rules");
  });

  it("only the current connected host can start early, including a recovered phone host", () => {
    let room = startRoomGame(testRoom("everybodyknows"), NOW);
    expect(act(room, "tv", "skipRules").gameState.phase).toBe("voting");
    room.players.tv.isConnected = false;
    expect(act(room, "tv", "skipRules").gameState.phase).toBe("rules");
    room = claimRoomHost(room, "p2", "tv", NOW + 1000)!;
    expect(act(room, "p1", "skipRules", NOW + 1000).gameState.phase).toBe("rules");
    expect(act(room, "p2", "skipRules", NOW + 1000).gameState.phase).toBe("voting");
  });

  it("does not age time-sensitive game state while reading", () => {
    vi.useFakeTimers().setSystemTime(NOW);
    let room = startRoomGame(testRoom("song3seconds"), NOW);
    vi.setSystemTime(NOW + 120000);
    room = act(room, "tv", "skipRules", Date.now());
    expect(room.gameState.roundStartTime).toBe(Date.now() + 3000);
    expect(room.gameState.phaseEndsAt).toBe(Date.now() + 3000);
  });

  it("resets readiness on restart and tolerates missing RTDB maps", () => {
    let room = databaseRoundTrip(startRoomGame(testRoom("wordchain"), NOW));
    expect(() => getGameEngine("wordchain")!.updateGameState(room)).not.toThrow();
    room = act(room, "p1", "readyRules");
    room = restartRoomGame(room, NOW + 1000);
    expect(room.gameState.phase).toBe("rules");
    expect(room.gameState.rulesReady).toEqual({});
  });
});
