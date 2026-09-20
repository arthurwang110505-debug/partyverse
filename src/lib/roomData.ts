import type { Player, ReactionItem, Room, RoomSettings } from "@/types";
import { normalizeSettings } from "@/constants/gameSettings";
import { arrayValue, normalizeGameState } from "@/engine/state";

/** Normalise whatever the database hands back so a half-written room can't crash the UI. */
export function parseRoom(data: Record<string, unknown> | null, roomCode: string): Room | null {
  if (!data) return null;
  const rawPlayers = (data.players ?? {}) as Record<string, unknown>;
  const cleanPlayers: Record<string, Player> = {};
  if (typeof rawPlayers === "object" && rawPlayers !== null) {
    for (const [id, p] of Object.entries(rawPlayers)) {
      if (p && typeof p === "object") {
        const playerObj = p as Partial<Player>;
        cleanPlayers[id] = {
          id: String(playerObj.id ?? id),
          nickname: String(playerObj.nickname ?? "玩家"),
          avatar: String(playerObj.avatar ?? "👾"),
          isHost: Boolean(playerObj.isHost),
          role: playerObj.role === "display" ? "display" : "player",
          isConnected: playerObj.isConnected !== false,
          isReady: Boolean(playerObj.isReady),
          score: Number(playerObj.score) || 0,
          leftAt: playerObj.leftAt,
        };
      }
    }
  }

  const rawReactions = (data.reactions ?? {}) as Record<string, unknown>;
  const cleanReactions: Record<string, ReactionItem> = {};
  const now = Date.now();
  if (typeof rawReactions === "object" && rawReactions !== null) {
    for (const [id, r] of Object.entries(rawReactions)) {
      if (r && typeof r === "object") {
        const rec = r as Partial<ReactionItem>;
        // Keep reactions active for 6 seconds
        if (now - Number(rec.at || 0) < 6000) {
          cleanReactions[id] = {
            id: String(rec.id ?? id),
            emoji: String(rec.emoji ?? "🎉"),
            nickname: String(rec.nickname ?? "玩家"),
            at: Number(rec.at) || now,
          };
        }
      }
    }
  }

  return {
    id: (data.id as string) || roomCode,
    gameId: (data.gameId as string) || "",
    hostPlayerId: (data.hostPlayerId as string) || "",
    status: (data.status as Room["status"]) || "LOBBY",
    createdAt: (data.createdAt as number) || Date.now(),
    expiresAt: data.expiresAt as number | undefined,
    settings: normalizeSettings(String(data.gameId ?? ""), (data.settings as Partial<RoomSettings>) ?? {}),
    players: cleanPlayers,
    reactions: cleanReactions,
    gameState: normalizeGameState(String(data.gameId ?? ""), data.gameState),
    lastTickAt: data.lastTickAt as number | undefined,
    startedAt: data.startedAt as number | undefined,
    finishedAt: data.finishedAt as number | undefined,
    participantIds:
      data.participantIds == null
        ? undefined
        : arrayValue(data.participantIds).filter((id): id is string => typeof id === "string"),
    contentHistory: (data.contentHistory ?? {}) as Room["contentHistory"],
  };
}
