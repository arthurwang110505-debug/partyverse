"use client";

import { useEffect, useRef } from "react";
import { useRoom } from "@/providers/RoomContext";
import { useToast } from "@/providers/ToastProvider";
import type { FireworkGameState } from "@/engine/fireworkMaster";
import { Button } from "@/components/ui/Button";
import { HostShell } from "@/components/game/HostShell";
import { PlayerChip } from "@/components/game/PlayerChip";
import { RoundTimer } from "@/components/game/RoundTimer";
import { Confetti } from "@/components/game/Confetti";
import { sfx } from "@/lib/sound";

export default function HostFireworkMaster() {
  const { room, endRound, endGame } = useRoom();
  const { toast } = useToast();
  const state = room?.gameState as FireworkGameState | undefined;
  const players = room?.players ?? {};

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const phase = state?.phase;

  // Sound triggers on phase transition
  useEffect(() => {
    if (phase === "show") {
      sfx.playBoom();
      const interval = setInterval(() => {
        sfx.playBoom();
      }, 1500);
      return () => clearInterval(interval);
    } else if (phase === "result") {
      sfx.playFanfare();
    }
  }, [phase]);

  // Particle fireworks canvas animation for show phase
  useEffect(() => {
    if (state?.phase !== "show" || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const width = (canvas.width = canvas.parentElement?.clientWidth ?? 800);
    const height = (canvas.height = canvas.parentElement?.clientHeight ?? 360);

    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      color: string;
      alpha: number;
      size: number;
    }> = [];

    const designsList = Object.values(state.designs);

    const spawnBurst = () => {
      const design = designsList[Math.floor(Math.random() * designsList.length)];
      const color = design?.color ?? "#f59e0b";
      const cx = width * (0.2 + Math.random() * 0.6);
      const cy = height * (0.2 + Math.random() * 0.5);

      for (let i = 0; i < 35; i++) {
        const angle = (Math.PI * 2 * i) / 35;
        const speed = 2 + Math.random() * 4;
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color,
          alpha: 1,
          size: 2 + Math.random() * 3,
        });
      }
    };

    spawnBurst();
    const spawnTimer = setInterval(spawnBurst, 800);

    const render = () => {
      ctx.fillStyle = "rgba(10, 10, 20, 0.25)";
      ctx.fillRect(0, 0, width, height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05; // gravity
        p.alpha -= 0.018;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      clearInterval(spawnTimer);
    };
  }, [state?.phase, state?.designs]);

  if (!state) return null;

  const fail = (e: unknown) => toast(e instanceof Error ? e.message : "操作失敗");
  const livingPlayerCount = Object.keys(players).length;
  const voteCount = Object.keys(state.votes).length;

  return (
    <HostShell>
      {state.phase === "result" && <Confetti />}

      <div className="mx-auto max-w-4xl text-center">
        <header className="mb-6">
          <p className="mb-2 text-sm font-semibold tracking-wider text-cyan-400">煙火大師 🎆 · 創意競賽</p>
          <h1 className="px-4 text-3xl font-black text-white md:text-5xl">
            {state.phase === "designing" && "玩家正在手機調配專屬煙火…"}
            {state.phase === "show" && "✨ 全體煙火聯合大匯演 ✨"}
            {state.phase === "voting" && "🗳️ 投票評選你最喜愛的煙火！"}
            {state.phase === "result" && "🏆 最佳煙火設計大師！"}
          </h1>
        </header>

        {state.phase === "designing" && (
          <div className="my-10">
            <div className="mx-auto mb-8 max-w-md">
              <RoundTimer timeLeft={state.timeLeft} total={Math.max(25, room?.settings?.timer ?? 30)} endLabel="設計截止" />
            </div>
            <p className="text-white/60">在手機上調配顏色、形狀與花紋，等待盛大夜空匯演！</p>
          </div>
        )}

        {state.phase === "show" && (
          <div className="relative my-8 h-80 overflow-hidden rounded-3xl border border-cyan-500/30 bg-black/80 shadow-2xl">
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
            <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-around px-4">
              {Object.entries(state.designs).map(([id, d]) => (
                <div key={id} className="text-center animate-bounce">
                  <span
                    className="inline-block h-8 w-8 rounded-full shadow-lg border-2 border-white/60"
                    style={{ backgroundColor: d.color, boxShadow: `0 0 20px ${d.color}` }}
                  />
                  <p className="mt-1 text-xs font-bold text-white drop-shadow-md">
                    {players[id]?.nickname}
                  </p>
                </div>
              ))}
            </div>
            <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none">
              <span className="rounded-full bg-black/60 px-4 py-1.5 text-xs font-bold text-yellow-300 border border-yellow-400/40 animate-pulse">
                🎆 盛大綻放中 · 剩餘 {state.timeLeft} 秒
              </span>
            </div>
          </div>
        )}

        {state.phase === "voting" && (
          <div className="my-8">
            <div className="mx-auto mb-8 max-w-md">
              <RoundTimer timeLeft={state.timeLeft} total={15} endLabel="投票截止" />
            </div>
            <p className="text-lg text-white mb-4">請在手機投下你最欣賞的設計！</p>
            <div className="mx-auto max-w-md">
              <div className="mb-2 flex items-center justify-between text-sm font-semibold text-cyan-300">
                <span>投票進度</span>
                <span>
                  {voteCount} / {livingPlayerCount} 票
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (voteCount / Math.max(1, livingPlayerCount)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {state.phase === "result" && (
          <div className="my-8 inline-block animate-scale-in rounded-3xl border border-cyan-400/40 bg-cyan-950/40 p-8 shadow-2xl">
            <p className="mb-2 text-6xl animate-bounce" aria-hidden="true">
              🎆
            </p>
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-cyan-300">
              人氣總冠軍
            </span>
            <h2 className="mb-2 text-3xl font-black text-white">
              {state.winnerId ? players[state.winnerId]?.nickname : "全體大師"} 贏得最佳煙火賞！
            </h2>
            <p className="text-sm text-cyan-200/80">獲得 {state.voteCounts[state.winnerId ?? ""] ?? 0} 票肯定！</p>
          </div>
        )}

        <ul className="my-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(players).map(([id, p]) => (
            <PlayerChip
              key={id}
              avatar={p.avatar}
              nickname={p.nickname}
              score={state.currentScores?.[id] ?? 0}
              highlight={id === state.winnerId}
            />
          ))}
        </ul>

        <div className="mt-8 flex justify-center gap-3">
          <Button variant="ghost" size="md" onClick={() => endRound().catch(fail)}>
            重開
          </Button>
          <Button variant="danger" size="md" onClick={() => endGame().catch(fail)}>
            結算
          </Button>
        </div>
      </div>
    </HostShell>
  );
}

