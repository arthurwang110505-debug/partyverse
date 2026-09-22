"use client";

import { engineRoom } from "@/engine/participants";

import { useEffect, useRef, useState } from "react";
import { useRoom } from "@/providers/RoomContext";
import type { FireworkDesign, FireworkGameState } from "@/engine/fireworkMaster";
import { HostGameControls } from "@/components/game/HostGameControls";
import { HostShell } from "@/components/game/HostShell";
import { PlayerChip } from "@/components/game/PlayerChip";
import { RoundTimer } from "@/components/game/RoundTimer";
import { Confetti } from "@/components/game/Confetti";
import { sfx } from "@/lib/sound";

const SHAPES_LABEL: Record<FireworkDesign["shape"], string> = {
  circle: "圓球形",
  star: "星芒型",
  heart: "愛心型",
  ring: "土星環",
};

interface FireworkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  size: number;
  trail: FireworkDesign["trailEffect"];
  twinkle: number;
}

/** N anchor points along the chosen firework shape, centered at (cx, cy). */
function shapePoints(shape: FireworkDesign["shape"], n: number, cx: number, cy: number, scale: number): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  if (shape === "star") {
    // Five-point star polygon: 10 anchor vertices, 4 subdivisions each.
    const verts: Array<[number, number]> = [];
    for (let i = 0; i < 10; i++) {
      const angle = -Math.PI / 2 + (Math.PI * i) / 5;
      const r = i % 2 === 0 ? scale : scale * 0.45;
      verts.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
    }
    const subdiv = Math.max(1, Math.floor(n / 10));
    for (let i = 0; i < 10; i++) {
      const [x0, y0] = verts[i];
      const [x1, y1] = verts[(i + 1) % 10];
      for (let s = 0; s < subdiv; s++) {
        const t = s / subdiv;
        points.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
      }
    }
    return points;
  }
  if (shape === "heart") {
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const x = 16 * Math.pow(Math.sin(t), 3);
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      points.push([cx + (x * scale) / 17, cy - (y * scale) / 17]);
    }
    return points;
  }
  if (shape === "ring") {
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 * i) / n;
      const r = i % 2 === 0 ? scale : scale * 0.72;
      points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
    }
    return points;
  }
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n;
    const r = scale * (0.85 + 0.15 * Math.sin(i * 2.7)); // gentle sphere shimmer
    points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
  }
  return points;
}

export default function HostFireworkMaster() {
  const { room } = useRoom();
  const state = room?.gameState as FireworkGameState | undefined;
  const players = room ? engineRoom(room).players : {};

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [nowFiring, setNowFiring] = useState<{ name: string; icon: string } | null>(null);

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

  // Grand show: every design is fired in a parade (name on screen), rendered
  // with its true shape and trail effect.
  useEffect(() => {
    if (state?.phase !== "show" || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const width = (canvas.width = canvas.parentElement?.clientWidth ?? 800);
    const height = (canvas.height = canvas.parentElement?.clientHeight ?? 360);

    const particles: FireworkParticle[] = [];

    const designs = Object.entries(state.designs ?? {}).map(([id, d]) => ({
      id,
      d,
      name: players[id]?.nickname ?? "玩家",
      icon: players[id]?.avatar ?? "🎆",
    }));

    const spawnBurst = (design: (typeof designs)[number] | undefined) => {
      const d = design?.d;
      const color = d?.color ?? "#f59e0b";
      const shape = d?.shape ?? "circle";
      const trail = d?.trailEffect ?? "sparkle";
      const cx = width * (0.18 + Math.random() * 0.64);
      const cy = height * (0.18 + Math.random() * 0.5);
      const scale = Math.min(width, height) * 0.17;
      const n = Math.max(12, Math.min(80, Math.round(d?.density ?? 30)));

      for (const [px, py] of shapePoints(shape, n, cx, cy, scale)) {
        const dx = px - cx;
        const dy = py - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const speed = 0.25 + Math.random() * 0.45;
        particles.push({
          x: px,
          y: py,
          vx: (dx / dist) * speed,
          vy: (dy / dist) * speed,
          color,
          alpha: trail === "smoke" ? 0.55 : 1,
          size: trail === "smoke" ? 4 + Math.random() * 4 : 1.5 + Math.random() * 2.5,
          trail,
          twinkle: Math.random() * Math.PI * 2,
        });
      }
    };

    // Parade: fire each player's design in join order until the show ends.
    let index = -1;
    const step = () => {
      index += 1;
      const design = designs.length ? designs[index % designs.length] : undefined;
      spawnBurst(design);
      if (design) {
        setNowFiring({ name: design.name, icon: design.icon });
      }
      sfx.playTick(500 + (index % 4) * 120, 0.08);
    };

    step();
    const intervalMs = Math.max(900, Math.floor(10500 / Math.max(1, designs.length)));
    const spawnTimer = setInterval(step, intervalMs);

    const render = () => {
      ctx.fillStyle = "rgba(10, 10, 20, 0.25)";
      ctx.fillRect(0, 0, width, height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.trail === "smoke" ? 0.012 : 0.05; // gravity
        p.alpha -= p.trail === "smoke" ? 0.006 : p.trail === "glitter" ? 0.02 : 0.015;
        p.twinkle += 0.35;

        let alpha = p.alpha;
        if (p.trail === "glitter") alpha *= 0.55 + 0.45 * Math.abs(Math.sin(p.twinkle));
        if (alpha <= 0.01) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.min(1, alpha);
        ctx.fillStyle = p.color;
        if (p.trail !== "smoke") {
          ctx.shadowColor = p.color;
          ctx.shadowBlur = p.trail === "glitter" ? 14 : 9;
        }
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
      setNowFiring(null);
    };
    // The show only starts once designs are frozen; restart only on phase change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.phase]);

  if (!state) return null;

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
              <RoundTimer
                timeLeft={state.timeLeft}
                total={Math.max(25, room?.settings?.timer ?? 30)}
                endLabel="設計截止"
              />
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
                  <p className="mt-1 text-xs font-bold text-white drop-shadow-md">{players[id]?.nickname}</p>
                </div>
              ))}
            </div>
            <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none">
              <span className="rounded-full bg-black/60 px-4 py-1.5 text-xs font-bold text-yellow-300 border border-yellow-400/40 animate-pulse">
                🎆 盛大綻放中 · 剩餘 {state.timeLeft} 秒
              </span>
            </div>
            {nowFiring && (
              <div className="absolute top-14 left-1/2 -translate-x-1/2 pointer-events-none" key={nowFiring.name}>
                <span className="block rounded-full bg-black/70 px-5 py-2 text-lg font-black text-white border border-cyan-400/50 shadow-lg shadow-cyan-500/30 animate-scale-in">
                  {nowFiring.icon} {nowFiring.name} 的煙火！
                </span>
              </div>
            )}
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
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-cyan-300">人氣總冠軍</span>
            <h2 className="mb-2 text-3xl font-black text-white">
              {state.winnerId ? players[state.winnerId]?.nickname : "全體大師"} 贏得最佳煙火賞！
            </h2>
            {state.winnerId && state.designs?.[state.winnerId] && (
              <div className="mb-2 flex items-center justify-center gap-2">
                <span
                  className="inline-block h-6 w-6 rounded-full border border-white/60"
                  style={{
                    backgroundColor: state.designs[state.winnerId].color,
                    boxShadow: `0 0 16px ${state.designs[state.winnerId].color}`,
                  }}
                  aria-hidden="true"
                />
                <span className="text-sm font-bold text-cyan-200">
                  {SHAPES_LABEL[state.designs[state.winnerId].shape]} · {state.designs[state.winnerId].trailEffect === "sparkle" ? "閃爍" : state.designs[state.winnerId].trailEffect === "smoke" ? "煙霧" : "星輝"}
                </span>
              </div>
            )}
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

        <HostGameControls />
      </div>
    </HostShell>
  );
}
