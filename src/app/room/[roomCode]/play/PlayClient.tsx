"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock, Crown, Sparkles } from "lucide-react";
import { useRoom } from "@/providers/RoomContext";
import { GAMES } from "@/constants/games";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConnectionBadge } from "@/components/game/ConnectionBadge";
import { FloatingReactions } from "@/components/game/FloatingReactions";
import { vibrate } from "@/lib/sound";
import { cn } from "@/lib/utils";

interface Props {
  roomCode: string;
}

const REACTIONS = ["🎉", "🔥", "👑", "💩", "❤️", "🤣"];

/** A player's interactive holding screen while waiting in the lobby. */
export default function PlayClient({ roomCode }: Props) {
  const router = useRouter();
  const { room, player, leaveRoom, toggleReady, sendReaction } = useRoom();
  const [confirmLeave, setConfirmLeave] = useState(false);

  const game = GAMES.find((g) => g.id === room?.gameId);
  const playerList = Object.values(room?.players ?? {});
  const onlineCount = playerList.filter((p) => p.isConnected).length;
  const isReady = Boolean(player?.isReady);

  const handleToggleReady = async () => {
    vibrate(25);
    await toggleReady();
  };

  const handleReaction = async (emoji: string) => {
    vibrate(12);
    await sendReaction(emoji);
  };

  const handleConfirmLeave = async () => {
    await leaveRoom();
    router.push("/");
  };

  return (
    <main className="relative min-h-[100dvh] bg-ink px-safe pb-safe pt-4 text-white">
      <FloatingReactions />

      <div className="relative z-10 mx-auto flex min-h-[92dvh] max-w-md flex-col">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setConfirmLeave(true)}
            aria-label="離開房間"
            className="glass rounded-xl p-2.5 transition-all hover:bg-white/10 active:scale-95"
          >
            <ArrowLeft className="h-5 w-5 text-white/70" aria-hidden="true" />
          </button>
          <div className="text-center">
            <p className="mb-0.5 text-[10px] uppercase tracking-wider text-white/40">房間代碼</p>
            <p className="text-xl font-bold tracking-widest text-violet-300">{roomCode}</p>
          </div>
          <ConnectionBadge className="text-[10px] px-2 py-0.5" />
        </div>

        {/* Game Info Card */}
        {game && (
          <div className="glass-card mb-4 rounded-2xl border border-white/10 p-4 text-center sm:p-5">
            <span className="mb-2 inline-block text-4xl" aria-hidden="true">
              {game.icon}
            </span>
            <h1 className="mb-0.5 text-xl font-bold">{game.name}</h1>
            <p lang="en" className="text-xs text-white/40 mb-2">
              {game.nameEn}
            </p>
            <p className="text-xs text-white/60 line-clamp-2">{game.description}</p>
          </div>
        )}

        {/* Player Identity Card */}
        {player && (
          <div className="glass mb-4 flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 p-4">
            <span className="text-3xl" aria-hidden="true">
              {player.avatar}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-2 font-semibold">
                {player.nickname}
                {player.isHost && <Crown className="h-4 w-4 text-yellow-400" aria-label="房主" />}
              </span>
              <span className="text-xs text-white/40">{player.isHost ? "我是房主" : "我是玩家"}</span>
            </span>
            <span
              className={cn("h-2.5 w-2.5 rounded-full", player.isConnected ? "bg-emerald-400" : "bg-red-500")}
              aria-label={player.isConnected ? "在線" : "離線"}
            />
          </div>
        )}

        {/* Tactile Ready Toggle (for non-hosts) */}
        {!player?.isHost && (
          <div className="mb-6">
            <button
              type="button"
              onClick={() => void handleToggleReady()}
              className={cn(
                "w-full rounded-2xl p-4 text-center font-bold text-base transition-all duration-200 active:scale-95 shadow-xl flex items-center justify-center gap-2.5 border",
                isReady
                  ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 ring-2 ring-emerald-500/30"
                  : "bg-gradient-to-r from-violet-600 to-pink-600 border-white/20 text-white hover:brightness-110",
              )}
            >
              {isReady ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" aria-hidden="true" />
                  已就緒！等待房主開始…
                </>
              ) : (
                <>
                  <Clock className="h-5 w-5 text-white/70" aria-hidden="true" />
                  點擊確認準備就緒 (Ready)
                </>
              )}
            </button>
            <p className="mt-2 text-center text-xs text-white/40">
              {isReady ? "點擊可取消就緒狀態" : "確認暱稱無誤後，請按就緒讓房主知道！"}
            </p>
          </div>
        )}

        {/* Waiting Status */}
        <section className="flex-1 flex flex-col items-center justify-center py-6 text-center" role="status">
          <p className="mb-2 text-4xl animate-bounce" aria-hidden="true">
            📺
          </p>
          <h2 className="mb-1 text-lg font-bold">請看電視大螢幕</h2>
          <p className="text-xs text-white/50 max-w-xs">
            目前 {onlineCount} 人在線
            {game ? `（最少 ${game.minPlayers} 人開局）` : ""}，等待房主開啟遊戲！
          </p>
        </section>

        {/* Reaction Bar */}
        <div className="mt-auto pt-4 pb-2">
          <p className="mb-2 text-center text-xs text-white/40 flex items-center justify-center gap-1">
            <Sparkles className="h-3 w-3 text-pink-400" aria-hidden="true" />
            點擊表情，發送即時氣氛到大螢幕：
          </p>
          <div className="grid grid-cols-3 gap-2 min-[380px]:grid-cols-6">
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => void handleReaction(emoji)}
                className="glass rounded-xl py-2.5 text-2xl transition-all hover:bg-white/15 active:scale-90 select-none"
                aria-label={`發送 ${emoji} 表情`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Confirm Leave Modal */}
      <Modal open={confirmLeave} onClose={() => setConfirmLeave(false)} title="確定要離開房間嗎？" role="alertdialog">
        <p className="mb-6 text-sm text-white/60">離開後你的名額將會釋出，需要重新輸入代碼才能加入。</p>
        <div className="flex flex-col gap-2 min-[380px]:flex-row">
          <Button variant="ghost" size="md" className="min-w-0 flex-1" onClick={() => setConfirmLeave(false)}>
            留下
          </Button>
          <Button variant="danger" size="md" className="min-w-0 flex-1" onClick={() => void handleConfirmLeave()}>
            離開房間
          </Button>
        </div>
      </Modal>
    </main>
  );
}
