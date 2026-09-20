"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Crown } from "lucide-react";
import { useRoom } from "@/providers/RoomContext";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { addRecentRoom } from "@/hooks/useRecentRooms";
import { GAMES } from "@/constants/games";
import { DEFAULT_ROOM_SETTINGS, MAX_NICKNAME_LENGTH, NICKNAME_KEY } from "@/constants/room";
import type { RoomSettings } from "@/types";
import { sanitizeNickname } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { ErrorNote } from "@/components/ui/ErrorNote";
import { cn } from "@/lib/utils";

interface Props {
  gameId: string;
}

const DIFFICULTIES: Array<{ value: RoomSettings["difficulty"]; label: string; hint: string }> = [
  { value: "easy", label: "輕鬆", hint: "時間長、題目簡單" },
  { value: "medium", label: "普通", hint: "標準節奏" },
  { value: "hard", label: "地獄", hint: "時間短、題目多" },
];

export default function CreateRoomClient({ gameId }: Props) {
  const router = useRouter();
  const { createRoom, isLocalMode } = useRoom();
  const game = GAMES.find((g) => g.id === gameId);

  const [savedNickname, setSavedNickname] = useLocalStorage(NICKNAME_KEY, "");
  const [nickname, setNickname] = useState("");
  const [settings, setSettings] = useState<RoomSettings>(DEFAULT_ROOM_SETTINGS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!game) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink text-white/50">找不到這個遊戲</main>
    );
  }

  const rawNickname = nickname || (typeof savedNickname === "string" ? savedNickname : String(savedNickname ?? ""));
  const effectiveNickname = typeof rawNickname === "string" ? rawNickname : String(rawNickname);
  const canSubmit = effectiveNickname.trim().length > 0 && !submitting;

  const handleCreate = async () => {
    if (!canSubmit) return;
    setError("");
    setSubmitting(true);
    try {
      const cleanName = sanitizeNickname(effectiveNickname);
      setSavedNickname(cleanName);
      const roomCode = await createRoom(game.id, cleanName, settings);
      addRecentRoom({ code: roomCode, nickname: cleanName, role: "host" });
      router.push(`/room/${roomCode}/host`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "建立房間失敗，請再試一次");
      setSubmitting(false);
    }
  };

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-ink px-4 py-28 text-white"
      style={{ "--game-accent": game.color, "--game-gradient": game.gradient } as CSSProperties}
    >
      <Navbar />
      <div className="w-full max-w-md">
        <Link
          href={`/games/${game.id}`}
          className="mb-8 inline-flex items-center gap-2 text-sm text-white/40 transition-colors hover:text-white/70"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> 返回遊戲介紹
        </Link>

        <motion.header initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="mb-2 flex items-center gap-3 text-2xl font-bold">
            <span aria-hidden="true" className="text-3xl">
              {game.icon}
            </span>
            {game.name}
          </h1>
          <p lang="en" className="text-sm text-white/40">
            {game.nameEn}
          </p>
        </motion.header>

        <form
          className="glass-card space-y-5 rounded-2xl p-6"
          onSubmit={(e) => {
            e.preventDefault();
            void handleCreate();
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

          <fieldset>
            <legend className="mb-2 block text-sm font-medium text-white/60">難度</legend>
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTIES.map((option) => {
                const active = settings.difficulty === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSettings((s) => ({ ...s, difficulty: option.value }))}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-center transition-all",
                      active
                        ? "border-violet-500/50 bg-violet-500/20 text-white"
                        : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10",
                    )}
                  >
                    <span className="block text-sm font-medium">{option.label}</span>
                    <span className="mt-0.5 block text-[10px] text-white/40">{option.hint}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <Field
            label="每題秒數"
            name="timer"
            type="number"
            min={3}
            max={60}
            value={settings.timer}
            onChange={(e) =>
              setSettings((s) => ({ ...s, timer: Math.min(60, Math.max(3, Number(e.target.value) || s.timer)) }))
            }
            inputMode="numeric"
          />

          <ErrorNote>{error}</ErrorNote>

          <Button
            type="submit"
            variant="accent"
            size="md"
            disabled={!canSubmit}
            loading={submitting}
            className="w-full"
          >
            {submitting ? (
              "建立房間中…"
            ) : (
              <>
                <Crown className="h-4 w-4" aria-hidden="true" /> 建立房間
              </>
            )}
          </Button>

          {isLocalMode && (
            <p className="text-center text-xs text-cyan-400/70">
              💡 本地展示模式：建立後可開啟另一個瀏覽器視窗/無痕分頁加入同樂
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
