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
import { MAX_NICKNAME_LENGTH, NICKNAME_KEY } from "@/constants/room";
import type { RoomSettings } from "@/types";
import { sanitizeNickname } from "@/lib/utils";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { ErrorNote } from "@/components/ui/ErrorNote";
import { normalizeSettings } from "@/constants/gameSettings";
import { RoomSettingsFields } from "@/components/game/RoomSettingsFields";

interface Props {
  gameId: string;
}

export default function CreateRoomClient({ gameId }: Props) {
  const router = useRouter();
  const { createRoom, isLocalMode } = useRoom();
  const game = GAMES.find((g) => g.id === gameId);

  const [savedNickname, setSavedNickname] = useLocalStorage(NICKNAME_KEY, "");
  const [nickname, setNickname] = useState("");
  const [settings, setSettings] = useState<RoomSettings>(() => normalizeSettings(gameId));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!game) {
    return <main className="flex min-h-screen items-center justify-center bg-ink text-white/50">找不到這個遊戲</main>;
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
            label="房主暱稱（顯示在電視上）"
            name="nickname"
            value={effectiveNickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="輸入你的名字…"
            maxLength={MAX_NICKNAME_LENGTH}
            autoComplete="nickname"
            autoFocus
          />

          <p className="text-sm leading-relaxed text-white/65">
            此裝置作為電視主畫面，不占玩家名額。房主想參賽，也請用手機掃碼加入。
          </p>
          <RoomSettingsFields
            gameId={gameId}
            settings={settings}
            onChange={(patch) => setSettings((current) => ({ ...current, ...patch }))}
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
              本地展示模式：只限同一瀏覽器的一般分頁。跨手機連線需要設定 Firebase，無痕視窗不共用房間。
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
