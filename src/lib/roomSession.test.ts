import { afterEach, describe, expect, it } from "vitest";
import { forgetRoomSession, recallRoomSession, rememberRoomSession } from "./roomSession";
import type { Player, Room } from "@/types";

const host: Player = {
  id: "tv-uid",
  nickname: "客廳電視",
  avatar: "👑",
  isHost: true,
  role: "display",
  isConnected: true,
  isReady: true,
  score: 0,
};

function room(id: string): Room {
  return {
    id,
    gameId: "bombcountdown",
    hostPlayerId: host.id,
    status: "LOBBY",
    createdAt: Date.now(),
    settings: { timer: 15, difficulty: "easy", rounds: 3, soundEnabled: true, ageMode: "family" },
    players: { [host.id]: host },
    gameState: {},
  };
}

function withWindow(): void {
  (global as unknown as { window: unknown }).window = {};
}

afterEach(() => {
  forgetRoomSession();
  delete (global as unknown as { window?: unknown }).window;
});

describe("roomSession", () => {
  it("hands the room to a provider that mounts after the previous one was unmounted", () => {
    // `/create` and `/room` mount different providers, so creating a room and
    // navigating to the host screen remounts the provider. The new instance must
    // be able to render the room immediately instead of reporting "no room".
    withWindow();
    rememberRoomSession(room("ABCDE"), host);
    expect(recallRoomSession()?.room.id).toBe("ABCDE");
    expect(recallRoomSession()?.player?.nickname).toBe("客廳電視");
  });

  it("keeps the newest room when a host switches rooms", () => {
    withWindow();
    rememberRoomSession(room("ABCDE"), host);
    rememberRoomSession(room("FGHJK"), host);
    expect(recallRoomSession()?.room.id).toBe("FGHJK");
  });

  it("forgets the room after leaving or ending it", () => {
    withWindow();
    rememberRoomSession(room("ABCDE"), host);
    forgetRoomSession();
    expect(recallRoomSession()).toBeNull();
  });

  it("stays empty during server rendering so hydration matches", () => {
    rememberRoomSession(room("ABCDE"), host); // no window: ignored
    expect(recallRoomSession()).toBeNull();
  });
});
