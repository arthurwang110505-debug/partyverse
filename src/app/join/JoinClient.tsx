"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { useRoom } from "@/providers/RoomContext";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { NICKNAME_KEY, MAX_NICKNAME_LENGTH, ROOM_CODE_LENGTH } from "@/constants/room";
import { normalizeRoomCode, sanitizeNickname } from "@/lib/utils";
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
      // Straight into the room. The old flow pushed to /join/[code], which
      // rendered a second nickname form for a player who had already joined.
      router.push(`/room/${roomCode}/play`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加入房間失敗，請再試一次");
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink p-4 text-white">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-white/40 transition-colors hover:text-white/70"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> 返回首頁
        </Link>

        <h1 className="mb-2 text-2xl font-bold">加入派對</h1>
        <p className="mb-8 text-sm text-white/40">輸入房主給你的房間代碼</p>

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

          <Button type="submit" variant="ghost" size="md" disabled={!canSubmit} className="w-full">
            <Users className="h-4 w-4" aria-hidden="true" />
            {submitting ? "加入中…" : "加入派對"}
          </Button>
        </form>
      </div>
    </main>
  );
}
