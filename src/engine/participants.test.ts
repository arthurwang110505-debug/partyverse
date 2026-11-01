import { describe, expect, it } from "vitest";
import { activeParticipantCount } from "./participants";
import type { Player } from "@/types";

const player = (id: string, overrides: Partial<Player> = {}): Player => ({
  id,
  nickname: id,
  avatar: "🦊",
  isHost: false,
  isConnected: true,
  isReady: true,
  score: 0,
  ...overrides,
});

describe("activeParticipantCount", () => {
  it("ignores display seats and departed players", () => {
    expect(
      activeParticipantCount({
        tv: player("tv", { role: "display" }),
        p1: player("p1"),
        p2: player("p2", { isConnected: false }),
        p3: player("p3"),
      }),
    ).toBe(2);
  });

  it("handles an empty roster", () => {
    expect(activeParticipantCount(undefined)).toBe(0);
    expect(activeParticipantCount({})).toBe(0);
  });
});
