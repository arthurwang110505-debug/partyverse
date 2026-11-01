import { describe, expect, it } from "vitest";
import { testRoom } from "@/test/fixtures";
import { buildMatchRecap, formatMatchReport, formatTournamentReport } from "./matchRecap";

describe("matchRecap", () => {
  it("surfaces MVP and duration facts from scores", () => {
    const room = testRoom("everybodyknows", 4);
    room.status = "RESULTS";
    room.startedAt = 1_000_000;
    room.finishedAt = 1_000_000 + 125_000;
    room.gameState = {
      phase: "result",
      currentScores: { p1: 40, p2: 25, p3: 10, p4: 0 },
      winnerIds: ["p1"],
    };
    room.participantIds = ["p1", "p2", "p3", "p4"];
    const facts = buildMatchRecap(room);
    expect(facts.some((f) => f.id === "mvp" && f.detail.includes("40"))).toBe(true);
    expect(facts.some((f) => f.id === "time")).toBe(true);
    expect(facts.length).toBeGreaterThanOrEqual(1);
    expect(facts.length).toBeLessThanOrEqual(4);
  });

  it("formats a shareable text report", () => {
    const room = testRoom("brainteaser", 3);
    room.gameState = { currentScores: { p1: 30, p2: 20, p3: 10 } };
    room.participantIds = ["p1", "p2", "p3"];
    const text = formatMatchReport(room, "腦筋急轉彎");
    expect(text).toContain("PARTYVERSE 戰報");
    expect(text).toContain("腦筋急轉彎");
    expect(text).toContain("30 分");
  });

  it("formats a cumulative battle-mode report including all tournament players", () => {
    const room = testRoom("brainteaser", 3);
    const report = formatTournamentReport(room, { p1: 120, p2: 95, p3: 40 }, 8);
    expect(report).toContain("決戰戰報 · 8 款遊戲");
    expect(report.indexOf("玩家1：120 分")).toBeLessThan(report.indexOf("玩家2：95 分"));
    expect(report).toContain("玩家3：40 分");
  });

  it("detects a photo-finish duel", () => {
    const room = testRoom("song3seconds", 3);
    room.gameState = { currentScores: { p1: 22, p2: 20, p3: 5 } };
    room.participantIds = ["p1", "p2", "p3"];
    const facts = buildMatchRecap(room);
    expect(facts.some((f) => f.id === "duel")).toBe(true);
  });
});
