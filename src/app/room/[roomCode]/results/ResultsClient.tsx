"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Home, RotateCcw } from "lucide-react";
import { useRoom } from "@/providers/RoomContext";
import { GAMES } from "@/constants/games";
import type { Achievement } from "@/types";
import type { BombGameState } from "@/engine/bombCountdown";
import { Button, LinkButton } from "@/components/ui/Button";
import { ErrorNote } from "@/components/ui/ErrorNote";
import { Modal } from "@/components/ui/Modal";
import { Confetti } from "@/components/game/Confetti";
import { useCountUp } from "@/hooks/useCountUp";
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
  const { room, player, isHost, endRound, endRoom } = useRoom();
  const [error, setError] = useState("");
  const [confirmingEnd, setConfirmingEnd] = useState(false);

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

  // Recap strip — one "screenshot me" row for the end of the night.
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

  if (!room) return null;

  return (
    <main
      className="min-h-[100dvh] bg-ink p-4 pb-safe text-white"
      style={{ "--game-accent": game?.color, "--game-gradient": game?.gradient } as CSSProperties}
    >
      {isHost && <Confetti />}

      <div className="mx-auto max-w-lg pt-8">
        <header className="mb-8 text-center">
          <p className="mb-4 text-5xl" aria-hidden="true">
            🏆
          </p>
          <h1 className="mb-2 text-3xl font-bold">遊戲結果</h1>
          {game && (
            <p className="text-sm text-white/40">
              <span aria-hidden="true">{game.icon}</span> {game.name}
              {elapsed !== null && <span> · 進行 {formatTime(elapsed)}</span>}
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

        {ranked.length > 0 && (
          <section className="mb-8 flex h-48 items-end justify-center gap-3" aria-label="前三名">
            {podium.map((entry, visualIndex) => {
              const place = PODIUM_ORDER[visualIndex];
              const podiumStyles = [
                "h-16 w-20 border-yellow-500/20 bg-gradient-to-t from-yellow-500/20 to-yellow-500/5",
                "h-12 w-16 border-white/5 bg-white/5",
                "h-8 w-16 border-white/5 bg-white/5",
              ];
              return (
                <div key={entry.id} className="flex flex-col items-center">
                  <p className="mb-1 text-2xl" aria-hidden="true">
                    {MEDALS[place]}
                  </p>
                  <p className={cn("mb-1", place === 0 ? "text-3xl" : "text-2xl")} aria-hidden="true">
                    {entry.avatar}
                  </p>
                  <p
                    className={cn(
                      "max-w-[100px] truncate text-center font-medium",
                      place === 0 ? "text-sm" : "text-xs",
                    )}
                  >
                    {entry.nickname}
                  </p>
                  <AnimatedScore
                    value={entry.score}
                    className={
                      place === 0 ? "text-yellow-400" : place === 1 ? "text-cyan-400" : "text-orange-400"
                    }
                  />
                  <p
                    className={cn(
                      "flex items-end justify-center rounded-t-lg border pb-2 text-lg font-bold",
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

        {ranked.length > 0 && (
          <section className="glass mb-6 rounded-2xl border border-white/10 p-4" aria-labelledby="rankings-heading">
            <h2 id="rankings-heading" className="mb-3 flex items-center gap-2 text-base font-semibold">
              <span aria-hidden="true">⭐</span> 完整排行
            </h2>
            <ol className="space-y-2">
              {ranked.map((entry, i) => (
                <li
                  key={entry.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3 transition-all",
                    entry.isMe ? "border-violet-500/20 bg-violet-500/10" : "border-white/5 bg-white/5",
                  )}
                >
                  <span className="w-6 text-sm font-bold tabular-nums text-white/30">#{i + 1}</span>
                  <span className="text-xl" aria-hidden="true">
                    {entry.avatar}
                  </span>
                  <span className="flex-1 text-sm font-medium">
                    {entry.nickname}
                    {entry.isHost && (
                      <span aria-label="房主" role="img">
                        {" "}
                        👑
                      </span>
                    )}
                    {entry.isMe && <span className="sr-only">（你）</span>}
                  </span>
                  <span className="text-sm font-bold tabular-nums text-cyan-400">{entry.score} 分</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {achievements.length > 0 && (
          <section className="glass mb-6 rounded-2xl border border-white/10 p-4" aria-labelledby="achievements-heading">
            <h2 id="achievements-heading" className="mb-3 text-base font-semibold">
              <span aria-hidden="true">🎖️</span> 本局成就
            </h2>
            <ul className="grid grid-cols-2 gap-2">
              {achievements.map((a) => {
                const owner = room.players[a.playerId];
                return (
                  <li
                    key={`${a.id}-${a.playerId}`}
                    className="rounded-xl border border-white/5 bg-white/5 p-3 text-center"
                  >
                    <p className="mb-1 text-xl" aria-hidden="true">
                      {a.icon}
                    </p>
                    <p className="text-xs font-medium text-white/70">{a.name}</p>
                    <p className="mt-0.5 truncate text-[10px] text-white/40">{owner?.nickname ?? ""}</p>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <ErrorNote className="mb-4">{error}</ErrorNote>

        <div className="space-y-2">
          {isHost ? (
            <>
              <Button
                variant="accent"
                size="md"
                className="w-full"
                onClick={() => endRound().catch((e) => setError(e instanceof Error ? e.message : "無法重新開始"))}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> 再玩一次
              </Button>
              <Button variant="danger" size="md" className="w-full" onClick={() => setConfirmingEnd(true)}>
                結束並解散房間
              </Button>
            </>
          ) : (
            <>
              {/* Most nights end with "one more round" — say so while the host decides. */}
              <p className="py-2 text-center text-sm text-white/50" role="status">
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
            className="block w-full rounded-xl py-3 text-center text-sm font-medium text-white/40 transition-all hover:text-white/60"
          >
            回到{isHost ? "大廳" : "房間"}
          </Link>
        </div>
      </div>

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
