import { get, ref, runTransaction, type Database } from "firebase/database";
import type { Player } from "@/types";
import { GAMES } from "@/constants/games";
import { isParticipant } from "@/engine/participants";
import { pickAvatar } from "@/lib/utils";

/** How long a single Firebase round-trip may take before we give up. */
const JOIN_TIMEOUT_MS = 7000;

export type FirebaseJoinOutcome =
  | { outcome: "joined" }
  | { outcome: "not-found" }
  | { outcome: "full" }
  | { outcome: "error"; error: Error };

function maxPlayersFor(gameId: string): number {
  return GAMES.find((g) => g.id === gameId)?.maxPlayers ?? 20;
}

function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(errorMsg)), ms);
    promise.then(
      (res) => {
        clearTimeout(timer);
        resolve(res);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/** Translate raw RTDB errors into messages that point at the real cause. */
function toJoinError(err: unknown): Error {
  const code = (err as { code?: string } | null)?.code ?? "";
  const message = err instanceof Error ? err.message : String(err);
  if (code.includes("permission") || message.includes("permission_denied")) {
    return new Error("無法讀取房間：資料庫安全規則拒絕存取（請確認 Realtime Database 規則允許 rooms 的讀寫）");
  }
  if (code.includes("unavailable") || message.includes("network")) {
    return new Error("暫時連不上房間伺服器，請確認網路後再試一次");
  }
  return new Error("加入房間失敗，請確認網路連線後再試一次");
}

/**
 * Atomically add a player to a Firebase room.
 *
 * Why the `get()` first? RTDB transactions run their update function against
 * the LOCAL cache before ever talking to the server, and returning `undefined`
 * from it aborts the transaction immediately WITHOUT a server round-trip. On a
 * fresh client that never subscribed to `rooms/{code}`, the cache is `null` —
 * so a transaction that aborts on `current === null` fails 100% of the time
 * ("找不到這個房間") even when the room exists on the server. Reading the node
 * first (a) verifies the room against the server and (b) warms the cache so
 * the transaction's first run sees the real value.
 */
export async function joinRoomOnFirebase(
  database: Database,
  roomCode: string,
  playerId: string,
  nickname: string,
): Promise<FirebaseJoinOutcome> {
  const roomRef = ref(database, `rooms/${roomCode}`);

  // Step 1 — existence check against the server (also warms the local cache).
  let roomExists: boolean;
  try {
    const snap = await withTimeout(get(roomRef), JOIN_TIMEOUT_MS, "加入房間連線逾時，請確認網路後再試一次");
    roomExists = snap.exists();
  } catch (err) {
    return { outcome: "error", error: toJoinError(err) };
  }
  if (!roomExists) return { outcome: "not-found" };

  // Step 2 — the atomic join. The null-abort below is now only a safety net for
  // the tiny race where the room is deleted between Step 1 and this write;
  // because the cache is warm, an abort here genuinely reflects server state.
  try {
    const result = await withTimeout(
      runTransaction(roomRef, (current): Record<string, unknown> | undefined => {
        if (current === null) return undefined; // room vanished mid-join
        const room = current as Record<string, unknown>;
        const players = (room.players ?? {}) as Record<string, Player>;
        const existing = players[playerId];
        if (!existing && Object.values(players).filter(isParticipant).length >= maxPlayersFor(String(room.gameId))) {
          throw new Error("__ROOM_FULL__");
        }
        const avatar =
          existing?.avatar ??
          pickAvatar(
            nickname,
            Object.values(players).map((p) => p.avatar),
          );
        return {
          ...room,
          players: {
            ...players,
            [playerId]: {
              id: playerId,
              nickname,
              avatar,
              isHost: Boolean(existing?.isHost),
              role: existing?.role ?? "player",
              isConnected: true,
              isReady: Boolean(existing?.isReady),
              score: existing?.score ?? 0,
            } satisfies Player,
          },
        };
      }),
      JOIN_TIMEOUT_MS,
      "加入房間連線逾時，請確認網路後再試一次",
    );

    if (result.committed && result.snapshot.val() !== null) return { outcome: "joined" };
    // Aborted against server state (room deleted after Step 1).
    return { outcome: "not-found" };
  } catch (err) {
    if (err instanceof Error && err.message === "__ROOM_FULL__") {
      return { outcome: "full" };
    }
    return { outcome: "error", error: toJoinError(err) };
  }
}
