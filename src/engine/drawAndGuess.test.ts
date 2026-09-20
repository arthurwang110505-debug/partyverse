import { describe, expect, it } from "vitest";
import type { Room } from "@/types";
import { testRoom } from "@/test/fixtures";
import {
  DRAW_PROMPTS,
  DrawAndGuessEngine as engine,
  MAX_STROKES,
  drawHint,
  normalizeGuess,
  type DrawGameState,
  type StrokeLine,
} from "./drawAndGuess";

function activeRoom(): Room<DrawGameState> {
  const room = testRoom("drawandguess") as unknown as Room<DrawGameState>;
  room.gameState = engine.createGame(room);
  room.gameState = { ...room.gameState, phase: "drawing", timeLeft: room.gameState.drawDuration };
  return room;
}
function guessers(room: Room<DrawGameState>) {
  return room.gameState.drawerOrder.filter((id) => id !== room.gameState.drawerPlayerId);
}
const line: StrokeLine = { id: "stroke-1", revision: 1, color: "#ffffff", width: 6, points: [10, 20, 30, 40] };
function stroke(room: Room<DrawGameState>, value = line, version = room.gameState.canvasVersion) {
  return engine.handlePlayerAction(room, room.gameState.drawerPlayerId, {
    type: "addStroke",
    stroke: value,
    canvasVersion: version,
  });
}

describe("Draw & Guess", () => {
  it("starts with a briefing, a shuffled roster and a turn for every player", () => {
    const room = testRoom("drawandguess") as unknown as Room<DrawGameState>;
    const state = engine.createGame(room);
    expect(state.phase).toBe("briefing");
    expect(state.drawerOrder.sort()).toEqual(["p1", "p2", "p3", "p4"]);
    expect(state.totalRounds).toBe(4);
    expect(state.currentScores).not.toHaveProperty("tv");
  });
  it("rotates through every drawer before repeating and uses fresh prompts", () => {
    const room = activeRoom();
    room.settings.rounds = 2;
    room.gameState = engine.createGame(room);
    const drawers: string[] = [];
    const prompts: string[] = [];
    while (room.gameState.phase !== "result") {
      drawers.push(room.gameState.drawerPlayerId);
      prompts.push(room.gameState.prompt.id);
      room.gameState = { ...room.gameState, phase: "reveal", timeLeft: 1 };
      room.gameState = engine.updateGameState(room);
    }
    expect(drawers).toHaveLength(8);
    expect(new Set(drawers.slice(0, 4)).size).toBe(4);
    expect(drawers.slice(0, 4)).toEqual(drawers.slice(4));
    expect(new Set(prompts).size).toBe(8);
  });
  it("avoids prompts used in the previous match", () => {
    const room = activeRoom();
    room.contentHistory = { drawandguess: DRAW_PROMPTS.slice(0, -1).map((p) => p.id) };
    expect(engine.createGame(room).prompt.id).toBe(DRAW_PROMPTS[DRAW_PROMPTS.length - 1].id);
  });
  it("updates one live stroke without duplicating it or accepting older packets", () => {
    const room = activeRoom();
    room.gameState = stroke(room);
    const newer = { ...line, revision: 3, points: [10, 20, 30, 40, 50, 60] };
    room.gameState = stroke(room, newer);
    expect(room.gameState.strokes).toEqual([newer]);
    expect(stroke(room, { ...line, revision: 2 })).toBe(room.gameState);
  });
  it("does not allow an old stream to resurrect strokes after clear or undo", () => {
    for (const type of ["clearCanvas", "undoStroke"]) {
      const room = activeRoom();
      room.gameState = stroke(room);
      room.gameState = engine.handlePlayerAction(room, room.gameState.drawerPlayerId, { type });
      expect(room.gameState.strokes).toEqual([]);
      expect(room.gameState.canvasVersion).toBe(1);
      expect(stroke(room, { ...line, revision: 10 }, 0)).toBe(room.gameState);
      expect(stroke(room, { ...line, id: "new-stroke" }).strokes).toHaveLength(1);
    }
  });
  it("accepts dots, clamps coordinates, and rejects malformed/oversized strokes", () => {
    const room = activeRoom();
    expect(stroke(room, { ...line, points: [-100, 900] }).strokes[0].points).toEqual([0, 400]);
    for (const bad of [
      { ...line, points: [NaN, 1] },
      { ...line, points: [1, 2, 3] },
      { ...line, points: Array(2048).fill(1) },
      { ...line, color: "not-a-color" },
      { ...line, width: 999 },
      { ...line, revision: -1 },
    ]) {
      expect(stroke(room, bad)).toBe(room.gameState);
    }
  });
  it("never silently removes older artwork when the canvas is full", () => {
    const room = activeRoom();
    room.gameState.strokes = Array.from({ length: MAX_STROKES }, (_, i) => ({ ...line, id: `s-${i}` }));
    expect(stroke(room)).toBe(room.gameState);
    expect(room.gameState.strokes[0].id).toBe("s-0");
  });
  it("rejects drawing from a guesser", () => {
    const room = activeRoom();
    expect(
      engine.handlePlayerAction(room, guessers(room)[0], { type: "addStroke", stroke: line, canvasVersion: 0 }),
    ).toBe(room.gameState);
  });
  it("normalizes aliases but never exposes a successful guess in the public ticker", () => {
    const room = activeRoom();
    room.gameState.prompt = DRAW_PROMPTS[0];
    const id = guessers(room)[0];
    const next = engine.handlePlayerAction(room, id, { type: "guessWord", word: " ＣＡＴ！ " });
    expect(normalizeGuess(" ＣＡＴ！ ")).toBe("cat");
    expect(next.correctPlayerIds).toContain(id);
    expect(next.guesses[id]).toBe("答對了！");
    expect(next.guesses[id]).not.toContain("貓");
    expect(next.currentScores[id]).toBe(25);
    expect(next.currentScores[next.drawerPlayerId]).toBe(5);
  });
  it("awards a correct guess only once and rewards faster answers", () => {
    const room = activeRoom();
    const [fast, slow] = guessers(room);
    const act = { type: "guessWord", word: room.gameState.prompt.word };
    room.gameState = engine.handlePlayerAction(room, fast, act);
    expect(engine.handlePlayerAction(room, fast, act)).toBe(room.gameState);
    room.gameState.timeLeft = 1;
    const next = engine.handlePlayerAction(room, slow, act);
    expect(next.currentScores[fast]).toBeGreaterThan(next.currentScores[slow]);
    expect(next.currentScores[slow]).toBeGreaterThanOrEqual(10);
    expect(next.roundScores[next.drawerPlayerId]).toBe(10);
  });
  it("reveals as soon as all connected guessers finish", () => {
    const room = activeRoom();
    const [first, second, offline] = guessers(room);
    room.players[offline].isConnected = false;
    for (const id of [first, second])
      room.gameState = engine.handlePlayerAction(room, id, { type: "guessWord", word: room.gameState.prompt.word });
    expect(room.gameState.phase).toBe("reveal");
    expect(room.gameState.roundReason).toBe("solved");
  });
  it("ends an interrupted drawing and skips disconnected drawers", () => {
    const room = activeRoom();
    room.players[room.gameState.drawerPlayerId].isConnected = false;
    room.gameState = engine.updateGameState(room);
    expect(room.gameState.roundReason).toBe("disconnected");
    room.gameState.timeLeft = 1;
    room.players[room.gameState.drawerOrder[1]].isConnected = false;
    room.gameState = engine.updateGameState(room);
    expect(room.gameState.currentRound).toBe(3);
    expect(room.gameState.drawerPlayerId).toBe(room.gameState.drawerOrder[2]);
  });
  it("provides progressive hints without revealing the whole word", () => {
    const room = activeRoom();
    room.gameState.prompt = DRAW_PROMPTS[0];
    expect(drawHint(room.gameState)).toBe("● ●");
    room.gameState.timeLeft = 30;
    expect(drawHint(room.gameState, "easy")).toBe("貓 ●");
    expect(drawHint(room.gameState, "medium")).toBe("● ●");
    room.gameState.timeLeft = 5;
    expect(drawHint(room.gameState)).toBe("貓 ●");
    expect(drawHint(room.gameState, "hard")).toBe("● ●");
  });
});
