"use client";

import type { Room } from "@/types";

const LOCAL_STORAGE_PREFIX = "partyverse_room_";
const LOCAL_USER_KEY = "partyverse_local_uid";

/** One controller identity per tab; refreshing keeps it, a new tab gets its own. */
export function getLocalUserId(previousSessionId?: string): string {
  if (typeof window === "undefined") return "local-server-user";
  try {
    let uid = window.sessionStorage.getItem(LOCAL_USER_KEY);
    if (!uid) {
      uid = previousSessionId || "demo-" + Math.random().toString(36).substring(2, 10);
      window.sessionStorage.setItem(LOCAL_USER_KEY, uid);
    }
    return uid;
  } catch {
    return "demo-" + Math.random().toString(36).substring(2, 10);
  }
}

export function getLocalRoom(roomCode: string): Room | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${roomCode.toUpperCase()}`);
    if (!raw) return null;
    return JSON.parse(raw) as Room;
  } catch {
    return null;
  }
}

// In-memory bus for same-tab updates
type Listener = (room: Room | null) => void;
const listeners = new Map<string, Set<Listener>>();

function notifyLocal(roomCode: string, room: Room | null) {
  const code = roomCode.toUpperCase();
  const set = listeners.get(code);
  if (set) {
    set.forEach((listener) => {
      listener(room);
    });
  }
}

export function saveLocalRoom(room: Room): void {
  if (typeof window === "undefined") return;
  const code = room.id.toUpperCase();
  try {
    window.localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${code}`, JSON.stringify(room));
  } catch {
    // Quota exceeded
  }
  notifyLocal(code, room);

  // Broadcast to other tabs
  if (typeof BroadcastChannel !== "undefined") {
    try {
      const bc = new BroadcastChannel(`partyverse_bc_${code}`);
      bc.postMessage({ type: "SYNC", room });
      bc.close();
    } catch {
      // BroadcastChannel unavailable
    }
  }
}

export function deleteLocalRoom(roomCode: string): void {
  if (typeof window === "undefined") return;
  const code = roomCode.toUpperCase();
  try {
    window.localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}${code}`);
  } catch {
    // ignore
  }
  notifyLocal(code, null);

  if (typeof BroadcastChannel !== "undefined") {
    try {
      const bc = new BroadcastChannel(`partyverse_bc_${code}`);
      bc.postMessage({ type: "DELETE" });
      bc.close();
    } catch {
      // ignore
    }
  }
}

export function subscribeLocalRoom(roomCode: string, callback: Listener): () => void {
  if (typeof window === "undefined") return () => {};
  const code = roomCode.toUpperCase();

  // 1. Same-tab listener
  if (!listeners.has(code)) {
    listeners.set(code, new Set());
  }
  listeners.get(code)!.add(callback);

  // Initial trigger
  callback(getLocalRoom(code));

  // 2. Cross-tab BroadcastChannel
  let bc: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== "undefined") {
    try {
      bc = new BroadcastChannel(`partyverse_bc_${code}`);
      bc.onmessage = (event) => {
        if (event.data?.type === "SYNC") {
          callback(event.data.room as Room);
        } else if (event.data?.type === "DELETE") {
          callback(null);
        }
      };
    } catch {
      // BroadcastChannel not available
    }
  }

  // 3. Fallback Storage event
  const onStorage = (e: StorageEvent) => {
    if (e.key === `${LOCAL_STORAGE_PREFIX}${code}`) {
      if (!e.newValue) {
        callback(null);
      } else {
        try {
          callback(JSON.parse(e.newValue) as Room);
        } catch {
          callback(null);
        }
      }
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.get(code)?.delete(callback);
    if (listeners.get(code)?.size === 0) {
      listeners.delete(code);
    }
    if (bc) {
      bc.close();
    }
    window.removeEventListener("storage", onStorage);
  };
}

/** Serialize read-modify-write operations across same-browser demo tabs. */
export async function updateLocalRoom(roomCode: string, apply: (room: Room) => Room | null): Promise<Room | null> {
  const update = () => {
    const current = getLocalRoom(roomCode);
    if (!current) return null;
    const next = apply(current);
    if (next) saveLocalRoom(next);
    return next;
  };
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request(`partyverse-room-${roomCode}`, update);
  }
  return update();
}
