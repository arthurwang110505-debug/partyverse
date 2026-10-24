import type { Player, ReactionItem, Room, RoomSessionEntry, RoomSessionPlan, RoomSettings } from "@/types";
import { normalizeSettings } from "@/constants/gameSettings";
import { isPlayModeId } from "@/constants/playModes";
import { isHostMode } from "@/constants/hostMode";
import { arrayValue, normalizeGameState } from "@/engine/state";

/**
 * Rebuild a randomized party session from storage, dropping anything invalid.
 *
 * RTDB deletes empty arrays, so a completed session (`entries: []`) or a
 * half-written playlist must still parse into something the UI can render.
 */
function parseSessionPlan(raw: unknown): RoomSessionPlan | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const data = raw as Record<string, unknown>;
  const mode = data.mode;
  if (!isPlayModeId(mode)) return undefined;
  const entries: RoomSessionEntry[] = arrayValue(data.entries)
    .map((value): RoomSessionEntry | null => {
      if (!value || typeof value !== "object") return null;
      const entry = value as Partial<RoomSessionEntry>;
      if (typeof entry.gameId !== "string" || !entry.gameId) return null;
      const minutes = Number(entry.minutes);
      return {
        gameId: entry.gameId,
        minutes: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 1,
        settings: normalizeSettings(entry.gameId, (entry.settings as Partial<RoomSettings>) ?? {}),
        ...(entry.repeated ? { repeated: true } : {}),
      };
    })
    .filter((entry): entry is RoomSessionEntry => entry !== null);
  const budgetMinutes = Number(data.budgetMinutes);
  const startedAt = Number(data.startedAt);
  const completedAt = Number(data.completedAt);
  return {
    mode,
    budgetMinutes: Number.isFinite(budgetMinutes) && budgetMinutes > 0 ? Math.round(budgetMinutes) : 3,
    entries,
    played: arrayValue(data.played).filter((id): id is string => typeof id === "string"),
    startedAt: Number.isFinite(startedAt) && startedAt > 0 ? startedAt : Date.now(),
    ...(Number.isFinite(completedAt) && completedAt > 0 ? { completedAt } : {}),
  };
}

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
    sessionPlan: parseSessionPlan(data.sessionPlan),
    // Absent for every room created before phone-host mode: those are TV rooms.
    hostMode: isHostMode(data.hostMode) ? data.hostMode : undefined,
    nextGameVotes:
      data.nextGameVotes && typeof data.nextGameVotes === "object"
        ? Object.fromEntries(
            Object.entries(data.nextGameVotes as Record<string, unknown>).filter(
              (entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string",
            ),
          )
        : undefined,
    privateHost:
      data.privateHost && typeof data.privateHost === "object" && !Array.isArray(data.privateHost)
        ? (data.privateHost as Record<string, unknown>)
        : undefined,
    private:
      data.private && typeof data.private === "object" && !Array.isArray(data.private)
        ? (Object.fromEntries(
            Object.entries(data.private as Record<string, unknown>)
              .filter(([, v]) => v && typeof v === "object" && !Array.isArray(v))
              .map(([id, v]) => [id, v as Record<string, unknown>]),
          ) as Room["private"])
        : undefined,
  };
}
