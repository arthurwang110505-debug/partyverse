"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Crown, History, Users } from "lucide-react";
import { useRoom } from "@/providers/RoomContext";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { addRecentRoom, relativeTime, useRecentRooms } from "@/hooks/useRecentRooms";
import { NICKNAME_KEY, MAX_NICKNAME_LENGTH, ROOM_CODE_LENGTH } from "@/constants/room";
import { normalizeRoomCode, sanitizeNickname } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { ErrorNote } from "@/components/ui/ErrorNote";

export default function JoinClient() {
  const router = useRouter();
  const { joinRoom } = useRoom();
  const [roomCode, setRoomCode] = useState("");
  const [savedNickname, setSavedNickname] = useLocalStorage(NICKNAME_KEY, "");
  const [nickname, setNickname] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const recentRooms = useRecentRooms();

  // Pre-fill from the last visit once localStorage has hydrated.
  const effectiveNickname = nickname || savedNickname;
  const canSubmit = roomCode.length === ROOM_CODE_LENGTH && effectiveNickname.trim().length > 0 && !submitting;

  const handleJoin = async () => {
    if (!canSubmit) return;
    setError("");
    setSubmitting(true);
    try {
      const cleanName = sanitizeNickname(effectiveNickname);
      setSavedNickname(cleanName);
      await joinRoom(roomCode, cleanName);
      addRecentRoom({ code: roomCode, nickname: cleanName, role: "player" });
      router.push(`/room/${roomCode}/play`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加入房間失敗，請再試一次");
      setSubmitting(false);
    }
  };

  /** One-tap comeback: the common path after an accidental refresh or swipe-out. */
  const handleRejoin = async (code: string, name: string) => {
    setError("");
    setSubmitting(true);
    try {
      await joinRoom(code, name);
      addRecentRoom({ code, nickname: name, role: "player" });
      router.push(`/room/${code}/play`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "這間房可能已經結束了");
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink p-4 pt-28 text-white">
      <Navbar />
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="mb-2 text-2xl font-bold">加入派對</h1>
          <p className="text-sm text-white/40">輸入房主給你的房間代碼</p>
        </div>

        <form
          className="glass-card space-y-4 rounded-2xl p-6"
          onSubmit={(e) => {
            e.preventDefault();
            void handleJoin();
          }}
        >
          <Field
            label="房間代碼"
            name="roomCode"
            value={roomCode}
            onChange={(e) => setRoomCode(normalizeRoomCode(e.target.value))}
            placeholder="ABCDE"
            maxLength={ROOM_CODE_LENGTH}
            autoComplete="off"
            inputMode="text"
            inputClassName="text-center text-2xl font-bold tracking-[0.3em] uppercase"
            hint={`${ROOM_CODE_LENGTH} 位英數字，不含 0/O、1/I/L`}
          />

          <Field
            label="你的暱稱"
            name="nickname"
            value={effectiveNickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="輸入你的名字…"
            maxLength={MAX_NICKNAME_LENGTH}
            autoComplete="nickname"
          />

          <ErrorNote>{error}</ErrorNote>

          <Button type="submit" variant="accent" size="md" disabled={!canSubmit} loading={submitting} className="w-full">
            <Users className="h-4 w-4" aria-hidden="true" />
            {submitting ? "加入中…" : "加入派對"}
          </Button>
        </form>

        {recentRooms.length > 0 && (
          <section className="mt-6" aria-labelledby="recent-rooms-heading">
            <h2
              id="recent-rooms-heading"
              className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/40"
            >
              <History className="h-3.5 w-3.5" aria-hidden="true" />
              最近加入的房間
            </h2>
            <ul className="space-y-2">
              {recentRooms.map((r) => (
                <li key={`${r.code}-${r.role}`}>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() =>
                      r.role === "host"
                        ? router.push(`/room/${r.code}/host`)
                        : void handleRejoin(r.code, r.nickname)
                    }
                    className="glass flex w-full items-center gap-3 rounded-xl border border-white/10 px-4 py-3 text-left transition-all hover:bg-white/10 disabled:opacity-50"
                  >
                    <span className="text-base font-bold tracking-widest text-violet-300">{r.code}</span>
                    <span className="flex-1 truncate text-sm text-white/60">
                      {r.role === "host" ? (
                        <span className="inline-flex items-center gap-1">
                          <Crown className="h-3 w-3 text-yellow-400" aria-label="你是房主" />
                          以房主身份返回
                        </span>
                      ) : (
                        `以「${r.nickname}」重新加入`
                      )}
                    </span>
                    <span className="text-xs text-white/40">{relativeTime(r.at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
