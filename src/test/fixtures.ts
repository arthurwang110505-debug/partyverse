import type { Room } from "@/types";
import { normalizeSettings } from "@/constants/gameSettings";

export function testRoom(gameId = "bombcountdown", count = 4): Room {
  return {
    id: "TESTA",
    gameId,
    hostPlayerId: "tv",
    status: "LOBBY",
    createdAt: 100000,
    settings: normalizeSettings(gameId),
    gameState: {},
    players: {
      tv: {
        id: "tv",
        nickname: "電視",
        avatar: "📺",
        role: "display",
        isHost: true,
        isConnected: true,
        isReady: true,
        score: 0,
      },
      ...Object.fromEntries(
        Array.from({ length: count }, (_, i) => {
          const id = `p${i + 1}`;
          return [
            id,
            {
              id,
              nickname: `玩家${i + 1}`,
              avatar: ["🦊", "🐻", "🐼", "🐸"][i % 4],
              role: "player",
              isHost: false,
              isConnected: true,
              isReady: true,
              score: 0,
            },
          ];
        }),
      ),
    },
  };
}

/** Models RTDB's removal of nulls and empty collections, not a live emulator. */
export function databaseRoundTrip<T>(value: T): T {
  const strip = (data: unknown): unknown => {
    if (data == null) return undefined;
    if (Array.isArray(data)) {
      const values = data.map(strip).filter((item) => item !== undefined);
      return values.length ? values : undefined;
    }
    if (typeof data === "object") {
      const entries = Object.entries(data)
        .map(([key, item]) => [key, strip(item)])
        .filter(([, item]) => item !== undefined);
      return entries.length ? Object.fromEntries(entries) : undefined;
    }
    return data;
  };
  return strip(value) as T;
}
