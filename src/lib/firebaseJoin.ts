import { onValue, ref, runTransaction, type Database, type DataSnapshot } from "firebase/database";
import type { Player } from "@/types";
import { GAMES } from "@/constants/games";
import { isParticipant } from "@/engine/participants";
import { pickAvatar } from "@/lib/utils";

/** How long a single Firebase round-trip may take before we give up. */
const JOIN_TIMEOUT_MS = 7000;

export type FirebaseJoinOutcome =
  { outcome: "joined" } | { outcome: "not-found" } | { outcome: "full" } | { outcome: "error"; error: Error };

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
  const code = String((err as { code?: string } | null)?.code ?? "").toLowerCase();
  const message = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (code.includes("permission") || message.includes("permission_denied")) {
    return new Error("房間存取遭 Firebase 安全規則拒絕，並非房間代碼錯誤。請房主確認規則允許新玩家加入房間。");
  }
  if (message.includes("逾時")) return new Error("加入房間連線逾時，請確認網路後再試一次");
  if (code.includes("unavailable") || message.includes("network")) {
    return new Error("暫時連不上房間伺服器，請確認網路後再試一次");
  }
  return new Error("加入房間失敗，請確認網路連線後再試一次");
}

/**
 * Keep a live subscription until the join transaction has settled.
 * Firebase's get() removes its temporary event registration before resolving;
 * without another listener its snapshot is NOT retained for runTransaction().
 * A new device therefore sees null and aborts locally even after a successful
 * get(). A persistent onValue listener pins the room's cache through the write.
 * Never seed a transaction with an old snapshot: that could resurrect a room
 * deleted during the join or overwrite a concurrent join.
 */
export async function joinRoomOnFirebase(
  database: Database,
  roomCode: string,
  playerId: string,
  nickname: string,
): Promise<FirebaseJoinOutcome> {
  const roomRef = ref(database, `rooms/${roomCode.trim().toUpperCase()}`);
  let unsubscribe: (() => void) | undefined;
  let expired = false;
  let abortReason: "full" | "not-found" = "not-found";
  try {
    const snapshot = await withTimeout(
      new Promise<DataSnapshot>((resolve, reject) => {
        // Do not use onlyOnce: it releases the cache before the transaction.
        unsubscribe = onValue(roomRef, resolve, reject);
      }),
      JOIN_TIMEOUT_MS,
      "加入房間連線逾時，請確認網路後再試一次",
    );
    if (!snapshot.exists()) return { outcome: "not-found" };

    const result = await withTimeout(
      runTransaction(
        roomRef,
        (current): Record<string, unknown> | undefined => {
          abortReason = "not-found";
          if (expired || current === null) return undefined; // room vanished mid-join
          const room = current as Record<string, unknown>;
          const players = (room.players ?? {}) as Record<string, Player>;
          const existing = players[playerId];
          if (!existing && Object.values(players).filter(isParticipant).length >= maxPlayersFor(String(room.gameId))) {
            abortReason = "full";
            return undefined;
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
        },
        { applyLocally: false },
      ),
      JOIN_TIMEOUT_MS,
      "加入房間連線逾時，請確認網路後再試一次",
    );

    if (result.committed && result.snapshot.val() !== null) return { outcome: "joined" };
    return { outcome: abortReason };
  } catch (err) {
    expired = true; // A delayed transaction retry must not add a player after timeout.
    return { outcome: "error", error: toJoinError(err) };
  } finally {
    unsubscribe?.();
  }
}
