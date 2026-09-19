"use client";

import { useEffect, useState } from "react";
import { useRoom } from "@/providers/RoomContext";
import { GAMES } from "@/constants/games";
import { HOST_STALE_MS } from "@/constants/room";
import type { BombGameState } from "@/engine/bombCountdown";
import { Button } from "@/components/ui/Button";
import { ErrorNote } from "@/components/ui/ErrorNote";
import { cn } from "@/lib/utils";

/**
 * The phone-in-hand view.
 *
 * State comes from the room context (one shared listener) rather than a second
 * `onValue` subscription, and answers are submitted through `submitAction`,
 * which runs the engine inside a transaction on the room node.
 */
export default function PlayGameView() {
  const { room, player, isHost, submitAction, claimHost } = useRoom();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const state = room?.gameState as BombGameState | undefined;
  const game = GAMES.find((g) => g.id === room?.gameId);

  const isMyTurn = Boolean(player && state?.bombHolderId === player.id);
  const isEliminated = Boolean(player && state?.eliminatedPlayers.includes(player.id));
  const hostStale = Boolean(
    room?.status === "PLAYING" && room.lastTickAt && Date.now() - room.lastTickAt > HOST_STALE_MS && !isHost,
  );

  // Clear the pending flag once the server state actually moves on.
  useEffect(() => {
    if (pending) setPending(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.bombHolderId, state?.bombTimeLeft]);

  const answer = async (value: string) => {
    setPending(true);
    setError("");
    try {
      await submitAction({ type: "answer", answer: value });
    } catch (e) {
      setError(e instanceof Error ? e.message : "送出失敗，請再試一次");
      setPending(false);
    }
  };

  if (!room || !player) return null;

  const timeLeft = state?.bombTimeLeft ?? 0;
  const critical = timeLeft <= 3;

  return (
    <main className="min-h-screen bg-ink pb-24 text-white">
      <div className="mx-auto max-w-md p-4 pt-8">
        <header className="mb-6 text-center">
          <p className="mb-1 text-sm text-white/40">
            <span aria-hidden="true">{game?.icon}</span> {game?.name}
          </p>
          <p className="text-sm font-bold tracking-widest">房間 {room.id}</p>
        </header>

        {hostStale && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-center">
            <p className="mb-2 text-sm text-amber-300">房主似乎已經離線，遊戲暫停中</p>
            <Button size="sm" variant="ghost" onClick={() => claimHost().catch(() => setError("接管失敗"))}>
              由我接管房主
            </Button>
          </div>
        )}

        {state && state.phase === "challenge" && (
          <div className="mb-6 flex justify-center">
            <p
              className={cn(
                "flex h-32 w-32 items-center justify-center rounded-full text-5xl font-bold tabular-nums transition-all duration-300",
                critical ? "bg-red-500" : timeLeft <= 5 ? "bg-orange-500" : "bg-white/10",
              )}
              style={{ boxShadow: critical ? "0 0 60px rgba(239,68,68,0.6)" : "none" }}
              aria-live="off"
            >
              {timeLeft}
            </p>
          </div>
        )}

        {state?.lastEliminatedId === player.id && (
          <p className="mb-4 text-center text-sm text-red-400" role="status">
            炸彈在你手上爆炸了！
          </p>
        )}

        {isEliminated ? (
          <section className="py-12 text-center">
            <p className="mb-4 text-6xl" aria-hidden="true">
              💀
            </p>
            <h2 className="mb-2 text-2xl font-bold text-red-400">你出局了</h2>
            <p className="text-sm text-white/40">看看誰能撐到最後</p>
            <p className="mt-6 text-sm text-white/50">目前得分：{state?.currentScores?.[player.id] ?? 0}</p>
          </section>
        ) : state?.phase === "result" ? (
          <section className="py-12 text-center">
            <p className="mb-4 text-6xl" aria-hidden="true">
              🏆
            </p>
            <h2 className="text-2xl font-bold">遊戲結束</h2>
            <p className="mt-2 text-sm text-white/40">正在結算…</p>
          </section>
        ) : isMyTurn && state?.challenge ? (
          <section aria-labelledby="turn-heading">
            <h2 id="turn-heading" className="mb-4 text-center">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-emerald-400">
                換你了
              </span>
              <span className="block text-lg font-bold">{state.challenge.question}</span>
            </h2>
            <div className="space-y-2">
              {state.challenge.options.map((option) => (
                <Button
                  key={option}
                  variant="ghost"
                  size="md"
                  className="w-full"
                  disabled={pending}
                  onClick={() => void answer(option)}
                >
                  {option}
                </Button>
              ))}
            </div>
            <ErrorNote className="mt-4">{error}</ErrorNote>
          </section>
        ) : state?.phase === "challenge" ? (
          <section className="py-12 text-center" role="status">
            <p className="mb-3 text-4xl" aria-hidden="true">
              ⏳
            </p>
            <p className="text-sm text-white/40">
              等 <span className="font-semibold text-white/70">{room.players[state.bombHolderId]?.nickname ?? "其他玩家"}</span>{" "}
              拆彈…
            </p>
          </section>
        ) : (
          <section className="py-12 text-center" role="status">
            <p className="mb-3 text-4xl" aria-hidden="true">
              💣
            </p>
            <p className="text-sm text-white/40">準備中…</p>
          </section>
        )}

        {state && (
          <p className="glass fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-white/10 px-4 py-2 text-sm font-medium">
            得分：{state.currentScores?.[player.id] ?? 0}
          </p>
        )}
      </div>
    </main>
  );
}
