import { describe, it, expect } from "vitest";
import type { Room } from "@/types";
import { getGameEngine, isPlayable, playableGameIds } from "./index";
import { EverybodyKnowsEngine, EVERYBODY_GAME_ID } from "./everybodyKnows";
import { AIBullshitEngine, AIBULLSHIT_GAME_ID } from "./aiBullshit";
import { WhoIsUndercoverEngine, UNDERCOVER_GAME_ID } from "./whoIsUndercover";
import { Song3SecondsEngine, SONG_GAME_ID } from "./song3Seconds";
import { KingTonightEngine, KING_GAME_ID } from "./kingTonight";
import { FireworkMasterEngine, FIREWORK_GAME_ID } from "./fireworkMaster";
import { DrawAndGuessEngine, DRAW_GAME_ID } from "./drawAndGuess";
import { RealBattleEngine, BATTLE_GAME_ID } from "./realBattle";
import { MysteryRoomEngine, MYSTERY_GAME_ID } from "./mysteryRoom";

function createMockRoom(gameId: string): Room<any> {
  return {
    id: "TEST1",
    gameId,
    hostPlayerId: "p1",
    status: "PLAYING",
    createdAt: Date.now(),
    settings: {
      timer: 15,
      difficulty: "easy",
      rounds: 3,
      soundEnabled: true,
      ageMode: "family",
    },
    players: {
      p1: { id: "p1", nickname: "小明", avatar: "🐱", isHost: true, isConnected: true, score: 0 },
      p2: { id: "p2", nickname: "小美", avatar: "🐰", isHost: false, isConnected: true, score: 0 },
      p3: { id: "p3", nickname: "阿強", avatar: "🐻", isHost: false, isConnected: true, score: 0 },
    },
    gameState: {},
  };
}

describe("All 10 Games Engine Registry", () => {
  it("registers all 10 games as playable", () => {
    expect(playableGameIds()).toHaveLength(10);
    const ids = [
      "bombcountdown",
      EVERYBODY_GAME_ID,
      AIBULLSHIT_GAME_ID,
      UNDERCOVER_GAME_ID,
      SONG_GAME_ID,
      KING_GAME_ID,
      FIREWORK_GAME_ID,
      DRAW_GAME_ID,
      BATTLE_GAME_ID,
      MYSTERY_GAME_ID,
    ];
    for (const id of ids) {
      expect(isPlayable(id)).toBe(true);
      expect(getGameEngine(id)).not.toBeNull();
    }
  });
});

describe("Everybody Knows Engine", () => {
  it("creates game, votes, and tallies correctly", () => {
    const room = createMockRoom(EVERYBODY_GAME_ID);
    const state = EverybodyKnowsEngine.createGame(room);
    expect(state.phase).toBe("voting");
    expect(state.question.question).toBeDefined();

    room.gameState = state;
    // Vote p1 -> p2, p2 -> p2, p3 -> p1
    let next = EverybodyKnowsEngine.handlePlayerAction(room, "p1", { type: "vote", targetPlayerId: "p2" });
    room.gameState = next;
    next = EverybodyKnowsEngine.handlePlayerAction(room, "p2", { type: "vote", targetPlayerId: "p2" });
    room.gameState = next;
    next = EverybodyKnowsEngine.handlePlayerAction(room, "p3", { type: "vote", targetPlayerId: "p1" });

    expect(next.phase).toBe("reveal");
    expect(next.mostVotedPlayerIds).toContain("p2");
    expect(next.currentScores["p1"]).toBe(10);
    expect(next.currentScores["p2"]).toBe(10);
    expect(next.currentScores["p3"]).toBe(0);
  });
});

describe("AI Bullshit Engine", () => {
  it("progresses through submitting, voting, and scoring", () => {
    const room = createMockRoom(AIBULLSHIT_GAME_ID);
    const state = AIBullshitEngine.createGame(room);
    expect(state.phase).toBe("submitting");

    room.gameState = state;
    let next = AIBullshitEngine.handlePlayerAction(room, "p1", { type: "submitBluff", text: "把頭放在水裡" });
    room.gameState = next;
    next = AIBullshitEngine.handlePlayerAction(room, "p2", { type: "submitBluff", text: "倒立吃香蕉" });
    room.gameState = next;
    next = AIBullshitEngine.handlePlayerAction(room, "p3", { type: "submitBluff", text: "敲鑼打鼓" });

    expect(next.phase).toBe("voting");
    expect(next.options.length).toBe(4); // 3 fakes + 1 real

    // Now players vote
    room.gameState = next;
    // p1 votes for real
    next = AIBullshitEngine.handlePlayerAction(room, "p1", { type: "voteAnswer", optionId: "real" });
    room.gameState = next;
    // p2 votes for p1's fake
    next = AIBullshitEngine.handlePlayerAction(room, "p2", { type: "voteAnswer", optionId: "fake_p1" });
    room.gameState = next;
    // p3 votes for real
    next = AIBullshitEngine.handlePlayerAction(room, "p3", { type: "voteAnswer", optionId: "real" });

    expect(next.phase).toBe("reveal");
    expect(next.currentScores["p1"]).toBe(15); // 10 for real + 5 for fooling p2
    expect(next.currentScores["p2"]).toBe(0);
    expect(next.currentScores["p3"]).toBe(10); // 10 for real
  });
});

describe("Who Is Undercover Engine", () => {
  it("assigns secret words and calculates elimination", () => {
    const room = createMockRoom(UNDERCOVER_GAME_ID);
    const state = WhoIsUndercoverEngine.createGame(room);
    expect(state.phase).toBe("viewing_words");
    expect(state.undercoverPlayerId).toBeDefined();

    const undercoverId = state.undercoverPlayerId;
    const civilianIds = Object.keys(room.players).filter((id) => id !== undercoverId);

    expect(state.playerWords[undercoverId]).toBe(state.undercoverWord);
    expect(state.playerWords[civilianIds[0]]).toBe(state.civilianWord);

    // Skip to voting
    state.phase = "voting";
    room.gameState = state;

    // All vote for undercover
    let next = state;
    for (const id of Object.keys(room.players)) {
      next = WhoIsUndercoverEngine.handlePlayerAction(room, id, { type: "vote", targetPlayerId: undercoverId });
      room.gameState = next;
    }

    expect(next.phase).toBe("result");
    expect(next.winnerTeam).toBe("civilians");
    expect(next.currentScores[civilianIds[0]]).toBe(20);
  });
});

describe("Song 3 Seconds Engine", () => {
  it("handles fast answers with speed bonus", () => {
    const room = createMockRoom(SONG_GAME_ID);
    const state = Song3SecondsEngine.createGame(room);
    expect(state.phase).toBe("listen");

    state.phase = "answering";
    state.roundStartTime = Date.now() - 500; // 500ms elapsed
    room.gameState = state;

    const correctTitle = state.currentSong.title;
    let next = Song3SecondsEngine.handlePlayerAction(room, "p1", { type: "answer", choice: correctTitle });
    room.gameState = next;
    next = Song3SecondsEngine.handlePlayerAction(room, "p2", { type: "answer", choice: "Wrong Choice" });
    room.gameState = next;
    next = Song3SecondsEngine.handlePlayerAction(room, "p3", { type: "answer", choice: correctTitle });

    expect(next.phase).toBe("reveal");
    expect(next.currentScores["p1"]).toBeGreaterThanOrEqual(10);
    expect(next.currentScores["p2"]).toBe(0);
  });
});

describe("King Tonight Engine", () => {
  it("counts taps in tap_mash mini challenge", () => {
    const room = createMockRoom(KING_GAME_ID);
    const state = KingTonightEngine.createGame(room);
    expect(state.phase).toBe("briefing");

    state.phase = "action";
    room.gameState = state;

    let next = state;
    for (let i = 0; i < 5; i++) {
      next = KingTonightEngine.handlePlayerAction(room, "p1", { type: "tap" });
      room.gameState = next;
    }

    expect(next.playerInputs["p1"]).toBe(5);
  });
});

describe("Firework Master Engine", () => {
  it("submits designs and counts votes for best fireworks", () => {
    const room = createMockRoom(FIREWORK_GAME_ID);
    const state = FireworkMasterEngine.createGame(room);
    expect(state.phase).toBe("designing");

    room.gameState = state;
    let next = FireworkMasterEngine.handlePlayerAction(room, "p1", {
      type: "submitDesign",
      design: { color: "#ff0000", shape: "heart", trailEffect: "sparkle", density: 40 },
    });
    room.gameState = next;
    next = FireworkMasterEngine.handlePlayerAction(room, "p2", {
      type: "submitDesign",
      design: { color: "#00ff00", shape: "star", trailEffect: "glitter", density: 50 },
    });
    room.gameState = next;
    next = FireworkMasterEngine.handlePlayerAction(room, "p3", {
      type: "submitDesign",
      design: { color: "#0000ff", shape: "circle", trailEffect: "smoke", density: 20 },
    });

    expect(next.phase).toBe("show");

    // Transition to voting
    next.phase = "voting";
    room.gameState = next;
    // p1 votes p2, p2 votes p1, p3 votes p1
    next = FireworkMasterEngine.handlePlayerAction(room, "p1", { type: "voteDesign", targetPlayerId: "p2" });
    room.gameState = next;
    next = FireworkMasterEngine.handlePlayerAction(room, "p2", { type: "voteDesign", targetPlayerId: "p1" });
    room.gameState = next;
    next = FireworkMasterEngine.handlePlayerAction(room, "p3", { type: "voteDesign", targetPlayerId: "p1" });

    expect(next.phase).toBe("result");
    expect(next.winnerId).toBe("p1");
    expect(next.currentScores["p1"]).toBe(30); // 2 votes * 15 pts
  });
});

describe("Draw and Guess Engine", () => {
  it("receives strokes from drawer and guesses from guessers", () => {
    const room = createMockRoom(DRAW_GAME_ID);
    const state = DrawAndGuessEngine.createGame(room);
    expect(state.phase).toBe("drawing");
    expect(state.drawerPlayerId).toBe("p1");

    room.gameState = state;
    // Drawer adds stroke
    let next = DrawAndGuessEngine.handlePlayerAction(room, "p1", {
      type: "addStroke",
      stroke: { color: "#000", width: 4, points: [10, 20, 30, 40] },
    });
    expect(next.strokes.length).toBe(1);

    // p2 guesses correctly
    room.gameState = next;
    next = DrawAndGuessEngine.handlePlayerAction(room, "p2", {
      type: "guessWord",
      word: state.prompt.word,
    });
    expect(next.correctPlayerIds).toContain("p2");
    expect(next.currentScores["p2"]).toBe(15);
    expect(next.currentScores["p1"]).toBe(5); // Drawer rewarded
  });
});

describe("Real Battle Engine", () => {
  it("moves players and collects arena items", () => {
    const room = createMockRoom(BATTLE_GAME_ID);
    const state = RealBattleEngine.createGame(room);
    expect(state.phase).toBe("countdown");

    state.phase = "battle";
    // Place item directly on p1's position
    const p1Pos = state.positions["p1"];
    state.items = [{ id: "star_1", x: p1Pos.x + 1, y: p1Pos.y, type: "star", points: 5 }];
    room.gameState = state;

    const next = RealBattleEngine.handlePlayerAction(room, "p1", { type: "move", dx: 0.1, dy: 0 });
    expect(next.currentScores["p1"]).toBe(5);
  });
});

describe("Mystery Room Engine", () => {
  it("distributes clues and solves with correct passcode", () => {
    const room = createMockRoom(MYSTERY_GAME_ID);
    const state = MysteryRoomEngine.createGame(room);
    expect(state.phase).toBe("investigation");
    expect(state.playerClues["p1"]).toBeDefined();

    room.gameState = state;
    const next = MysteryRoomEngine.handlePlayerAction(room, "p1", {
      type: "submitCode",
      code: "7429",
    });

    expect(next.isUnlocked).toBe(true);
    expect(next.phase).toBe("result");
    expect(next.currentScores["p1"]).toBe(35); // 20 base + 15 solver bonus
    expect(next.currentScores["p2"]).toBe(20);
  });
});
