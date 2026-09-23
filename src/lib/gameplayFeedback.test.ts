import { describe, expect, it } from "vitest";
import { testRoom } from "@/test/fixtures";
import { submissionProgress } from "./gameplayFeedback";

describe("safe submission feedback", () => {
  it("counts only connected frozen participants and never returns their choices", () => {
    const room = testRoom("everybodyknows");
    room.participantIds = ["p1", "p2", "p3", "p4"];
    room.players.p4.isConnected = false;
    room.players.late = { ...room.players.p1, id: "late" };
    room.gameState = { phase: "voting", votes: { p1: "secret", p4: "secret", late: "secret" } };
    expect(submissionProgress(room, "p1")).toEqual({ completed: 1, total: 3, message: "已收到！等待其他玩家完成" });
    expect(submissionProgress(room, "p2")?.message).toBe("請在手機投票");
    expect(submissionProgress(room, "late")?.message).toContain("觀戰");
    expect(JSON.stringify(submissionProgress(room))).not.toContain("secret");
  });

  it("excludes the word's author and counts false votes as submitted", () => {
    const room = testRoom("wordchain");
    room.gameState = { phase: "voting", pending: { playerId: "p1" }, votes: { p2: false } };
    expect(submissionProgress(room, "p2")).toEqual({ completed: 1, total: 3, message: "已收到！等待其他玩家完成" });
    expect(submissionProgress(room, "p1")?.message).toContain("觀戰");
  });

  it("excludes eliminated undercover players and hides counts during reveals", () => {
    const room = testRoom("whoisundercoveragent");
    room.gameState = { phase: "voting", eliminatedPlayerIds: ["p4"], votes: {} };
    expect(submissionProgress(room)?.total).toBe(3);
    room.gameState.phase = "eliminated";
    expect(submissionProgress(room)).toBeNull();
  });

  it.each([
    ["aibullshit", "submitting", "submissions"],
    ["fireworkmaster", "designing", "designs"],
    ["song3seconds", "answering", "playerAnswers"],
  ])("%s shows completion without leaking content", (id, phase, key) => {
    const room = testRoom(id);
    room.gameState = { phase, [key]: { p1: "secret" } };
    expect(submissionProgress(room, "p1")?.completed).toBe(1);
    expect(JSON.stringify(submissionProgress(room))).not.toContain("secret");
  });
});
