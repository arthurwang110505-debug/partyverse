"use client";

import { useEffect, useState } from "react";

/**
 * "最近加入的房間" — one-tap rejoin on /join.
 *
 * Party sessions drop constantly (accidental refresh, swipe-back, phone lock).
 * Persist the last few rooms with the name used and which side of the screen
 * the person was on, so rejoining is one tap instead of re-typing everything.
 */

export interface RecentRoom {
  code: string;
  nickname: string;
  role: "host" | "player";
  at: number;
}

const KEY = "partyverse_recent_rooms";
const MAX_ENTRIES = 3;

export function readRecentRooms(): RecentRoom[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is RecentRoom =>
        typeof r === "object" && r !== null && typeof (r as RecentRoom).code === "string" &&
        typeof (r as RecentRoom).nickname === "string",
    );
  } catch {
    return [];
  }
}

/** Call after a successful create/join. Dedupes by code+role, newest first. */
export function addRecentRoom(entry: Omit<RecentRoom, "at">): void {
  try {
    const list = readRecentRooms().filter((r) => !(r.code === entry.code && r.role === entry.role));
    list.unshift({ ...entry, at: Date.now() });
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)));
  } catch {
    // Storage unavailable — rejoin simply won't be offered.
  }
}

/** Hydrates after mount so server HTML and first client paint stay identical. */
export function useRecentRooms(): RecentRoom[] {
  const [rooms, setRooms] = useState<RecentRoom[]>([]);
  useEffect(() => setRooms(readRecentRooms()), []);
  return rooms;
}

/** Rough zh-Hant relative time for the rejoin list ("12 分鐘前"). */
export function relativeTime(at: number): string {
  const minutes = Math.max(1, Math.round((Date.now() - at) / 60_000));
  if (minutes < 60) return `${minutes} 分鐘前`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;
  return `${Math.min(7, Math.round(hours / 24))} 天前`;
}
