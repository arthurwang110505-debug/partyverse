"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Gamepad2, Home, RotateCcw, Sparkles } from "lucide-react";
import { useRoom } from "@/providers/RoomContext";
import { GAMES } from "@/constants/games";
import { isPlayable } from "@/engine";
import type { Achievement } from "@/types";
import type { BombGameState } from "@/engine/bombCountdown";
import { Button, LinkButton } from "@/components/ui/Button";
import { ErrorNote } from "@/components/ui/ErrorNote";
import { Modal } from "@/components/ui/Modal";
import { Confetti } from "@/components/game/Confetti";
import { FloatingReactions } from "@/components/game/FloatingReactions";
import { useCountUp } from "@/hooks/useCountUp";
import { vibrate } from "@/lib/sound";
import { cn, formatTime } from "@/lib/utils";

interface Props {
  roomCode: string;
}

interface RankedPlayer {
  id: string;
  nickname: string;
  avatar: string;
  isHost: boolean;
  isMe: boolean;
  score: number;
}

const MEDALS = ["🥇", "🥈", "🥉"];
const PODIUM_ORDER = [1, 0, 2];
const REACTIONS = ["🎉", "👑", "🔥", "💩", "👏", "❤️"];

/** Podium score with a count-up entrance animation. */
function AnimatedScore({ value, className }: { value: number; className?: string }) {
  const animated = useCountUp(value);
  return (
    <p className={cn("text-sm font-bold tabular-nums", className)}>
      {animated} 分
    </p>
  );
}

export default function ResultsClient({ roomCode }: Props) {
  const router = useRouter();
  const { room, player, isHost, endRound, endRoom, switchGame, sendReaction } = useRoom();
  const [error, setError] = useState("");
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [copiedScores, setCopiedScores] = useState(false);

  const game = GAMES.find((g) => g.id === room?.gameId);
  const state = room?.gameState as (BombGameState & { achievements?: Achievement[] }) | undefined;

  const ranked = useMemo<RankedPlayer[]>(() => {
    if (!room) return [];
    const scores = state?.currentScores ?? {};
    return Object.entries(room.players)
      .map(([id, p]) => ({
        id,
        nickname: p.nickname,
        avatar: p.avatar,
        isHost: p.isHost,
        isMe: id === player?.id,
        score: scores[id] ?? 0,
      }))
      .sort((a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname));
  }, [room, state?.currentScores, player?.id]);

  const podium = PODIUM_ORDER.map((i) => ranked[i]).filter(Boolean) as RankedPlayer[];
  const achievements = state?.achievements ?? [];
  const elapsed = room?.startedAt ? Math.round((Date.now() - room.startedAt) / 1000) : null;

  const totalScore = ranked.reduce((sum, r) => sum + r.score, 0);
  const leader = ranked[0];

  const handleEnd = async () => {
    try {
      await endRoom();
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "無法結束房間");
      setConfirmingEnd(false);
    }
  };

  const handleSwitchGame = async (targetGameId: string) => {
    try {
      await switchGame(targetGameId);
      setShowSwitchModal(false);
      router.push(`/room/${roomCode}/host`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "切換遊戲失敗");
    }
  };

  const handleCopyScores = async () => {
    if (ranked.length === 0) return;
    vibrate(15);
    const lines = [
      `🏆 PARTYVERSE 派對排行榜 · ${game?.name ?? "遊戲"}`,
      `房間代碼：${roomCode}`,
      `------------------------`,
      ...ranked.map((r, i) => `${i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`} ${r.avatar} ${r.nickname}：${r.score} 分`),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopiedScores(true);
      setTimeout(() => setCopiedScores(false), 2000);
    } catch {
      setError("無法複製戰績");
    }
  };

  const handleReaction = async (emoji: string) => {
    vibrate(12);
    await sendReaction(emoji);
  };

  if (!room) return null;

  const playableGames = GAMES.filter((g) => isPlayable(g.id) && g.id !== room.gameId);

  return (
    <main
      className="min-h-[100dvh] bg-ink p-4 pb-safe text-white relative"
      style={{ "--game-accent": game?.color, "--game-gradient": game?.gradient } as CSSProperties}
    >
      <Confetti />
      <FloatingReactions />

      <div className="mx-auto max-w-lg pt-8 relative z-10">
        <header className="mb-8 text-center">
          <p className="mb-4 text-5xl animate-bounce" aria-hidden="true">
            🏆
          </p>
          <h1 className="mb-2 text-3xl font-black tracking-tight">遊戲結算</h1>
          {game && (
            <p className="text-sm text-white/50">
              <span aria-hidden="true">{game.icon}</span> {game.name}
              {elapsed !== null && <span> · 歷時 {formatTime(elapsed)}</span>}
            </p>
          )}
        </header>

        {ranked.length > 0 && (
          <section className="mb-6 grid grid-cols-4 gap-2" aria-label="本局回顧">
            {[
              { value: String(ranked.length), label: "位玩家" },
              { value: String(state?.totalRounds ?? "—"), label: "回合" },
              { value: String(leader?.score ?? 0), label: "最高分" },
              { value: String(totalScore), label: "總得分" },
            ].map((stat) => (
              <div key={stat.label} className="glass rounded-xl border border-white/10 p-3 text-center">
                <p className="text-lg font-bold tabular-nums">{stat.value}</p>
                <p className="text-[11px] text-white/40">{stat.label}</p>
              </div>
            ))}
          </section>
        )}

        {/* Podium Display */}
        {ranked.length > 0 && (
          <section className="mb-8 flex h-48 items-end justify-center gap-3" aria-label="前三名領獎台">
            {podium.map((entry, visualIndex) => {
              const place = PODIUM_ORDER[visualIndex];
              const podiumStyles = [
                "h-20 w-24 border-yellow-500/30 bg-gradient-to-t from-yellow-500/20 to-yellow-500/5 shadow-lg",
                "h-14 w-20 border-white/10 bg-white/5 shadow",
                "h-10 w-20 border-white/10 bg-white/5 shadow",
              ];
              return (
                <div key={entry.id} className="flex flex-col items-center">
                  <p className="mb-1 text-2xl" aria-hidden="true">
                    {MEDALS[place]}
                  </p>
                  <p className={cn("mb-1", place === 0 ? "text-4xl animate-bounce" : "text-2xl")} aria-hidden="true">
                    {entry.avatar}
                  </p>
                  <p
                    className={cn(
                      "max-w-[100px] truncate text-center font-bold",
                      place === 0 ? "text-sm text-yellow-300" : "text-xs text-white/80",
                    )}
                  >
                    {entry.nickname}
                  </p>
                  <AnimatedScore
                    value={entry.score}
                    className={
                      place === 0 ? "text-yellow-400 font-extrabold" : place === 1 ? "text-cyan-400" : "text-orange-400"
                    }
                  />
                  <p
                    className={cn(
                      "flex items-end justify-center rounded-t-xl border pb-2 text-lg font-bold",
                      podiumStyles[place],
                    )}
                    aria-label={`第 ${place + 1} 名`}
                  >
                    <span aria-hidden="true">{place + 1}</span>
                  </p>
                </div>
              );
            })}
          </section>
        )}

        {/* Full Rankings */}
        {ranked.length > 0 && (
          <section className="glass mb-6 rounded-2xl border border-white/10 p-4 shadow-lg" aria-labelledby="rankings-heading">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="rankings-heading" className="flex items-center gap-2 text-base font-semibold">
                <span aria-hidden="true">⭐</span> 完整排行榜
              </h2>
              <Button variant="ghost" size="sm" onClick={() => void handleCopyScores()} className="text-xs">
                <Copy className="h-3.5 w-3.5 mr-1" />
                {copiedScores ? "已複製！" : "複製戰績榜"}
              </Button>
            </div>
            <ol className="space-y-2">
              {ranked.map((entry, i) => (
                <li
                  key={entry.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3 transition-all",
                    entry.isMe ? "border-violet-500/40 bg-violet-500/15" : "border-white/5 bg-white/5",
                  )}
                >
                  <span className="w-6 text-sm font-bold tabular-nums text-white/40">#{i + 1}</span>
                  <span className="text-2xl" aria-hidden="true">
                    {entry.avatar}
                  </span>
                  <span className="flex-1 text-sm font-semibold flex items-center gap-1.5">
                    {entry.nickname}
                    {entry.isHost && (
                      <span aria-label="房主" role="img">
                        👑
                      </span>
                    )}
                    {entry.isMe && <span className="text-[10px] text-violet-300 font-normal">（你）</span>}
                  </span>
                  <span className="text-sm font-bold tabular-nums text-cyan-400">{entry.score} 分</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {achievements.length > 0 && (
          <section className="glass mb-6 rounded-2xl border border-white/10 p-4 shadow-lg" aria-labelledby="achievements-heading">
            <h2 id="achievements-heading" className="mb-3 text-base font-semibold">
              <span aria-hidden="true">🎖️</span> 本局專屬成就
            </h2>
            <ul className="grid grid-cols-2 gap-2">
              {achievements.map((a) => {
                const owner = room.players[a.playerId];
                return (
                  <li
                    key={`${a.id}-${a.playerId}`}
                    className="rounded-xl border border-white/5 bg-white/5 p-3 text-center"
                  >
                    <p className="mb-1 text-2xl" aria-hidden="true">
                      {a.icon}
                    </p>
                    <p className="text-xs font-bold text-white/80">{a.name}</p>
                    <p className="mt-0.5 truncate text-[11px] text-white/50">{owner?.nickname ?? ""}</p>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Reaction Bar for celebrating */}
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
          <p className="text-xs text-white/50 mb-2 flex items-center justify-center gap-1">
            <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
            點擊表情為獲勝者喝采！
          </p>
          <div className="flex justify-center gap-2">
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => void handleReaction(emoji)}
                className="glass rounded-xl px-3 py-2 text-2xl transition-all hover:bg-white/15 active:scale-90"
                aria-label={`發送 ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <ErrorNote className="mb-4">{error}</ErrorNote>

        <div className="space-y-2.5">
          {isHost ? (
            <>
              <Button
                variant="accent"
                size="md"
                className="w-full font-bold shadow-lg"
                onClick={() => endRound().catch((e) => setError(e instanceof Error ? e.message : "無法重新開始"))}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> 再玩一次同款遊戲
              </Button>

              <Button
                variant="ghost"
                size="md"
                className="w-full border border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20"
                onClick={() => setShowSwitchModal(true)}
              >
                <Gamepad2 className="h-4 w-4" aria-hidden="true" /> 換一款遊戲開房（免重新掃碼）
              </Button>

              <Button variant="danger" size="md" className="w-full" onClick={() => setConfirmingEnd(true)}>
                結束並解散房間
              </Button>
            </>
          ) : (
            <>
              <p className="py-2 text-center text-sm text-white/60" role="status">
                <span className="mr-2 inline-block animate-pulse" aria-hidden="true">
                  ⏳
                </span>
                等待房主決定下一局…
              </p>
              <LinkButton href="/" variant="ghost" size="md" className="w-full">
                <Home className="h-4 w-4" aria-hidden="true" /> 返回首頁
              </LinkButton>
            </>
          )}

          <Link
            href={`/room/${roomCode}/${isHost ? "host" : "play"}`}
            className="block w-full rounded-xl py-3 text-center text-sm font-medium text-white/40 transition-all hover:text-white/70"
          >
            回到{isHost ? "大廳" : "房間"}
          </Link>
        </div>
      </div>

      {/* Switch Game Modal */}
      <Modal open={showSwitchModal} onClose={() => setShowSwitchModal(false)} title="換一款遊戲繼續同樂">
        <p className="mb-4 text-xs text-white/50">
          全體玩家將保留在房間中，直接轉換到新遊戲的大廳，無需重新輸入代碼或掃描 QR code！
        </p>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {playableGames.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => void handleSwitchGame(g.id)}
              className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left transition-all hover:bg-white/15 hover:border-violet-400 active:scale-98"
            >
              <span className="text-3xl" aria-hidden="true">
                {g.icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">{g.name}</p>
                <p className="text-xs text-white/50 truncate">{g.description}</p>
              </div>
              <span className="text-xs text-violet-400 font-semibold shrink-0">切換 →</span>
            </button>
          ))}
        </div>
      </Modal>

      {/* End-room confirmation */}
      <Modal open={confirmingEnd} onClose={() => setConfirmingEnd(false)} title="要解散這間房嗎？" role="alertdialog">
        <p className="mb-6 text-sm text-white/50">所有玩家都會被移出，房間代碼立刻失效。這個動作無法復原。</p>
        <div className="flex gap-2">
          <Button variant="ghost" size="md" className="flex-1" onClick={() => setConfirmingEnd(false)}>
            取消
          </Button>
          <Button variant="danger" size="md" className="flex-1" onClick={() => void handleEnd()}>
            解散房間
          </Button>
        </div>
      </Modal>
    </main>
  );
}
