import { describe, it, expect } from "vitest";
import { decideRoomEntry, sameRoomCode, type RoomEntryInput } from "./roomEntry";

const base: RoomEntryInput = {
  roomCode: "NEW12",
  loading: false,
  pendingRoomCode: null,
  roomId: null,
  hasPlayer: false,
  hostOnly: true,
  isHost: false,
  isDisplay: false,
};

describe("decideRoomEntry", () => {
  it("waits instead of bouncing when the provider is still opening this room", () => {
    // Regression: creating a second room on the same device. The provider holds
    // no room yet (or still holds the previous one) while the new room is being
    // subscribed to; the old gate treated that as "not a member" and replaced
    // the host screen with /join/<code>.
    expect(decideRoomEntry({ ...base, pendingRoomCode: "NEW12" })).toBe("wait");
    expect(decideRoomEntry({ ...base, pendingRoomCode: "NEW12", roomId: "OLD99" })).toBe("wait");
    expect(decideRoomEntry({ ...base, pendingRoomCode: "new12" })).toBe("wait");
  });

  it("waits while the stored session is still resolving", () => {
    expect(decideRoomEntry({ ...base, loading: true })).toBe("wait");
  });

  it("sends settled non-members to the join form for that room", () => {
    expect(decideRoomEntry(base)).toBe("join");
    // In another room, but this URL is not theirs.
    expect(decideRoomEntry({ ...base, roomId: "OLD99", hasPlayer: true })).toBe("join");
    // Pending handshake for a different room does not excuse a mismatch.
    expect(decideRoomEntry({ ...base, roomId: "OLD99", hasPlayer: true, pendingRoomCode: "OLD99" })).toBe("join");
    // A room that ended earlier does not turn unrelated URLs into dead ends.
    expect(decideRoomEntry({ ...base, lostRoomCode: "OLD99" })).toBe("join");
  });

  it("goes home when the room in the URL is gone", () => {
    // Ending a room clears the session while the URL still names it; offering
    // the join form for a deleted code is a dead end.
    expect(decideRoomEntry({ ...base, lostRoomCode: "NEW12" })).toBe("home");
    expect(decideRoomEntry({ ...base, lostRoomCode: "new12", roomId: "OLD99", hasPlayer: true })).toBe("home");
    // Still waiting for a room being opened — a lost room must not win yet.
    expect(decideRoomEntry({ ...base, lostRoomCode: "NEW12", pendingRoomCode: "NEW12" })).toBe("wait");
  });

  it("renders the host screen for the host's own room", () => {
    expect(
      decideRoomEntry({
        ...base,
        roomId: "NEW12",
        hasPlayer: true,
        isHost: true,
        isDisplay: true,
      }),
    ).toBe("ready");
  });

  it("sends a phone that opens the host URL to its controller", () => {
    expect(
      decideRoomEntry({
        ...base,
        roomId: "NEW12",
        hasPlayer: true,
        isHost: false,
        isDisplay: false,
      }),
    ).toBe("play");
  });

  it("accepts a lowercase room code in the URL", () => {
    expect(
      decideRoomEntry({
        ...base,
        roomCode: "new12",
        roomId: "NEW12",
        hasPlayer: true,
        isHost: true,
        isDisplay: true,
      }),
    ).toBe("ready");
  });
});

describe("sameRoomCode", () => {
  it("normalises case and padding", () => {
    expect(sameRoomCode(" abcde ", "ABCDE")).toBe(true);
    expect(sameRoomCode("ABCDE", "ABCDF")).toBe(false);
    expect(sameRoomCode(null, "ABCDE")).toBe(false);
    expect(sameRoomCode("", "")).toBe(false);
  });
});
