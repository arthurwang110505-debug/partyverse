"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { useRoom } from "@/providers/RoomContext";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { MAX_NICKNAME_LENGTH, NICKNAME_KEY } from "@/constants/room";
import { sanitizeNickname } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { ErrorNote } from "@/components/ui/ErrorNote";

interface Props {
  roomCode: string;
}

/** The page a scanned QR code lands on: the code is known, only a name is needed. */
export default function JoinRoomClient({ roomCode }: Props) {
  const router = useRouter();
  const { joinRoom } = useRoom();
  const [savedNickname, setSavedNickname] = useLocalStorage(NICKNAME_KEY, "");
  const [nickname, setNickname] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const effectiveNickname = nickname || savedNickname;
  const canSubmit = effectiveNickname.trim().length > 0 && !submitting;

  const handleJoin = async () => {
    if (!canSubmit) return;
    setError("");
    setSubmitting(true);
    try {
      const cleanName = sanitizeNickname(effectiveNickname);
      setSavedNickname(cleanName);
      await joinRoom(roomCode, cleanName);
      router.push(`/room/${roomCode}/play`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加入失敗，請再試一次");
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink p-4 text-white">
      <div className="w-full max-w-sm">
        <Link
          href="/join"
          className="mb-8 inline-flex items-center gap-2 text-sm text-white/40 transition-colors hover:text-white/70"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> 換一間房
        </Link>

        <div className="mb-8 text-center">
          <p className="mb-2 text-5xl font-bold tracking-[0.2em] text-white">{roomCode}</p>
          <p className="text-sm text-white/40">輸入名字就能加入</p>
        </div>

        <form
          className="glass-card space-y-4 rounded-2xl p-6"
          onSubmit={(e) => {
            e.preventDefault();
            void handleJoin();
          }}
        >
          <Field
            label="你的暱稱"
            name="nickname"
            value={effectiveNickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="輸入你的名字…"
            maxLength={MAX_NICKNAME_LENGTH}
            autoComplete="nickname"
            autoFocus
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
