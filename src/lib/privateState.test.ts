import { describe, expect, it } from "vitest";
import { testRoom } from "@/test/fixtures";
import { hydrateGameState, splitSecrets, viewGameState } from "./privateState";

describe("privateState split / view", () => {
  it("strips undercover secrets from the public blob", () => {
    const full = {
      phase: "discussion",
      civilianWord: "珍珠奶茶",
      undercoverWord: "水果茶",
      undercoverPlayerId: "p2",
      playerWords: { p1: "珍珠奶茶", p2: "水果茶", p3: "珍珠奶茶" },
      votes: {},
      eliminatedPlayerIds: [],
      currentScores: { p1: 0, p2: 0, p3: 0 },
    };
    const { publicState, hostSecrets, playerSecrets } = splitSecrets("whoisundercoveragent", full);
    expect(publicState.playerWords).toBeUndefined();
    expect(publicState.undercoverPlayerId).toBeUndefined();
    expect(publicState.undercoverWord).toBeUndefined();
    expect(publicState.civilianWord).toBeUndefined();
    expect(publicState.phase).toBe("discussion");
    expect(hostSecrets.undercoverPlayerId).toBe("p2");
    expect(playerSecrets.p2).toEqual({ myWord: "水果茶" });
    expect(playerSecrets.p1).toEqual({ myWord: "珍珠奶茶" });
  });

  it("lets a civilian phone see only their word", () => {
    const room = testRoom("whoisundercoveragent", 3);
    room.gameState = {
      phase: "voting",
      votes: {},
      eliminatedPlayerIds: [],
      currentScores: {},
    };
    const view = viewGameState(room, "p1", {
      myPrivate: { myWord: "珍珠奶茶" },
      hostSecrets: {
        undercoverPlayerId: "p2",
        playerWords: { p1: "珍珠奶茶", p2: "水果茶" },
        undercoverWord: "水果茶",
        civilianWord: "珍珠奶茶",
      },
    });
    expect(view.myWord).toBe("珍珠奶茶");
    expect(view.playerWords).toEqual({ p1: "珍珠奶茶" });
    expect(view.undercoverPlayerId).toBeUndefined();
    expect(view.undercoverWord).toBeUndefined();
  });

  it("games without secrets publish their state untouched", () => {
    const room = testRoom("followme", 4);
    const full = {
      phase: "command",
      command: 2,
      answers: { p1: 2 },
      roundPoints: { p1: 15 },
      streaks: { p1: 1 },
      currentScores: { p1: 15 },
    };
    room.gameState = full;
    const view = viewGameState(room, "p1");
    expect(view).toEqual({ ...full, displayCode: "••••" });
    expect(splitSecrets("followme", full).hostSecrets).toEqual({});
  });

  it("hydrates host state for the engine clock", () => {
    const hydrated = hydrateGameState(
      { phase: "drawing", strokes: [] },
      { prompt: { id: "d1", word: "捷運" } },
    );
    expect(hydrated).toEqual({ phase: "drawing", strokes: [], prompt: { id: "d1", word: "捷運" } });
  });

  it("keeps draw prompt off public state except category", () => {
    const full = {
      phase: "drawing",
      drawerPlayerId: "p1",
      prompt: { id: "d1", word: "捷運", category: "交通", aliases: [] },
      strokes: [],
    };
    const { publicState, playerSecrets } = splitSecrets("drawandguess", full);
    expect(publicState.prompt).toBeUndefined();
    expect(publicState.promptCategory).toBe("交通");
    expect(playerSecrets.p1?.prompt).toEqual(full.prompt);
    expect(playerSecrets.p2).toBeUndefined();
  });
});

describe("quiz answers stay hidden until reveal", () => {
  it("brainteaser publishes the question but not the answer", () => {
    const full = {
      phase: "question",
      riddle: { id: "r1", question: "Q", answer: "A", wrong: ["B"], explain: "E" },
      options: ["A", "B"],
    };
    const { publicState, hostSecrets } = splitSecrets("brainteaser", full);
    expect((publicState.riddle as { question?: string }).question).toBe("Q");
    expect((publicState.riddle as { answer?: string }).answer).toBeUndefined();
    expect((hostSecrets.riddle as { answer?: string }).answer).toBe("A");

    const room = testRoom("brainteaser", 3);
    room.gameState = publicState;
    const view = viewGameState(room, "p1", { hostSecrets });
    expect((view.riddle as { answer?: string }).answer).toBeUndefined();

    const revealed = splitSecrets("brainteaser", { ...full, phase: "reveal" });
    expect((revealed.publicState.riddle as { answer?: string }).answer).toBe("A");
    expect(revealed.hostSecrets.riddle).toBeUndefined();
  });

  it("song3seconds publishes a masked clue, not the title or full lyric", () => {
    const full = {
      phase: "answering",
      lyricRevealed: 2,
      currentSong: { id: "s1", title: "T", artist: "A", category: "C", lyric: "abcdef", options: ["T", "X"] },
    };
    const { publicState, hostSecrets } = splitSecrets("song3seconds", full);
    const song = publicState.currentSong as { title?: string; lyric?: string; options?: string[] };
    expect(song.title).toBeUndefined();
    expect(song.lyric).toBeUndefined();
    expect(song.options).toEqual(["T", "X"]);
    expect(publicState.lyricClue).toEqual([
      { char: "a", shown: true },
      { char: "b", shown: true },
      { char: "c", shown: false },
      { char: "d", shown: false },
      { char: "e", shown: false },
      { char: "f", shown: false },
    ]);
    expect((hostSecrets.currentSong as { title?: string }).title).toBe("T");

    const revealed = splitSecrets("song3seconds", { ...full, phase: "reveal" });
    expect((revealed.publicState.currentSong as { title?: string }).title).toBe("T");
  });

  it("aibullshit hides the real answer and the isReal ballot flag", () => {
    const full = {
      phase: "voting",
      prompt: { id: "t1", question: "Q", realAnswer: "R", decoys: ["D"] },
      options: [
        { id: "opt_0", text: "R", authorPlayerId: null, isReal: true },
        { id: "opt_1", text: "F", authorPlayerId: "p1", isReal: false },
      ],
    };
    const { publicState, hostSecrets } = splitSecrets("aibullshit", full);
    expect((publicState.prompt as { realAnswer?: string }).realAnswer).toBeUndefined();
    const options = publicState.options as Array<{ id: string; isReal?: boolean }>;
    expect(options.every((o) => o.isReal === undefined)).toBe(true);
    expect(options.map((o) => o.id)).toEqual(["opt_0", "opt_1"]);
    expect((hostSecrets.options as Array<{ isReal?: boolean }>)[0].isReal).toBe(true);

    const revealed = splitSecrets("aibullshit", { ...full, phase: "reveal" });
    expect((revealed.publicState.prompt as { realAnswer?: string }).realAnswer).toBe("R");
    expect((revealed.publicState.options as Array<{ isReal?: boolean }>)[0].isReal).toBe(true);
  });
});
