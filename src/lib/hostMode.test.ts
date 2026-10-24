import { describe, expect, it } from "vitest";
import {
  defaultHostModeFor,
  hostIsPlaying,
  hostModeOf,
  initialPhoneHostTab,
  isPhoneHostRoom,
  resolveHostRole,
  screenLabel,
  storedHostMode,
  usesPhoneHostChrome,
} from "@/lib/hostMode";
import { isHostMode, HOST_MODES } from "@/constants/hostMode";
import { parseRoom } from "@/lib/roomData";
import { databaseRoundTrip, testRoom } from "@/test/fixtures";
import { startRoomGame } from "@/lib/gameSession";
import { connectedParticipantIds, participantIds } from "@/engine/participants";

describe("host mode resolution", () => {
  it("treats a room without hostMode as a big-screen room", () => {
    expect(hostModeOf({})).toBe("tv");
    expect(hostModeOf(null)).toBe("tv");
    expect(isPhoneHostRoom({ hostMode: undefined })).toBe(false);
    expect(screenLabel({})).toBe("電視大螢幕");
  });

  it("only accepts the two documented values", () => {
    expect(isHostMode("phone")).toBe(true);
    expect(isHostMode("tv")).toBe(true);
    expect(isHostMode("tablet")).toBe(false);
    expect(isHostMode(undefined)).toBe(false);
    expect(hostModeOf({ hostMode: "tablet" as never })).toBe("tv");
    expect(HOST_MODES.map((mode) => mode.id)).toEqual(["tv", "phone"]);
  });

  it("labels the shared screen for the mode actually in use", () => {
    expect(screenLabel({ hostMode: "phone" })).toBe("主持畫面");
    expect(usesPhoneHostChrome({ hostMode: "tv" } as never)).toBe(false);
    expect(usesPhoneHostChrome({ hostMode: "phone" } as never)).toBe(true);
  });
});

describe("host seat", () => {
  it("keeps the TV host a ready display seat", () => {
    expect(resolveHostRole("tv", undefined)).toEqual({ role: "display", isReady: true });
    // A TV host never plays, whatever the (ignored) phone-only toggle says.
    expect(resolveHostRole("tv", true)).toEqual({ role: "display", isReady: true });
  });

  it("makes a playing phone host a normal, not-yet-ready participant", () => {
    expect(resolveHostRole("phone", true)).toEqual({ role: "player", isReady: false });
  });

  it("keeps a presenting phone host out of the roster", () => {
    expect(resolveHostRole("phone", false)).toEqual({ role: "display", isReady: true });
    expect(resolveHostRole("phone", undefined)).toEqual({ role: "player", isReady: false });
  });
});

describe("phone-host room behaviour", () => {
  const phoneRoom = () => ({ ...testRoom("everybodyknows", 3), hostMode: "phone" as const });

  it("counts a playing host toward the match roster and the player minimum", () => {
    const room = phoneRoom();
    room.players.tv = { ...room.players.tv, role: "player" };
    expect(hostIsPlaying(room)).toBe(true);
    // Everybody Knows needs 4 players; host + 3 phones is enough without a TV.
    expect(participantIds(room)).toHaveLength(4);
    expect(connectedParticipantIds(room)).toHaveLength(4);
    const started = startRoomGame(room, 1000);
    expect(started.status).toBe("PLAYING");
    expect(started.participantIds).toContain("tv");
  });

  it("does not count a presenting host", () => {
    const room = phoneRoom();
    expect(hostIsPlaying(room)).toBe(false);
    expect(participantIds(room)).toHaveLength(3);
  });

  it("still refuses to start when only the display host is present", () => {
    const solo = { ...testRoom("everybodyknows", 0), hostMode: "phone" as const };
    // The host phone is a screen here, not a player, and the copy says so.
    expect(() => startRoomGame(solo, 1000)).toThrow(/至少需要 4 位玩家才能開始（主持手機不計入）/);
  });

  it("blames the TV only in big-screen rooms", () => {
    expect(() => startRoomGame(testRoom("everybodyknows", 0), 1000)).toThrow(/電視不計入/);
  });

  it("opens the briefing on the host's own controller, then the stage", () => {
    expect(initialPhoneHostTab({ ...testRoom(), gameState: { phase: "rules" } } as never)).toBe("controller");
    expect(initialPhoneHostTab({ ...testRoom(), gameState: { phase: "voting" } } as never)).toBe("stage");
    expect(initialPhoneHostTab(null)).toBe("stage");
  });
});

describe("creating and storing the choice", () => {
  it("survives a database round trip and parses back", () => {
    const stored = databaseRoundTrip({ ...testRoom("brainteaser"), hostMode: "phone" as const });
    expect(stored.hostMode).toBe("phone");
    expect(parseRoom(stored as never, "TESTA")?.hostMode).toBe("phone");
  });

  it("drops unknown values back to the TV default", () => {
    const parsed = parseRoom({ ...testRoom(), hostMode: "projector" } as never, "TESTA");
    expect(parsed?.hostMode).toBeUndefined();
    expect(hostModeOf(parsed)).toBe("tv");
  });

  it("suggests phone hosting on a narrow touch device only", () => {
    expect(defaultHostModeFor({ width: 390, isTouchDevice: true })).toBe("phone");
    expect(defaultHostModeFor({ width: 1440, isTouchDevice: false })).toBe("tv");
    expect(defaultHostModeFor({ width: 900, isTouchDevice: true })).toBe("tv");
    // Before measurement, never guess.
    expect(defaultHostModeFor({ width: 0 })).toBe("tv");
  });

  it("prefers a stored choice over the device default", () => {
    expect(storedHostMode("tv", { width: 390, isTouchDevice: true })).toBe("tv");
    expect(storedHostMode("phone", { width: 1440, isTouchDevice: false })).toBe("phone");
    expect(storedHostMode(null, { width: 390, isTouchDevice: true })).toBe("phone");
  });
});
